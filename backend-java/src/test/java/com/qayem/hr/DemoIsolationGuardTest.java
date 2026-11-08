package com.qayem.hr;
import com.qayem.hr.config.DemoIsolationGuard;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import static org.junit.jupiter.api.Assertions.*;
class DemoIsolationGuardTest {
 @Test void refusesPersistentDatabases() {
  assertThrows(IllegalStateException.class,()->new DemoIsolationGuard(new MockEnvironment().withProperty("spring.datasource.url","jdbc:postgresql://localhost/operational")).run(null));
  assertDoesNotThrow(()->new DemoIsolationGuard(new MockEnvironment().withProperty("spring.datasource.url","jdbc:h2:mem:isolated")).run(null));
 }
}
