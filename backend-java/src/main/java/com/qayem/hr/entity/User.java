package com.qayem.hr.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @Column(nullable = false)
    private String fullNameAr;

    @Column(nullable = false)
    private String fullNameEn;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(nullable = false)
    @JsonIgnore
    private String passwordHash;

    @Column(name = "role_id", nullable = false)
    private UUID roleId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "role_id", insertable = false, updatable = false)
    private Role role;

    private String department;
    private String jobTitle;
    private String phoneNumber;
    private boolean isActive = true;
    private LocalDateTime lastLoginAt;
    private UUID createdBy;
    private boolean isDeleted = false;
    private LocalDateTime deletedAt;
    private UUID deletedBy;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JsonIgnore
    private List<RefreshToken> refreshTokens = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JsonIgnore
    private List<UserRole> userRoles = new ArrayList<>();

    protected User() {}

    public static User create(String fullNameAr, String fullNameEn, String email, String username,
                               String passwordHash, UUID roleId, UUID createdBy,
                               String department, String jobTitle, String phoneNumber) {
        User u = new User();
        u.fullNameAr = fullNameAr;
        u.fullNameEn = fullNameEn;
        u.email = email.toLowerCase();
        u.username = username.toLowerCase();
        u.passwordHash = passwordHash;
        u.roleId = roleId;
        u.createdBy = createdBy;
        u.department = department;
        u.jobTitle = jobTitle;
        u.phoneNumber = phoneNumber;
        return u;
    }

    public void updateProfile(String fullNameAr, String fullNameEn, String department, String jobTitle) {
        this.fullNameAr = fullNameAr;
        this.fullNameEn = fullNameEn;
        this.department = department;
        this.jobTitle = jobTitle;
    }

    public void updateContact(String email, String username) {
        this.email = email.toLowerCase();
        this.username = username.toLowerCase();
    }

    public void setPasswordHash(String hash) { this.passwordHash = hash; }
    public void activate()   { this.isActive = true; }
    public void deactivate() { this.isActive = false; }
    public void recordLogin() { this.lastLoginAt = LocalDateTime.now(); }
    public void changeRole(UUID newRoleId) { this.roleId = newRoleId; }

    public void softDelete(UUID deletedBy) {
        this.isDeleted = true;
        this.deletedAt = LocalDateTime.now();
        this.deletedBy = deletedBy;
        this.isActive = false;
    }

    public void restore(String fullNameAr, String fullNameEn, String username, String passwordHash,
                        UUID roleId, UUID restoredBy, String department, String jobTitle) {
        this.fullNameAr = fullNameAr;
        this.fullNameEn = fullNameEn;
        this.username = username;
        this.passwordHash = passwordHash;
        this.roleId = roleId;
        this.department = department;
        this.jobTitle = jobTitle;
        this.isDeleted = false;
        this.deletedAt = null;
        this.deletedBy = null;
        this.isActive = true;
    }

    // Getters
    public UUID getId() { return id; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public String getFullNameAr() { return fullNameAr; }
    public String getFullNameEn() { return fullNameEn; }
    public String getEmail() { return email; }
    public String getUsername() { return username; }
    public String getPasswordHash() { return passwordHash; }
    public UUID getRoleId() { return roleId; }
    public Role getRole() { return role; }
    public String getDepartment() { return department; }
    public String getJobTitle() { return jobTitle; }
    public String getPhoneNumber() { return phoneNumber; }
    public boolean isActive() { return isActive; }
    public LocalDateTime getLastLoginAt() { return lastLoginAt; }
    public UUID getCreatedBy() { return createdBy; }
    public boolean isDeleted() { return isDeleted; }
    public LocalDateTime getDeletedAt() { return deletedAt; }
    public UUID getDeletedBy() { return deletedBy; }
    public List<RefreshToken> getRefreshTokens() { return refreshTokens; }
    public List<UserRole> getUserRoles() { return userRoles; }
}
