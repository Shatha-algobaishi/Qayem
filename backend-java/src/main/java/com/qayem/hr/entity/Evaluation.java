package com.qayem.hr.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import com.qayem.hr.enums.EvaluationDecision;
import com.qayem.hr.enums.EvaluationStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "evaluations")
public class Evaluation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @Column(name = "candidate_id", nullable = false)
    private UUID candidateId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidate_id", insertable = false, updatable = false)
    @JsonIgnore
    private Candidate candidate;

    @Column(name = "session_id")
    private UUID sessionId;

    @Column(name = "evaluator_id", nullable = false)
    private UUID evaluatorId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "evaluator_id", insertable = false, updatable = false)
    private User evaluator;

    private Integer totalScore;

    @Enumerated(EnumType.STRING)
    private EvaluationDecision systemDecision;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EvaluationStatus status = EvaluationStatus.Draft;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(columnDefinition = "TEXT")
    private String aiSummary;

    private LocalDateTime submittedAt;

    @OneToMany(mappedBy = "evaluation", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<EvaluationAnswer> answers = new ArrayList<>();

    protected Evaluation() {}

    public static Evaluation create(UUID candidateId, UUID sessionId, UUID evaluatorId) {
        Evaluation e = new Evaluation();
        e.candidateId = candidateId;
        e.sessionId = sessionId;
        e.evaluatorId = evaluatorId;
        return e;
    }

    public void submit(int expectedAnswerCount, BigDecimal notQualifiedMax, BigDecimal conditionalMax) {
        if (status != EvaluationStatus.Draft)
            throw new IllegalStateException("Evaluation is already submitted.");
        if (answers.size() != expectedAnswerCount)
            throw new IllegalArgumentException(
                "All " + expectedAnswerCount + " questions must be answered before submitting.");

        int total = answers.stream().mapToInt(EvaluationAnswer::getScore).sum();
        this.totalScore = total;
        this.systemDecision = Candidate.classifyScore(BigDecimal.valueOf(total), notQualifiedMax, conditionalMax);
        this.status = EvaluationStatus.Submitted;
        this.submittedAt = LocalDateTime.now();
    }

    public void markReviewed() { this.status = EvaluationStatus.ReviewedByManager; }
    public void setNotes(String notes) { this.notes = notes; }
    public void setAiSummary(String aiSummary) { this.aiSummary = aiSummary; }

    public UUID getId() { return id; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public UUID getCandidateId() { return candidateId; }
    public Candidate getCandidate() { return candidate; }
    public UUID getSessionId() { return sessionId; }
    public UUID getEvaluatorId() { return evaluatorId; }
    public User getEvaluator() { return evaluator; }
    public Integer getTotalScore() { return totalScore; }
    public EvaluationDecision getSystemDecision() { return systemDecision; }
    public EvaluationStatus getStatus() { return status; }
    public String getNotes() { return notes; }
    public String getAiSummary() { return aiSummary; }
    public LocalDateTime getSubmittedAt() { return submittedAt; }
    public List<EvaluationAnswer> getAnswers() { return answers; }
}
