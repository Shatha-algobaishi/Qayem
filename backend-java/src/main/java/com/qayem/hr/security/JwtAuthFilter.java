package com.qayem.hr.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import com.qayem.hr.repository.UserRepository;
import com.qayem.hr.repository.UserRoleRepository;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserRepository users;
    private final UserRoleRepository userRoles;

    @Value("${app.demo:false}")
    private boolean demo;
    @Value("${app.demo-write-enabled:false}")
    private boolean demoWriteEnabled;

    public JwtAuthFilter(JwtUtil jwtUtil, UserRepository users, UserRoleRepository userRoles) {
        this.jwtUtil = jwtUtil;
        this.users = users;
        this.userRoles = userRoles;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String token = extractToken(request);
        if (token != null && jwtUtil.isTokenValid(token)) {
            try {
                Claims claims = jwtUtil.parseToken(token);
                String userId = claims.getSubject();

                // Reload permissions so disabling accounts or removing roles takes effect
                // immediately, without waiting for an existing access token to expire.
                var user = users.findById(java.util.UUID.fromString(userId)).orElse(null);
                if (user == null || !user.isActive() || user.isDeleted()) {
                    chain.doFilter(request, response);
                    return;
                }
                var roles = new java.util.LinkedHashSet<String>();
                if (user.getRole() != null) roles.add(user.getRole().getName());
                userRoles.findByUserId(user.getId()).forEach(ur -> roles.add(ur.getRole().getName()));

                if (demo && !List.of("GET", "HEAD", "OPTIONS").contains(request.getMethod())
                        && !List.of("/api/v1/auth/revoke-token", "/api/v1/auth/refresh-token", "/api/v1/auth/login", "/api/v1/auth/demo-login")
                        .contains(request.getRequestURI())) {
                    boolean localWorkflow = demoWriteEnabled && request.getRequestURI().matches(
                            "/api/v1/(sessions|candidates|evaluations|manager|notifications)(/.*)?");
                    if (!localWorkflow) {
                    response.setStatus(403);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"message\":\"Demo is read-only. Changes are disabled.\"}");
                    return;
                    }
                }

                List<SimpleGrantedAuthority> authorities = roles.stream()
                        .map(SimpleGrantedAuthority::new)
                        .collect(Collectors.toList());

                UsernamePasswordAuthenticationToken auth =
                        new UsernamePasswordAuthenticationToken(userId, null, authorities);
                auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (Exception ignored) {}
        }
        chain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (StringUtils.hasText(header) && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }
}
