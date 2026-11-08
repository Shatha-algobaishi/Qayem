package com.qayem.hr.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import com.qayem.hr.entity.Notification;

import java.util.Optional;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {
    Page<Notification> findByUserId(UUID userId, Pageable pageable);
    Page<Notification> findByUserIdAndIsReadFalse(UUID userId, Pageable pageable);
    long countByUserIdAndIsReadFalse(UUID userId);
    Optional<Notification> findByIdAndUserId(UUID id, UUID userId);
}
