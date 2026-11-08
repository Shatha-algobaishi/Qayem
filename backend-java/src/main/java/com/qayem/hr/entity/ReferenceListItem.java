package com.qayem.hr.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "reference_list_items")
public class ReferenceListItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @Column(name = "list_id", nullable = false)
    private UUID listId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "list_id", insertable = false, updatable = false)
    @JsonIgnore
    private ReferenceList referenceList;

    @Column(nullable = false)
    private String valueAr;

    private String valueEn;

    @Column(nullable = false)
    private int orderIndex;

    private boolean isActive = true;

    protected ReferenceListItem() {}

    public static ReferenceListItem create(UUID listId, String valueAr, String valueEn, int orderIndex) {
        ReferenceListItem i = new ReferenceListItem();
        i.listId = listId;
        i.valueAr = valueAr;
        i.valueEn = valueEn;
        i.orderIndex = orderIndex;
        return i;
    }

    public void update(String valueAr, String valueEn, int orderIndex) {
        this.valueAr = valueAr;
        this.valueEn = valueEn;
        this.orderIndex = orderIndex;
    }

    public void deactivate() { this.isActive = false; }

    public UUID getId() { return id; }
    public UUID getListId() { return listId; }
    public String getValueAr() { return valueAr; }
    public String getValueEn() { return valueEn; }
    public int getOrderIndex() { return orderIndex; }
    public boolean isActive() { return isActive; }
}
