package com.qayem.hr.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "system_settings")
public class SystemSetting {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @Column(nullable = false, unique = true)
    private String key;

    @Column(nullable = false)
    private String value;

    private String description;
    private String descriptionAr;
    private String dataType;

    protected SystemSetting() {}

    public static SystemSetting create(String key, String value, String description, String descriptionAr, String dataType) {
        SystemSetting s = new SystemSetting();
        s.key = key;
        s.value = value;
        s.description = description;
        s.descriptionAr = descriptionAr;
        s.dataType = dataType;
        return s;
    }

    public void updateValue(String value) { this.value = value; }

    public UUID getId() { return id; }
    public String getKey() { return key; }
    public String getValue() { return value; }
    public String getDescription() { return description; }
    public String getDescriptionAr() { return descriptionAr; }
    public String getDataType() { return dataType; }
}
