package com.qayem.hr.entity;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "roles")
public class Role extends BaseEntity {

    @Column(nullable = false, unique = true)
    private String name;

    @Column(nullable = false)
    private String nameAr;

    private String description;

    @OneToMany(mappedBy = "role", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RolePermission> permissions = new ArrayList<>();

    protected Role() {}

    public static Role create(String name, String nameAr, String description) {
        Role r = new Role();
        r.name = name;
        r.nameAr = nameAr;
        r.description = description;
        return r;
    }

    public String getName() { return name; }
    public String getNameAr() { return nameAr; }
    public String getDescription() { return description; }
    public List<RolePermission> getPermissions() { return permissions; }
}
