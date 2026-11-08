package com.qayem.hr.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import com.qayem.hr.entity.Candidate;

import java.util.Optional;
import java.util.UUID;

public interface CandidateRepository extends JpaRepository<Candidate, UUID>, JpaSpecificationExecutor<Candidate> {
    boolean existsByNationalId(String nationalId);
    boolean existsByNationalIdAndIdNot(String nationalId, UUID id);
    Optional<Candidate> findByNationalId(String nationalId);
    long countBySessionId(UUID sessionId);
}
