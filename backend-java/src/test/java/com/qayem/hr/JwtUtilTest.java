package com.qayem.hr;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import com.qayem.hr.security.JwtUtil;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class JwtUtilTest {
    private static final String KEY = UUID.randomUUID().toString() + UUID.randomUUID();
    private JwtUtil util() {
        var jwt = new JwtUtil();
        ReflectionTestUtils.setField(jwt, "secret", KEY);
        ReflectionTestUtils.setField(jwt, "issuer", "expected-issuer");
        ReflectionTestUtils.setField(jwt, "audience", "expected-audience");
        return jwt;
    }
    private String signed(String issuer, String audience, Date expiration) {
        return Jwts.builder().subject(UUID.randomUUID().toString()).issuer(issuer)
                .audience().add(audience).and().expiration(expiration)
                .signWith(Keys.hmacShaKeyFor(KEY.getBytes(StandardCharsets.UTF_8))).compact();
    }
    @Test void rejectsExpiredTokens() {
        assertFalse(util().isTokenValid(signed("expected-issuer", "expected-audience", new Date(1))));
    }
    @Test void rejectsWrongIssuerAndAudience() {
        assertFalse(util().isTokenValid(signed("other", "expected-audience", new Date(System.currentTimeMillis()+60000))));
        assertFalse(util().isTokenValid(signed("expected-issuer", "other", new Date(System.currentTimeMillis()+60000))));
    }
    @Test void acceptsValidTokens() {
        assertTrue(util().isTokenValid(signed("expected-issuer", "expected-audience", new Date(System.currentTimeMillis()+60000))));
    }
    @Test void rejectsShortSecretInsteadOfPaddingIt() {
        var jwt = util();
        ReflectionTestUtils.setField(jwt, "secret", "weak");
        assertFalse(jwt.isTokenValid("invalid-token"));
    }
}
