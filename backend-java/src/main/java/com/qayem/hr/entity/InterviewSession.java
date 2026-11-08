package com.qayem.hr.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import com.qayem.hr.enums.SessionStatus;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "interview_sessions")
public class InterviewSession {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @Column(nullable = false, unique = true)
    private String sessionCode;

    @Column(nullable = false)
    private String titleAr;

    @Column(nullable = false)
    private String titleEn;

    @Column(nullable = false)
    private String jobPositionAr;

    @Column(nullable = false)
    private String jobPositionEn;

    @Column(nullable = false)
    private String department;

    private String generalDepartment;
    private String agency;
    private LocalDateTime scheduledDate;
    private String location;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SessionStatus status = SessionStatus.Active;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(nullable = false)
    private UUID createdBy;

    private UUID closedBy;
    private LocalDateTime closedAt;

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<SessionEvaluator> evaluators = new ArrayList<>();

    @OneToMany(mappedBy = "session", fetch = FetchType.LAZY)
    @JsonIgnore
    private List<Candidate> candidates = new ArrayList<>();

    protected InterviewSession() {}

    public static InterviewSession create(String sessionCode, String titleAr, String titleEn,
                                          String jobPositionAr, String jobPositionEn, String department,
                                          UUID createdBy, LocalDateTime scheduledDate, String location,
                                          String notes, String agency, String generalDepartment) {
        InterviewSession s = new InterviewSession();
        s.sessionCode = sessionCode;
        s.titleAr = titleAr;
        s.titleEn = titleEn;
        s.jobPositionAr = jobPositionAr;
        s.jobPositionEn = jobPositionEn;
        s.department = department;
        s.createdBy = createdBy;
        s.scheduledDate = scheduledDate;
        s.location = location;
        s.notes = notes;
        s.agency = agency;
        s.generalDepartment = generalDepartment;
        return s;
    }

    public void activate() { this.status = SessionStatus.Active; }

    public void close(UUID closedBy) {
        this.status = SessionStatus.Closed;
        this.closedBy = closedBy;
        this.closedAt = LocalDateTime.now();
    }

    public void reopen() {
        this.status = SessionStatus.Active;
        this.closedBy = null;
        this.closedAt = null;
    }

    public void update(String titleAr, String titleEn, String jobPositionAr, String jobPositionEn,
                       String department, LocalDateTime scheduledDate, String location, String notes,
                       String agency, String generalDepartment) {
        this.titleAr = titleAr;
        this.titleEn = titleEn;
        this.jobPositionAr = jobPositionAr;
        this.jobPositionEn = jobPositionEn;
        this.department = department;
        this.generalDepartment = generalDepartment;
        this.agency = agency;
        this.scheduledDate = scheduledDate;
        this.location = location;
        this.notes = notes;
    }

    public UUID getId() { return id; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public String getSessionCode() { return sessionCode; }
    public String getTitleAr() { return titleAr; }
    public String getTitleEn() { return titleEn; }
    public String getJobPositionAr() { return jobPositionAr; }
    public String getJobPositionEn() { return jobPositionEn; }
    public String getDepartment() { return department; }
    public String getGeneralDepartment() { return generalDepartment; }
    public String getAgency() { return agency; }
    public LocalDateTime getScheduledDate() { return scheduledDate; }
    public String getLocation() { return location; }
    public SessionStatus getStatus() { return status; }
    public String getNotes() { return notes; }
    public UUID getCreatedBy() { return createdBy; }
    public UUID getClosedBy() { return closedBy; }
    public LocalDateTime getClosedAt() { return closedAt; }
    public List<SessionEvaluator> getEvaluators() { return evaluators; }
    public List<Candidate> getCandidates() { return candidates; }
}
