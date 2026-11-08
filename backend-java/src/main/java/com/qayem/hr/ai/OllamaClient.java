package com.qayem.hr.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Thin client for a local Ollama server. Calls /api/generate in JSON mode
 * with a low temperature so responses are deterministic summaries/extractions
 * rather than creative text.
 */
@Component
public class OllamaClient {

    private static final Logger log = LoggerFactory.getLogger(OllamaClient.class);

    @Value("${ai.enabled:true}")
    private boolean enabled;

    @Value("${ai.ollama.base-url:http://localhost:11434}")
    private String baseUrl;

    @Value("${ai.ollama.model:llama3.2}")
    private String model;

    @Value("${ai.ollama.timeout-seconds:120}")
    private int timeoutSeconds;

    private final ObjectMapper mapper = new ObjectMapper();

    public boolean isEnabled() {
        return enabled;
    }

    /**
     * Sends a prompt to Ollama and returns the raw JSON text the model produced
     * (already validated as parseable JSON), or empty if the model/service is
     * unavailable, times out, or returns something we can't parse.
     */
    public Optional<JsonNode> generateJson(String systemPrompt, String userPrompt) {
        if (!enabled) return Optional.empty();

        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("model", model);
            body.put("prompt", systemPrompt + "\n\n" + userPrompt);
            body.put("format", "json");
            body.put("stream", false);
            body.put("options", Map.of("temperature", 0.2, "num_predict", 600));

            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(10))
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/api/generate"))
                    .timeout(Duration.ofSeconds(timeoutSeconds))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.warn("Ollama returned status {}: {}", response.statusCode(), truncate(response.body()));
                return Optional.empty();
            }

            JsonNode envelope = mapper.readTree(response.body());
            String modelOutput = envelope.path("response").asText("");
            if (modelOutput.isBlank()) {
                log.warn("Ollama returned an empty response body");
                return Optional.empty();
            }

            return Optional.of(mapper.readTree(modelOutput));
        } catch (Exception e) {
            log.warn("Ollama call failed ({}): {}", e.getClass().getSimpleName(), e.getMessage());
            return Optional.empty();
        }
    }

    private static String truncate(String s) {
        return s.length() > 300 ? s.substring(0, 300) + "..." : s;
    }
}
