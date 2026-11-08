package com.qayem.hr.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import com.qayem.hr.entity.User;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID>, JpaSpecificationExecutor<User> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    boolean existsByUsernameAndIsDeletedFalse(String username);
    boolean existsByEmailAndIsDeletedFalse(String email);
    boolean existsByUsernameAndIsDeletedFalseAndIdNot(String username, UUID id);
    boolean existsByEmailAndIsDeletedFalseAndIdNot(String email, UUID id);
    Optional<User> findByEmailAndIsDeletedTrue(String email);
}
