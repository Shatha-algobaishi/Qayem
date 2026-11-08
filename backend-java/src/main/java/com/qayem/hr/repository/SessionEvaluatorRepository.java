package com.qayem.hr.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.qayem.hr.entity.SessionEvaluator;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SessionEvaluatorRepository extends JpaRepository<SessionEvaluator, UUID> {
    List<SessionEvaluator> findBySessionIdAndIsActiveTrue(UUID sessionId);
    Optional<SessionEvaluator> findBySessionIdAndUserId(UUID sessionId, UUID userId);
    boolean existsBySessionIdAndUserIdAndIsActiveTrue(UUID sessionId, UUID userId);
    boolean existsBySessionIdAndUserIdAndIsActive(UUID sessionId, UUID userId, boolean isActive);
}
