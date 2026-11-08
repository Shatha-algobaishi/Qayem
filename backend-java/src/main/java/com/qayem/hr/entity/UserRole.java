package com.qayem.hr.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "user_roles",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "role_id"}))
public class UserRole {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "role_id", nullable = false)
    private UUID roleId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    @JsonIgnore
    private User user;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "role_id", insertable = false, updatable = false)
    private Role role;

    private UUID assignedBy;
    private boolean isPrimary = false;

    protected UserRole() {}

    public static UserRole create(UUID userId, UUID roleId, UUID assignedBy) {
        UserRole ur = new UserRole();
        ur.userId = userId;
        ur.roleId = roleId;
        ur.assignedBy = assignedBy;
        return ur;
    }

    public static UserRole createPrimary(UUID userId, UUID roleId, UUID assignedBy) {
        UserRole ur = create(userId, roleId, assignedBy);
        ur.isPrimary = true;
        return ur;
    }

    public UUID getId() { return id; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public UUID getUserId() { return userId; }
    public UUID getRoleId() { return roleId; }
    public User getUser() { return user; }
    public Role getRole() { return role; }
    public UUID getAssignedBy() { return assignedBy; }
    public boolean isPrimary() { return isPrimary; }
}
