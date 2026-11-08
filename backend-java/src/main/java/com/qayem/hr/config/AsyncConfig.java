package com.qayem.hr.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Small bounded pool for AI summary generation. Ollama on CPU is a single
 * heavy job at a time — a couple of threads let one submit() not block
 * another while avoiding piling up concurrent inference calls.
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "aiTaskExecutor")
    public Executor aiTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(2);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("ai-summary-");
        executor.initialize();
        return executor;
    }
}
