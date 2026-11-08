package com.qayem.hr.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import com.qayem.hr.entity.*;
import com.qayem.hr.repository.*;
import com.qayem.hr.security.JwtUtil;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/users")
@PreAuthorize("hasAuthority('Admin')")
public class UsersController {

    private final UserRepository userRepo;
    private final RoleRepository roleRepo;
    private final UserRoleRepository userRoleRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public UsersController(UserRepository userRepo, RoleRepository roleRepo,
                           UserRoleRepository userRoleRepo, PasswordEncoder passwordEncoder,
                           JwtUtil jwtUtil) {
        this.userRepo = userRepo;
        this.roleRepo = roleRepo;
        this.userRoleRepo = userRoleRepo;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    @GetMapping
    public ResponseEntity<?> getUsers(@RequestParam(required = false) String search,
                                       @RequestParam(required = false) String role,
                                       @RequestParam(defaultValue = "false") boolean includeDeleted,
                                       @RequestParam(defaultValue = "1") int page,
                                       @RequestParam(defaultValue = "20") int pageSize) {
        Specification<User> spec = (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            if (!includeDeleted)
                predicates.add(cb.isFalse(root.get("isDeleted")));
            if (search != null && !search.isBlank()) {
                String like = "%" + search.toLowerCase() + "%";
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("fullNameAr")), like),
                    cb.like(cb.lower(root.get("fullNameEn")), like),
                    cb.like(cb.lower(root.get("username")), like),
                    cb.like(cb.lower(root.get("email")), like)
                ));
            }
            if (role != null && !role.isBlank()) {
                var roleJoin = root.join("role");
                predicates.add(cb.equal(roleJoin.get("name"), role));
            }
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };

        Pageable pageable = PageRequest.of(page - 1, pageSize, Sort.by("fullNameAr"));
        Page<User> pg = userRepo.findAll(spec, pageable);

        List<Map<String, Object>> items = pg.getContent().stream().map(u -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", u.getId());
            m.put("fullNameAr", u.getFullNameAr());
            m.put("fullNameEn", u.getFullNameEn());
            m.put("email", u.getEmail());
            m.put("username", u.getUsername());
            m.put("roleName", u.getRole() != null ? u.getRole().getName() : null);
            m.put("roleNameAr", u.getRole() != null ? u.getRole().getNameAr() : null);
            m.put("department", u.getDepartment());
            m.put("jobTitle", u.getJobTitle());
            m.put("isActive", u.isActive());
            m.put("lastLoginAt", u.getLastLoginAt());
            m.put("roles", List.of());
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
            "items", items,
            "totalCount", pg.getTotalElements(),
            "page", page,
            "pageSize", pageSize,
            "totalPages", pg.getTotalPages()
        ));
    }

    @GetMapping("/evaluators")
    @PreAuthorize("hasAnyAuthority('Admin','DataEntry')")
    public ResponseEntity<?> getEvaluators() {
        Role evalRole = roleRepo.findByName("Evaluator").orElse(null);
        if (evalRole == null) return ResponseEntity.ok(List.of());

        List<UUID> evalUserIds = userRoleRepo.findAll().stream()
                .filter(ur -> ur.getRoleId().equals(evalRole.getId()))
                .map(UserRole::getUserId)
                .collect(Collectors.toList());

        List<Map<String, Object>> result = userRepo.findAll().stream()
                .filter(u -> u.isActive() && !u.isDeleted()
                        && (evalRole.getId().equals(u.getRoleId()) || evalUserIds.contains(u.getId())))
                .sorted(Comparator.comparing(User::getFullNameAr))
                .map(u -> Map.<String, Object>of(
                    "id", u.getId(),
                    "fullNameAr", u.getFullNameAr(),
                    "fullNameEn", u.getFullNameEn(),
                    "email", u.getEmail()
                ))
                .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    @GetMapping("/roles")
    public ResponseEntity<?> getRoles() {
        return ResponseEntity.ok(roleRepo.findAll().stream().map(r -> Map.of(
            "id", r.getId(), "name", r.getName(), "nameAr", r.getNameAr()
        )).collect(Collectors.toList()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getUser(@PathVariable UUID id) {
        User u = userRepo.findById(id).orElse(null);
        if (u == null) return ResponseEntity.notFound().build();

        List<Map<String, Object>> additionalRoles = userRoleRepo.findByUserId(id).stream()
                .filter(ur -> !ur.getRoleId().equals(u.getRoleId()))
                .map(ur -> Map.<String, Object>of(
                    "roleId", ur.getRoleId(),
                    "name", ur.getRole().getName(),
                    "nameAr", ur.getRole().getNameAr(),
                    "isPrimary", ur.isPrimary()
                ))
                .collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", u.getId());
        result.put("fullNameAr", u.getFullNameAr());
        result.put("fullNameEn", u.getFullNameEn());
        result.put("email", u.getEmail());
        result.put("username", u.getUsername());
        result.put("roleName", u.getRole() != null ? u.getRole().getName() : null);
        result.put("roleNameAr", u.getRole() != null ? u.getRole().getNameAr() : null);
        result.put("department", u.getDepartment());
        result.put("jobTitle", u.getJobTitle());
        result.put("isActive", u.isActive());
        result.put("lastLoginAt", u.getLastLoginAt());
        result.put("deletedAt", u.getDeletedAt());
        result.put("isDeleted", u.isDeleted());
        result.put("additionalRoles", additionalRoles);
        return ResponseEntity.ok(result);
    }

    @PostMapping
    public ResponseEntity<?> createUser(@RequestBody CreateUserRequest req, HttpServletRequest http) {
        UUID currentUserId = extractCurrentUserId(http);
        String emailLower = req.email().toLowerCase();
        String usernameLower = req.username().toLowerCase();

        // Check for soft-deleted user with same email → reactivate
        User deleted = userRepo.findByEmailAndIsDeletedTrue(emailLower).orElse(null);
        if (deleted != null) {
            if (userRepo.existsByUsernameAndIsDeletedFalseAndIdNot(usernameLower, deleted.getId()))
                return ResponseEntity.status(409).body(Map.of("message", "اسم المستخدم مستخدم بالفعل. Username already exists."));
            Role role = roleRepo.findById(req.roleId()).orElse(null);
            if (role == null) return ResponseEntity.badRequest().body(Map.of("message", "Role not found."));

            deleted.restore(req.fullNameAr(), req.fullNameEn(), usernameLower,
                    passwordEncoder.encode(req.password()), req.roleId(),
                    currentUserId, req.department(), req.jobTitle());
            userRepo.save(deleted);
            userRoleRepo.deleteAll(userRoleRepo.findByUserId(deleted.getId()));
            userRoleRepo.save(UserRole.createPrimary(deleted.getId(), req.roleId(), currentUserId));
            return ResponseEntity.status(201).body(deleted.getId());
        }

        if (userRepo.existsByUsernameAndIsDeletedFalse(usernameLower))
            return ResponseEntity.status(409).body(Map.of("message", "اسم المستخدم مستخدم بالفعل. Username already exists."));
        if (userRepo.existsByEmailAndIsDeletedFalse(emailLower))
            return ResponseEntity.status(409).body(Map.of("message", "البريد الإلكتروني مستخدم بالفعل. Email already in use."));

        Role role = roleRepo.findById(req.roleId()).orElse(null);
        if (role == null) return ResponseEntity.badRequest().body(Map.of("message", "Role not found."));

        User user = User.create(req.fullNameAr(), req.fullNameEn(), emailLower, usernameLower,
                passwordEncoder.encode(req.password()), req.roleId(), currentUserId,
                req.department(), req.jobTitle(), null);
        userRepo.save(user);
        userRoleRepo.save(UserRole.createPrimary(user.getId(), req.roleId(), currentUserId));
        return ResponseEntity.status(201).body(user.getId());
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateUser(@PathVariable UUID id, @RequestBody UpdateUserRequest req,
                                         HttpServletRequest http) {
        UUID currentUserId = extractCurrentUserId(http);
        User user = userRepo.findById(id).orElse(null);
        if (user == null || user.isDeleted()) return ResponseEntity.notFound().build();

        user.updateProfile(req.fullNameAr(), req.fullNameEn(), req.department(), req.jobTitle());

        if (req.email() != null || req.username() != null) {
            String newEmail = req.email() != null ? req.email().toLowerCase() : user.getEmail();
            String newUsername = req.username() != null ? req.username().toLowerCase() : user.getUsername();
            if (!newEmail.equals(user.getEmail()) && userRepo.existsByEmailAndIsDeletedFalseAndIdNot(newEmail, id))
                return ResponseEntity.status(409).body(Map.of("message", "البريد الإلكتروني مستخدم بالفعل."));
            if (!newUsername.equals(user.getUsername()) && userRepo.existsByUsernameAndIsDeletedFalseAndIdNot(newUsername, id))
                return ResponseEntity.status(409).body(Map.of("message", "اسم المستخدم مستخدم بالفعل."));
            user.updateContact(newEmail, newUsername);
        }

        if (req.roleId() != null && !req.roleId().equals(user.getRoleId())) {
            Role newRole = roleRepo.findById(req.roleId()).orElse(null);
            if (newRole == null) return ResponseEntity.badRequest().body(Map.of("message", "Role not found."));
            user.changeRole(req.roleId());
            userRoleRepo.findByUserIdAndIsPrimaryTrue(id).ifPresent(userRoleRepo::delete);
            if (!userRoleRepo.existsByUserIdAndRoleId(id, req.roleId()))
                userRoleRepo.save(UserRole.createPrimary(id, req.roleId(), currentUserId));
        }

        userRepo.save(user);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/activate")
    public ResponseEntity<?> activate(@PathVariable UUID id) {
        User u = userRepo.findById(id).orElse(null);
        if (u == null) return ResponseEntity.notFound().build();
        u.activate(); userRepo.save(u);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/deactivate")
    public ResponseEntity<?> deactivate(@PathVariable UUID id, HttpServletRequest http) {
        UUID me = extractCurrentUserId(http);
        if (id.equals(me)) return ResponseEntity.badRequest().body(Map.of("message", "لا يمكن تعطيل حسابك الخاص."));
        User u = userRepo.findById(id).orElse(null);
        if (u == null) return ResponseEntity.notFound().build();
        u.deactivate(); userRepo.save(u);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/reset-password")
    public ResponseEntity<?> resetPassword(@PathVariable UUID id,
                                            @RequestBody ResetPasswordRequest req) {
        User u = userRepo.findById(id).orElse(null);
        if (u == null || u.isDeleted()) return ResponseEntity.notFound().build();
        u.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepo.save(u);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> softDelete(@PathVariable UUID id, HttpServletRequest http) {
        UUID me = extractCurrentUserId(http);
        if (id.equals(me)) return ResponseEntity.badRequest().body(Map.of("message", "لا يمكن حذف حسابك الخاص."));
        User u = userRepo.findById(id).orElse(null);
        if (u == null || u.isDeleted()) return ResponseEntity.notFound().build();
        u.softDelete(me); userRepo.save(u);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/roles/{roleId}")
    public ResponseEntity<?> addRole(@PathVariable UUID id, @PathVariable UUID roleId,
                                      HttpServletRequest http) {
        UUID me = extractCurrentUserId(http);
        User u = userRepo.findById(id).orElse(null);
        if (u == null || u.isDeleted()) return ResponseEntity.notFound().build();
        Role role = roleRepo.findById(roleId).orElse(null);
        if (role == null) return ResponseEntity.badRequest().body(Map.of("message", "Role not found."));
        if (userRoleRepo.existsByUserIdAndRoleId(id, roleId))
            return ResponseEntity.status(409).body(Map.of("message", "User already has this role."));
        userRoleRepo.save(UserRole.create(id, roleId, me));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/roles/{roleId}")
    public ResponseEntity<?> removeRole(@PathVariable UUID id, @PathVariable UUID roleId) {
        User u = userRepo.findById(id).orElse(null);
        if (u == null) return ResponseEntity.notFound().build();
        if (roleId.equals(u.getRoleId()))
            return ResponseEntity.badRequest().body(Map.of("message", "Cannot remove the primary role."));
        UserRole ur = userRoleRepo.findByUserIdAndRoleId(id, roleId).orElse(null);
        if (ur == null) return ResponseEntity.notFound().build();
        userRoleRepo.delete(ur);
        return ResponseEntity.noContent().build();
    }

    private UUID extractCurrentUserId(HttpServletRequest req) {
        String h = req.getHeader("Authorization");
        if (h == null || !h.startsWith("Bearer ")) return null;
        try { return jwtUtil.extractUserId(h.substring(7)); } catch (Exception e) { return null; }
    }

    record CreateUserRequest(String fullNameAr, String fullNameEn, String email, String username,
                              String password, UUID roleId, String department, String jobTitle) {}
    record UpdateUserRequest(String fullNameAr, String fullNameEn, String department, String jobTitle,
                              UUID roleId, String email, String username) {}
    record ResetPasswordRequest(String newPassword) {}
}
