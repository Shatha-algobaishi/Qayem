package com.qayem.hr.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.qayem.hr.entity.SystemSetting;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SystemSettingRepository extends JpaRepository<SystemSetting, UUID> {
    Optional<SystemSetting> findByKey(String key);
    List<SystemSetting> findByKeyIn(List<String> keys);
    boolean existsByKey(String key);
}
