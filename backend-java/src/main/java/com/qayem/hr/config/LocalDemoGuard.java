package com.qayem.hr.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/** Editable fictional data must never be exposed as a public visitor demo. */
@Component
@Profile("demo-local")
@Order(-1)
public class LocalDemoGuard implements ApplicationRunner {
    private final Environment environment;
    public LocalDemoGuard(Environment environment) { this.environment = environment; }
    @Override
    public void run(ApplicationArguments args) {
        String address = environment.getProperty("server.address", "");
        if (!address.equals("127.0.0.1") && !address.equals("::1"))
            throw new IllegalStateException("Local practice must bind to a loopback address.");
    }
}
