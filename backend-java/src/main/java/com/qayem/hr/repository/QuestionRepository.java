package com.qayem.hr.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.qayem.hr.entity.Question;

import java.util.List;
import java.util.UUID;

public interface QuestionRepository extends JpaRepository<Question, UUID> {
    List<Question> findByIsActiveTrueOrderByOrderIndex();
    List<Question> findAllByOrderByOrderIndex();
    boolean existsByOrderIndex(int orderIndex);
    long countByIsActiveTrue();
}
