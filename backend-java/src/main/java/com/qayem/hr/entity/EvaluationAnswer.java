package com.qayem.hr.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "evaluation_answers",
       uniqueConstraints = @UniqueConstraint(columnNames = {"evaluation_id", "question_id"}))
public class EvaluationAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "evaluation_id", nullable = false)
    private UUID evaluationId;

    @Column(name = "question_id", nullable = false)
    private UUID questionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "evaluation_id", insertable = false, updatable = false)
    @JsonIgnore
    private Evaluation evaluation;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "question_id", insertable = false, updatable = false)
    private Question question;

    @Column(nullable = false)
    private int score;

    @Column(columnDefinition = "TEXT")
    private String comment;

    protected EvaluationAnswer() {}

    public static EvaluationAnswer create(UUID evaluationId, UUID questionId, int score, String comment) {
        EvaluationAnswer a = new EvaluationAnswer();
        a.evaluationId = evaluationId;
        a.questionId = questionId;
        a.score = score;
        a.comment = comment;
        return a;
    }

    public UUID getId() { return id; }
    public UUID getEvaluationId() { return evaluationId; }
    public UUID getQuestionId() { return questionId; }
    public Evaluation getEvaluation() { return evaluation; }
    public Question getQuestion() { return question; }
    public int getScore() { return score; }
    public String getComment() { return comment; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
