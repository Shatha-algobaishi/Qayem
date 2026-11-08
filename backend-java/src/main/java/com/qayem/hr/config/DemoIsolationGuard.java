package com.qayem.hr.config;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
/** The visitor login must never operate against a persistent operational database. */
@Component @Profile("demo") @Order(-2)
public class DemoIsolationGuard implements ApplicationRunner {
    private final Environment environment;
    public DemoIsolationGuard(Environment environment) {this.environment=environment;}
    @Override public void run(ApplicationArguments args) {
        if (!environment.getProperty("spring.datasource.url", "").startsWith("jdbc:h2:mem:"))
            throw new IllegalStateException("Demo requires an isolated in-memory H2 datasource.");
    }
}
