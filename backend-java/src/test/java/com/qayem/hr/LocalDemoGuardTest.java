package com.qayem.hr;

import com.qayem.hr.config.LocalDemoGuard;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import static org.junit.jupiter.api.Assertions.*;

class LocalDemoGuardTest {
    @Test void editableDemoCannotBindToAllInterfaces() {
        assertThrows(IllegalStateException.class,()->new LocalDemoGuard(new MockEnvironment().withProperty("server.address","0.0.0.0")).run(null));
        assertDoesNotThrow(()->new LocalDemoGuard(new MockEnvironment().withProperty("server.address","127.0.0.1")).run(null));
    }
}
