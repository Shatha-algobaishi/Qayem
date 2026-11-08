package com.qayem.hr.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "questions")
public class Question {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String textAr;

    @Column(columnDefinition = "TEXT")
    private String textEn;

    private String category;

    @Column(nullable = false)
    private int orderIndex;

    @Column(nullable = false)
    private int maxScore = 5;

    private boolean isActive = true;

    protected Question() {}

    public static Question create(String textAr, String textEn, int orderIndex, String category, int maxScore) {
        Question q = new Question();
        q.textAr = textAr;
        q.textEn = textEn;
        q.orderIndex = orderIndex;
        q.category = category;
        q.maxScore = maxScore;
        return q;
    }

    public void update(String textAr, String textEn, String category, int maxScore) {
        this.textAr = textAr;
        this.textEn = textEn;
        this.category = category;
        this.maxScore = maxScore;
    }

    public void activate()   { this.isActive = true; }
    public void deactivate() { this.isActive = false; }
    public void reorder(int newIndex) { this.orderIndex = newIndex; }

    public UUID getId() { return id; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public String getTextAr() { return textAr; }
    public String getTextEn() { return textEn; }
    public String getCategory() { return category; }
    public int getOrderIndex() { return orderIndex; }
    public int getMaxScore() { return maxScore; }
    public boolean isActive() { return isActive; }
}
