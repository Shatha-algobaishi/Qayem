package com.qayem.hr.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "reference_lists")
public class ReferenceList {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false, unique = true)
    private String listName;

    @Column(nullable = false)
    private String labelAr;

    private String labelEn;
    private boolean isActive = true;

    @OneToMany(mappedBy = "referenceList", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<ReferenceListItem> items = new ArrayList<>();

    protected ReferenceList() {}

    public static ReferenceList create(String listName, String labelAr, String labelEn) {
        ReferenceList r = new ReferenceList();
        r.listName = listName;
        r.labelAr = labelAr;
        r.labelEn = labelEn;
        return r;
    }

    public UUID getId() { return id; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public String getListName() { return listName; }
    public String getLabelAr() { return labelAr; }
    public String getLabelEn() { return labelEn; }
    public boolean isActive() { return isActive; }
    public List<ReferenceListItem> getItems() { return items; }
}
