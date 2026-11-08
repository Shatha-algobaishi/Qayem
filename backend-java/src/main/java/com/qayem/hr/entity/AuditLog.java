package com.qayem.hr.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "audit_logs")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime timestamp;

    @Column(nullable = false)
    private String action;

    @Column(nullable = false)
    private String entityType;

    private String entityId;

    @Column(nullable = false)
    private UUID userId;

    @Column(columnDefinition = "TEXT")
    private String oldValues;

    @Column(columnDefinition = "TEXT")
    private String newValues;

    private String ipAddress;

    protected AuditLog() {}

    public static AuditLog create(String action, String entityType, String entityId, UUID userId) {
        return create(action, entityType, entityId, userId, null, null, null);
    }

    public static AuditLog create(String action, String entityType, String entityId, UUID userId,
                                   String oldValues, String newValues, String ipAddress) {
        AuditLog a = new AuditLog();
        a.action = action;
        a.entityType = entityType;
        a.entityId = entityId;
        a.userId = userId;
        a.oldValues = oldValues;
        a.newValues = newValues;
        a.ipAddress = ipAddress;
        return a;
    }

    public UUID getId() { return id; }
    public LocalDateTime getTimestamp() { return timestamp; }
    public String getAction() { return action; }
    public String getEntityType() { return entityType; }
    public String getEntityId() { return entityId; }
    public UUID getUserId() { return userId; }
    public String getOldValues() { return oldValues; }
    public String getNewValues() { return newValues; }
    public String getIpAddress() { return ipAddress; }
}
