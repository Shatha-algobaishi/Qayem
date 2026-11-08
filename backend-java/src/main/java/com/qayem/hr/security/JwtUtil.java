package com.qayem.hr.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Component;
import com.qayem.hr.entity.User;
import com.qayem.hr.entity.UserRole;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.issuer:Qayem.HRSystem}")
    private String issuer;

    @Value("${jwt.audience:Qayem.HRSystem.Client}")
    private String audience;

    @Value("${jwt.access-expiry-minutes:60}")
    private int accessExpiryMinutes;

    @Value("${jwt.refresh-expiry-days:7}")
    private int refreshExpiryDays;

    private SecretKey getKey() {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalArgumentException("JWT_SECRET must contain at least 32 UTF-8 bytes.");
        }
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateAccessToken(User user, List<String> roles, List<String> permissions) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + accessExpiryMinutes * 60L * 1000L);

        return Jwts.builder()
                .subject(user.getId().toString())
                .issuer(issuer)
                .audience().add(audience).and()
                .issuedAt(now)
                .expiration(expiry)
                .claim("username", user.getUsername())
                .claim("email", user.getEmail())
                .claim("roles", roles)
                .claim("fullNameAr", user.getFullNameAr())
                .claim("fullNameEn", user.getFullNameEn())
                .claim("department", user.getDepartment())
                .claim("permissions", permissions)
                .signWith(getKey())
                .compact();
    }

    public String generateRefreshTokenValue() {
        return UUID.randomUUID().toString().replace("-", "") +
               UUID.randomUUID().toString().replace("-", "");
    }

    public LocalDateTime getRefreshTokenExpiry() {
        return LocalDateTime.now().plusDays(refreshExpiryDays);
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(getKey())
                .requireIssuer(issuer)
                .requireAudience(audience)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public boolean isTokenValid(String token) {
        try {
            parseToken(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public UUID extractUserId(String token) {
        return UUID.fromString(parseToken(token).getSubject());
    }

    @SuppressWarnings("unchecked")
    public List<String> extractRoles(String token) {
        Object roles = parseToken(token).get("roles");
        if (roles instanceof List<?> list) {
            return list.stream().map(Object::toString).collect(Collectors.toList());
        }
        return List.of();
    }
}
