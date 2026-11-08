package com.qayem.hr.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.qayem.hr.entity.EvaluationAnswer;

import java.util.List;
import java.util.UUID;

public interface EvaluationAnswerRepository extends JpaRepository<EvaluationAnswer, UUID> {
    List<EvaluationAnswer> findByEvaluationId(UUID evaluationId);
    void deleteByEvaluationId(UUID evaluationId);
    boolean existsByQuestionId(UUID questionId);
}
