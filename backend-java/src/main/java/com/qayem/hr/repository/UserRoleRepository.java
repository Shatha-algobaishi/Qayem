package com.qayem.hr.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.qayem.hr.entity.UserRole;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRoleRepository extends JpaRepository<UserRole, UUID> {
    List<UserRole> findByUserId(UUID userId);
    Optional<UserRole> findByUserIdAndIsPrimaryTrue(UUID userId);
    boolean existsByUserIdAndRoleId(UUID userId, UUID roleId);
    Optional<UserRole> findByUserIdAndRoleId(UUID userId, UUID roleId);
    boolean existsByUserIdAndRoleIdAndIsPrimaryTrue(UUID userId, UUID roleId);
}
