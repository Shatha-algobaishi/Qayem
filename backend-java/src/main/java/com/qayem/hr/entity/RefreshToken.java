package com.qayem.hr.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "refresh_tokens")
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    @JsonIgnore
    private User user;

    @Column(nullable = false, unique = true)
    private String token;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    private LocalDateTime revokedAt;
    private String replacedByToken;

    protected RefreshToken() {}

    public static RefreshToken create(UUID userId, String token, LocalDateTime expiresAt) {
        RefreshToken rt = new RefreshToken();
        rt.userId = userId;
        rt.token = token;
        rt.expiresAt = expiresAt;
        return rt;
    }

    public void revoke() { this.revokedAt = LocalDateTime.now(); }
    public boolean isExpired() { return LocalDateTime.now().isAfter(expiresAt); }
    public boolean isRevoked() { return revokedAt != null; }
    public boolean isActive() { return !isRevoked() && !isExpired(); }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public User getUser() { return user; }
    public String getToken() { return token; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public LocalDateTime getRevokedAt() { return revokedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
