package com.qayem.hr.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "candidate_evaluators",
       uniqueConstraints = @UniqueConstraint(columnNames = {"candidate_id", "user_id"}))
public class CandidateEvaluator {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "candidate_id", nullable = false)
    private UUID candidateId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidate_id", insertable = false, updatable = false)
    @JsonIgnore
    private Candidate candidate;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    private UUID assignedBy;

    protected CandidateEvaluator() {}

    public static CandidateEvaluator create(UUID candidateId, UUID userId, UUID assignedBy) {
        CandidateEvaluator ce = new CandidateEvaluator();
        ce.candidateId = candidateId;
        ce.userId = userId;
        ce.assignedBy = assignedBy;
        return ce;
    }

    public UUID getId() { return id; }
    public UUID getCandidateId() { return candidateId; }
    public UUID getUserId() { return userId; }
    public Candidate getCandidate() { return candidate; }
    public User getUser() { return user; }
    public UUID getAssignedBy() { return assignedBy; }
    public LocalDateTime getAssignedAt() { return createdAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
