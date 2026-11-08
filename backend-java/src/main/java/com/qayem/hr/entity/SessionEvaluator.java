package com.qayem.hr.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "session_evaluators",
       uniqueConstraints = @UniqueConstraint(columnNames = {"session_id", "user_id"}))
public class SessionEvaluator {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", insertable = false, updatable = false)
    @JsonIgnore
    private InterviewSession session;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    private UUID assignedBy;
    private boolean isActive = true;

    protected SessionEvaluator() {}

    public static SessionEvaluator create(UUID sessionId, UUID userId, UUID assignedBy) {
        SessionEvaluator se = new SessionEvaluator();
        se.sessionId = sessionId;
        se.userId = userId;
        se.assignedBy = assignedBy;
        return se;
    }

    public void deactivate() { this.isActive = false; }

    public UUID getId() { return id; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public UUID getSessionId() { return sessionId; }
    public UUID getUserId() { return userId; }
    public InterviewSession getSession() { return session; }
    public User getUser() { return user; }
    public UUID getAssignedBy() { return assignedBy; }
    public boolean isActive() { return isActive; }
    // Alias used in controller
    public LocalDateTime getAssignedAt() { return createdAt; }
}
