package com.qayem.hr.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import com.qayem.hr.entity.ReferenceListItem;

import java.util.List;
import java.util.UUID;

public interface ReferenceListItemRepository extends JpaRepository<ReferenceListItem, UUID> {
    List<ReferenceListItem> findByListIdAndIsActiveTrueOrderByOrderIndex(UUID listId);

    @Query("SELECT MAX(i.orderIndex) FROM ReferenceListItem i WHERE i.listId = :listId")
    Integer findMaxOrderIndex(UUID listId);
}
