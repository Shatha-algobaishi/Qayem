package com.qayem.hr.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import com.qayem.hr.entity.InterviewSession;

import java.util.UUID;

public interface SessionRepository extends JpaRepository<InterviewSession, UUID>, JpaSpecificationExecutor<InterviewSession> {
    long count();
}
