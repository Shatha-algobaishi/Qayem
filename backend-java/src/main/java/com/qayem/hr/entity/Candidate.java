package com.qayem.hr.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import com.qayem.hr.enums.CandidateStatus;
import com.qayem.hr.enums.EvaluationDecision;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Entity
@Table(name = "candidates")
public class Candidate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @Column(name = "session_id")
    private UUID sessionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", insertable = false, updatable = false)
    @JsonIgnore
    private InterviewSession session;

    private String nationalId;

    @Column(nullable = false)
    private String fullNameAr;

    @Column(nullable = false)
    private String fullNameEn;

    private String firstNameAr;
    private String secondNameAr;
    private String lastNameAr;
    private String email;
    private String phoneNumber;
    private String qualification;
    private String specializationAr;
    private String specializationEn;
    private Short yearsOfExperience;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CandidateStatus candidateStatus = CandidateStatus.Pending;

    private BigDecimal aggregateScore;
    private BigDecimal highestScore;
    private BigDecimal lowestScore;
    private BigDecimal scoreVariance;
    private boolean hasDiscrepancy = false;

    @Enumerated(EnumType.STRING)
    private EvaluationDecision systemDecision;

    @Enumerated(EnumType.STRING)
    private EvaluationDecision finalDecision;

    @Column(columnDefinition = "TEXT")
    private String overrideReason;

    private UUID overriddenBy;
    private LocalDateTime overriddenAt;

    @Column(columnDefinition = "TEXT")
    private String aiSummary;

    @Column(columnDefinition = "TEXT")
    private String notes;

    private String applicationType;
    private BigDecimal gpa;
    private String gpaSystem;
    private String university;
    private String currentEmployer;
    private String currentTitle;
    private LocalDateTime interviewScheduledAt;
    private String interviewLocation;
    private String cvFilePath;
    private String cvOriginalName;
    private LocalDateTime cvUploadedAt;

    @Column(nullable = false)
    private UUID registeredBy;

    @Column(nullable = false, updatable = false)
    private LocalDateTime registeredAt = LocalDateTime.now();

    @OneToMany(mappedBy = "candidate", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<Evaluation> evaluations = new ArrayList<>();

    @OneToMany(mappedBy = "candidate", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<CandidateEvaluator> assignedEvaluators = new ArrayList<>();

    protected Candidate() {}

    public static Candidate create(UUID sessionId, String nationalId, String fullNameAr, String fullNameEn,
                                   UUID registeredBy, String email, String phoneNumber, String qualification,
                                   String specializationAr, String specializationEn, Short yearsOfExperience,
                                   String notes, String applicationType, BigDecimal gpa, String gpaSystem,
                                   String university, String currentEmployer, String currentTitle,
                                   String firstNameAr, String secondNameAr, String lastNameAr) {
        Candidate c = new Candidate();
        c.sessionId = sessionId;
        c.nationalId = nationalId;
        c.registeredBy = registeredBy;
        c.email = email;
        c.phoneNumber = phoneNumber;
        c.qualification = qualification;
        c.specializationAr = specializationAr;
        c.specializationEn = specializationEn;
        c.yearsOfExperience = yearsOfExperience;
        c.notes = notes;
        c.applicationType = applicationType;
        c.gpa = gpa;
        c.gpaSystem = gpaSystem;
        c.university = university;
        c.currentEmployer = currentEmployer;
        c.currentTitle = currentTitle;
        c.firstNameAr = firstNameAr;
        c.secondNameAr = secondNameAr;
        c.lastNameAr = lastNameAr;
        c.fullNameAr = buildFullNameAr(firstNameAr, secondNameAr, lastNameAr, fullNameAr);
        c.fullNameEn = fullNameEn;
        return c;
    }

    private static String buildFullNameAr(String first, String second, String last, String fallback) {
        String built = Stream.of(first, second, last)
                .filter(p -> p != null && !p.isBlank())
                .collect(Collectors.joining(" "));
        return built.isBlank() ? fallback : built;
    }

    public void assignSession(UUID sessionId) { this.sessionId = sessionId; }

    public void update(String fullNameAr, String fullNameEn, String email, String phoneNumber,
                       String qualification, String specializationAr, String specializationEn,
                       Short yearsOfExperience, String notes, String applicationType,
                       BigDecimal gpa, String gpaSystem, String university,
                       String currentEmployer, String currentTitle,
                       String firstNameAr, String secondNameAr, String lastNameAr, String nationalId) {
        this.nationalId = nationalId;
        this.firstNameAr = firstNameAr;
        this.secondNameAr = secondNameAr;
        this.lastNameAr = lastNameAr;
        this.fullNameAr = buildFullNameAr(firstNameAr, secondNameAr, lastNameAr, fullNameAr);
        this.fullNameEn = fullNameEn;
        this.email = email;
        this.phoneNumber = phoneNumber;
        this.qualification = qualification;
        this.specializationAr = specializationAr;
        this.specializationEn = specializationEn;
        this.yearsOfExperience = yearsOfExperience;
        this.notes = notes;
        this.applicationType = applicationType;
        this.gpa = gpa;
        this.gpaSystem = gpaSystem;
        this.university = university;
        this.currentEmployer = currentEmployer;
        this.currentTitle = currentTitle;
    }

    public void scheduleInterview(LocalDateTime scheduledAt, String location) {
        this.interviewScheduledAt = scheduledAt;
        this.interviewLocation = location;
    }

    public void attachCv(String filePath, String originalName) {
        this.cvFilePath = filePath;
        this.cvOriginalName = originalName;
        this.cvUploadedAt = LocalDateTime.now();
    }

    public void removeCv() {
        this.cvFilePath = null;
        this.cvOriginalName = null;
        this.cvUploadedAt = null;
    }

    public void updateAggregateScore(BigDecimal avg, BigDecimal highest, BigDecimal lowest,
                                     BigDecimal discrepancyThreshold, BigDecimal notQualifiedMax,
                                     BigDecimal conditionalMax) {
        this.aggregateScore = avg;
        this.highestScore = highest;
        this.lowestScore = lowest;
        this.scoreVariance = highest.subtract(lowest);
        this.hasDiscrepancy = this.scoreVariance.compareTo(discrepancyThreshold) > 0;
        this.systemDecision = classifyScore(avg, notQualifiedMax, conditionalMax);
    }

    public void applyManagerDecision(EvaluationDecision decision, String reason, UUID managerId) {
        this.finalDecision = decision;
        boolean override = systemDecision != null && decision != systemDecision;
        this.overrideReason = override ? reason : null;
        this.overriddenBy = override ? managerId : null;
        this.overriddenAt = override ? LocalDateTime.now() : null;
    }

    public void setAiSummary(String summary) { this.aiSummary = summary; }

    public void resetAggregateScore() {
        this.aggregateScore = null;
        this.highestScore = null;
        this.lowestScore = null;
        this.scoreVariance = null;
        this.hasDiscrepancy = false;
        this.systemDecision = null;
    }

    public void markInProgress()  { this.candidateStatus = CandidateStatus.InProgress; }
    public void resetToPending()  { this.candidateStatus = CandidateStatus.Pending; }
    public void markCompleted()   { this.candidateStatus = CandidateStatus.Completed; }

    public void clearFinalDecision() {
        this.finalDecision = null;
        this.overrideReason = null;
        this.overriddenBy = null;
        this.overriddenAt = null;
    }

    public static EvaluationDecision classifyScore(BigDecimal score, BigDecimal notQualifiedMax, BigDecimal conditionalMax) {
        if (score.compareTo(notQualifiedMax) <= 0) return EvaluationDecision.NotQualified;
        if (score.compareTo(conditionalMax) <= 0)  return EvaluationDecision.ConditionallyQualified;
        return EvaluationDecision.Recommended;
    }

    // Getters
    public UUID getId() { return id; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public UUID getSessionId() { return sessionId; }
    public InterviewSession getSession() { return session; }
    public String getNationalId() { return nationalId; }
    public String getFullNameAr() { return fullNameAr; }
    public String getFullNameEn() { return fullNameEn; }
    public String getFirstNameAr() { return firstNameAr; }
    public String getSecondNameAr() { return secondNameAr; }
    public String getLastNameAr() { return lastNameAr; }
    public String getEmail() { return email; }
    public String getPhoneNumber() { return phoneNumber; }
    public String getQualification() { return qualification; }
    public String getSpecializationAr() { return specializationAr; }
    public String getSpecializationEn() { return specializationEn; }
    public Short getYearsOfExperience() { return yearsOfExperience; }
    public CandidateStatus getCandidateStatus() { return candidateStatus; }
    public BigDecimal getAggregateScore() { return aggregateScore; }
    public BigDecimal getHighestScore() { return highestScore; }
    public BigDecimal getLowestScore() { return lowestScore; }
    public BigDecimal getScoreVariance() { return scoreVariance; }
    public boolean isHasDiscrepancy() { return hasDiscrepancy; }
    public EvaluationDecision getSystemDecision() { return systemDecision; }
    public EvaluationDecision getFinalDecision() { return finalDecision; }
    public String getOverrideReason() { return overrideReason; }
    public UUID getOverriddenBy() { return overriddenBy; }
    public LocalDateTime getOverriddenAt() { return overriddenAt; }
    public String getAiSummary() { return aiSummary; }
    public String getNotes() { return notes; }
    public String getApplicationType() { return applicationType; }
    public BigDecimal getGpa() { return gpa; }
    public String getGpaSystem() { return gpaSystem; }
    public String getUniversity() { return university; }
    public String getCurrentEmployer() { return currentEmployer; }
    public String getCurrentTitle() { return currentTitle; }
    public LocalDateTime getInterviewScheduledAt() { return interviewScheduledAt; }
    public String getInterviewLocation() { return interviewLocation; }
    public String getCvFilePath() { return cvFilePath; }
    public String getCvOriginalName() { return cvOriginalName; }
    public LocalDateTime getCvUploadedAt() { return cvUploadedAt; }
    public UUID getRegisteredBy() { return registeredBy; }
    public LocalDateTime getRegisteredAt() { return registeredAt; }
    public List<Evaluation> getEvaluations() { return evaluations; }
    public List<CandidateEvaluator> getAssignedEvaluators() { return assignedEvaluators; }
}
