package com.qayem.hr.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "notifications")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String titleAr;

    @Column(nullable = false)
    private String titleEn;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String messageAr;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String messageEn;

    private String type;
    private boolean isRead = false;
    private String entityType;
    private String entityId;

    protected Notification() {}

    public static Notification create(UUID userId, String titleAr, String titleEn,
                                       String messageAr, String messageEn,
                                       String type, String entityType, String entityId) {
        Notification n = new Notification();
        n.userId = userId;
        n.titleAr = titleAr;
        n.titleEn = titleEn;
        n.messageAr = messageAr;
        n.messageEn = messageEn;
        n.type = type;
        n.entityType = entityType;
        n.entityId = entityId;
        return n;
    }

    public void markRead() { this.isRead = true; }

    public UUID getId() { return id; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public UUID getUserId() { return userId; }
    public String getTitleAr() { return titleAr; }
    public String getTitleEn() { return titleEn; }
    public String getMessageAr() { return messageAr; }
    public String getMessageEn() { return messageEn; }
    public String getType() { return type; }
    public boolean isRead() { return isRead; }
    public String getEntityType() { return entityType; }
    public String getEntityId() { return entityId; }
}
