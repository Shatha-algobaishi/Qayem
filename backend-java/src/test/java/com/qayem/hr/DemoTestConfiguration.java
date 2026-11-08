package com.qayem.hr;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.util.UUID;

abstract class DemoTestConfiguration {
    static final String DEMO_PASSWORD = UUID.randomUUID().toString();
    static final String ACCOUNT_PASSWORD = UUID.randomUUID().toString();
    @DynamicPropertySource
    static void demoProperties(DynamicPropertyRegistry registry) {
        registry.add("app.demo-password", () -> DEMO_PASSWORD);
    }
}
