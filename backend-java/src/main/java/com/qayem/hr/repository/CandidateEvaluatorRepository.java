package com.qayem.hr.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.qayem.hr.entity.CandidateEvaluator;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CandidateEvaluatorRepository extends JpaRepository<CandidateEvaluator, UUID> {
    List<CandidateEvaluator> findByCandidateId(UUID candidateId);
    Optional<CandidateEvaluator> findByCandidateIdAndUserId(UUID candidateId, UUID userId);
    boolean existsByCandidateIdAndUserId(UUID candidateId, UUID userId);
    long countByCandidateId(UUID candidateId);
    boolean existsByUserId(UUID userId);
    List<CandidateEvaluator> findByUserId(UUID userId);
}
