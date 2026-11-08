package com.qayem.hr.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import com.qayem.hr.entity.Evaluation;
import com.qayem.hr.enums.EvaluationStatus;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EvaluationRepository extends JpaRepository<Evaluation, UUID> {
    List<Evaluation> findByEvaluatorIdOrderByCreatedAtDesc(UUID evaluatorId);
    List<Evaluation> findByCandidateId(UUID candidateId);
    Optional<Evaluation> findByCandidateIdAndEvaluatorId(UUID candidateId, UUID evaluatorId);
    List<Evaluation> findByCandidateIdAndStatusNot(UUID candidateId, EvaluationStatus status);
    List<Evaluation> findBySessionId(UUID sessionId);
    @Query("SELECT COUNT(e) FROM EvaluationAnswer e WHERE e.questionId = :questionId")
    long countAnswersByQuestionId(UUID questionId);
}
