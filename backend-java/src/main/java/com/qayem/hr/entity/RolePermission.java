package com.qayem.hr.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "role_permissions")
public class RolePermission extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "role_id", nullable = false)
    private Role role;

    @Column(nullable = false)
    private String permission;

    protected RolePermission() {}

    public static RolePermission create(Role role, String permission) {
        RolePermission rp = new RolePermission();
        rp.role = role;
        rp.permission = permission;
        return rp;
    }

    public Role getRole() { return role; }
    public String getPermission() { return permission; }
}
