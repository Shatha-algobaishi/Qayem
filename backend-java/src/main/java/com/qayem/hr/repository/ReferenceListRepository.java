package com.qayem.hr.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.qayem.hr.entity.ReferenceList;

import java.util.Optional;
import java.util.UUID;

public interface ReferenceListRepository extends JpaRepository<ReferenceList, UUID> {
    Optional<ReferenceList> findByListName(String listName);
}
