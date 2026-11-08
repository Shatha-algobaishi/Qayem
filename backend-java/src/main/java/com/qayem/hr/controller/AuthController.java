package com.qayem.hr.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.Authentication;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import com.qayem.hr.entity.*;
import com.qayem.hr.repository.*;
import com.qayem.hr.security.JwtUtil;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    @Value("${app.demo:false}")
    private boolean demo;
    @Value("${app.demo-write-enabled:false}")
    private boolean demoWriteEnabled;

    @GetMapping("/demo-info")
    public Map<String, Object> demoInfo() {
        return Map.of("enabled", demo && !demoWriteEnabled, "localPractice", demo && demoWriteEnabled);
    }


    private final UserRepository userRepo;
    private final RoleRepository roleRepo;
    private final UserRoleRepository userRoleRepo;
    private final RefreshTokenRepository refreshRepo;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;

    public AuthController(UserRepository userRepo, RoleRepository roleRepo,
                          UserRoleRepository userRoleRepo, RefreshTokenRepository refreshRepo,
                          JwtUtil jwtUtil, PasswordEncoder passwordEncoder) {
        this.userRepo = userRepo;
        this.roleRepo = roleRepo;
        this.userRoleRepo = userRoleRepo;
        this.refreshRepo = refreshRepo;
        this.jwtUtil = jwtUtil;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        User user = userRepo.findByUsername(request.username().trim().toLowerCase(Locale.ROOT))
                .or(() -> userRepo.findByEmail(request.username().trim().toLowerCase(Locale.ROOT)))
                .orElse(null);

        if (user == null || !passwordEncoder.matches(request.password(), user.getPasswordHash()))
            return ResponseEntity.status(401).body(Map.of("message", "Invalid credentials."));

        if (!user.isActive() || user.isDeleted())
            return ResponseEntity.status(403).body(Map.of("message", "Account is inactive or deleted."));

        return issueSession(user);
    }

    /** Public visitor access exists only in the isolated, read-only demo. */
    @PostMapping("/demo-login")
    public ResponseEntity<?> demoLogin() {
        if (!demo || demoWriteEnabled) return ResponseEntity.notFound().build();
        var visitor=userRepo.findByUsername("demo").orElse(null);
        if (visitor==null || !visitor.isActive() || visitor.isDeleted())
            return ResponseEntity.status(503).body(Map.of("message","Demo is not ready. Try again shortly."));
        return issueSession(visitor);
    }

    private ResponseEntity<?> issueSession(User user) {
        user.recordLogin();
        userRepo.save(user);

        List<String> roles = buildRoles(user);
        List<String> permissions = buildPermissions(user);

        String accessToken = jwtUtil.generateAccessToken(user, roles, permissions);
        String refreshTokenValue = jwtUtil.generateRefreshTokenValue();
        RefreshToken rt = RefreshToken.create(user.getId(), refreshTokenValue, jwtUtil.getRefreshTokenExpiry());
        refreshRepo.save(rt);

        List<Map<String, Object>> roleOptions = buildRoleOptions(user);

        return ResponseEntity.ok(Map.of(
            "accessToken", accessToken,
            "refreshToken", refreshTokenValue,
            "tokenType", "Bearer",
            "expiresIn", 3600,
            "user", buildUserDto(user, roleOptions)
        ));
    }

    @PostMapping("/refresh-token")
    @Transactional
    public ResponseEntity<?> refreshToken(@Valid @RequestBody RefreshTokenRequest request) {
        RefreshToken rt = refreshRepo.findByToken(request.refreshToken()).orElse(null);
        if (rt == null || !rt.isActive())
            return ResponseEntity.status(401).body(Map.of("message", "Refresh token is invalid or expired."));

        User user = userRepo.findById(rt.getUserId()).orElse(null);
        if (user == null || !user.isActive() || user.isDeleted())
            return ResponseEntity.status(401).body(Map.of("message", "User not found or inactive."));

        rt.revoke();
        refreshRepo.save(rt);

        List<String> roles = buildRoles(user);
        List<String> permissions = buildPermissions(user);

        String newAccess = jwtUtil.generateAccessToken(user, roles, permissions);
        String newRefreshVal = jwtUtil.generateRefreshTokenValue();
        refreshRepo.save(RefreshToken.create(user.getId(), newRefreshVal, jwtUtil.getRefreshTokenExpiry()));

        return ResponseEntity.ok(Map.of(
            "accessToken", newAccess,
            "refreshToken", newRefreshVal,
            "tokenType", "Bearer"
        ));
    }

    @PostMapping("/revoke-token")
    @Transactional
    public ResponseEntity<?> revokeToken(@Valid @RequestBody RefreshTokenRequest request, Authentication auth) {
        refreshRepo.findByToken(request.refreshToken()).ifPresent(rt -> {
            if (rt.getUserId().toString().equals(auth.getName())) {
                rt.revoke();
                refreshRepo.save(rt);
            }
        });
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(HttpServletRequest request) {
        UUID userId = extractUserId(request);
        if (userId == null) return ResponseEntity.status(401).build();

        User user = userRepo.findById(userId).orElse(null);
        if (user == null) return ResponseEntity.notFound().build();

        List<Map<String, Object>> roleOptions = buildRoleOptions(user);
        return ResponseEntity.ok(buildUserDto(user, roleOptions));
    }

    @PutMapping("/change-password")
    @Transactional
    public ResponseEntity<?> changePassword(@Valid @RequestBody ChangePasswordRequest request,
                                             HttpServletRequest httpRequest) {
        UUID userId = extractUserId(httpRequest);
        if (userId == null) return ResponseEntity.status(401).build();

        User user = userRepo.findById(userId).orElse(null);
        if (user == null) return ResponseEntity.notFound().build();

        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash()))
            return ResponseEntity.badRequest().body(Map.of("message", "Current password is incorrect."));

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepo.save(user);
        refreshRepo.deleteByUserId(userId);
        return ResponseEntity.noContent().build();
    }

    private UUID extractUserId(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) return null;
        String token = header.substring(7);
        try {
            return jwtUtil.extractUserId(token);
        } catch (Exception e) {
            return null;
        }
    }

    private List<String> buildRoles(User user) {
        List<String> roles = new ArrayList<>();
        if (user.getRole() != null) roles.add(user.getRole().getName());
        userRoleRepo.findByUserId(user.getId()).stream()
                .map(ur -> ur.getRole().getName())
                .filter(r -> !roles.contains(r))
                .forEach(roles::add);
        return roles;
    }

    private List<String> buildPermissions(User user) {
        Set<String> permissions = new LinkedHashSet<>();
        if (user.getRole() != null)
            user.getRole().getPermissions().forEach(p -> permissions.add(p.getPermission()));
        userRoleRepo.findByUserId(user.getId()).forEach(ur ->
            ur.getRole().getPermissions().forEach(p -> permissions.add(p.getPermission())));
        return new ArrayList<>(permissions);
    }

    /**
     * Roles other than the user's primary one — matches the .NET reference's
     * AdditionalRoles contract (RoleName/RoleNameAr only, primary excluded),
     * which the frontend's role-switcher UI (Sidebar/RoleSelectionPage/AppRouter)
     * relies on to decide whether to show the "switch role" option at all.
     */
    private List<Map<String, Object>> buildRoleOptions(User user) {
        List<Map<String, Object>> opts = new ArrayList<>();
        userRoleRepo.findByUserId(user.getId()).forEach(ur -> {
            if (ur.getRoleId().equals(user.getRoleId())) return;
            opts.add(Map.of(
                "roleName", ur.getRole().getName(),
                "roleNameAr", ur.getRole().getNameAr()
            ));
        });
        return opts;
    }

    private Map<String, Object> buildUserDto(User user, List<Map<String, Object>> roleOptions) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", user.getId());
        dto.put("isDemo", demo);
        dto.put("demoWriteEnabled", demo && demoWriteEnabled);
        dto.put("fullNameAr", user.getFullNameAr());
        dto.put("fullNameEn", user.getFullNameEn());
        dto.put("email", user.getEmail());
        dto.put("username", user.getUsername());
        dto.put("roleName", user.getRole() != null ? user.getRole().getName() : null);
        dto.put("roleNameAr", user.getRole() != null ? user.getRole().getNameAr() : null);
        dto.put("department", user.getDepartment());
        dto.put("jobTitle", user.getJobTitle());
        dto.put("isActive", user.isActive());
        dto.put("lastLoginAt", user.getLastLoginAt());
        dto.put("additionalRoles", roleOptions);
        return dto;
    }

    record LoginRequest(@NotBlank @Size(max=254) String username, @NotBlank @Size(max=72) String password) { @Override public String toString() { return "LoginRequest[redacted]"; } }
    record RefreshTokenRequest(@NotBlank @Size(max=256) String refreshToken) { @Override public String toString() { return "RefreshTokenRequest[redacted]"; } }
    record ChangePasswordRequest(@NotBlank @Size(max=72) String currentPassword, @NotBlank @Size(min=12, max=72) String newPassword) { @Override public String toString() { return "ChangePasswordRequest[redacted]"; } }
}
