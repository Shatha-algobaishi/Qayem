package com.qayem.hr;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import com.qayem.hr.entity.*;
import com.qayem.hr.repository.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// Same disposable database setup, with production write authorization enabled.
@SpringBootTest(properties = {"app.demo=false", "spring.datasource.url=jdbc:h2:mem:qayem_auth_test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;NON_KEYWORDS=KEY,VALUE"})
@AutoConfigureMockMvc
@ActiveProfiles("demo")
@Transactional
class AuthorizationIntegrationTest extends DemoTestConfiguration {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired RoleRepository roles;
    @Autowired UserRoleRepository assignments;
    @Autowired CandidateRepository candidates;
    @Autowired QuestionRepository questions;
    @Autowired PasswordEncoder encoder;
    @Autowired jakarta.persistence.EntityManager entityManager;

    @Test void operationalModeDoesNotOfferVisitorAccess() throws Exception {
        mvc.perform(post("/api/v1/auth/demo-login")).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/auth/demo-info")).andExpect(jsonPath("$.enabled").value(false));
    }
    private User account(String role) {
        var r = roles.findByName(role).orElseThrow();
        var user = users.saveAndFlush(User.create("Test", "Test", role + "@example.invalid", role.toLowerCase(),
                encoder.encode(ACCOUNT_PASSWORD), r.getId(), null, "Test", "Test", null));
        entityManager.clear();
        return users.findById(user.getId()).orElseThrow();
    }
    private com.fasterxml.jackson.databind.JsonNode login(String username, String password) throws Exception {
        return json.readTree(mvc.perform(post("/api/v1/auth/login").contentType("application/json")
                .content(json.writeValueAsString(java.util.Map.of("username", username, "password", password))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }
    @ParameterizedTest
    @ValueSource(strings = {"DataEntry", "Evaluator", "Manager"})
    void nonAdministratorsCannotCreateAccountsOrAssignRoles(String role) throws Exception {
        var user = account(role);
        var token = login(user.getUsername(), ACCOUNT_PASSWORD).get("accessToken").asText();
        mvc.perform(post("/api/v1/users").header("Authorization", "Bearer " + token)
                .contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/users/roles").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }
    @Test void administratorCanReadAccountManagement() throws Exception {
        var user = account("Admin");
        var token = login(user.getUsername(), ACCOUNT_PASSWORD).get("accessToken").asText();
        mvc.perform(get("/api/v1/users/roles").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
    }
    @Test void removedAdditionalRoleStopsWorkingImmediately() throws Exception {
        var user = account("Evaluator");
        assignments.saveAndFlush(UserRole.create(user.getId(), roles.findByName("Admin").orElseThrow().getId(), null));
        entityManager.clear();
        var token = login(user.getUsername(), ACCOUNT_PASSWORD).get("accessToken").asText();
        mvc.perform(get("/api/v1/users/roles").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        assignments.deleteAll(assignments.findByUserId(user.getId())); assignments.flush();
        mvc.perform(get("/api/v1/users/roles").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }
    @Test void evaluatorCannotReadUnassignedCandidateOrCv() throws Exception {
        var user = account("Evaluator");
        var token = login(user.getUsername(), ACCOUNT_PASSWORD).get("accessToken").asText();
        var id = candidates.findAll().getFirst().getId();
        mvc.perform(get("/api/v1/candidates/" + id).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/candidates/" + id + "/cv/download").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/candidates").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalCount").value(0));
    }
    @Test void refreshRotationAndLogoutRejectReplayedToken() throws Exception {
        var login = login("demo", DEMO_PASSWORD);
        var first = login.get("refreshToken").asText();
        var rotated = json.readTree(mvc.perform(post("/api/v1/auth/refresh-token").contentType("application/json")
                .content(json.writeValueAsString(java.util.Map.of("refreshToken", first))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        mvc.perform(post("/api/v1/auth/refresh-token").contentType("application/json")
                .content(json.writeValueAsString(java.util.Map.of("refreshToken", first))))
                .andExpect(status().isUnauthorized());
        var second = rotated.get("refreshToken").asText();
        mvc.perform(post("/api/v1/auth/revoke-token").header("Authorization", "Bearer " + rotated.get("accessToken").asText())
                .contentType("application/json").content(json.writeValueAsString(java.util.Map.of("refreshToken", second))))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/v1/auth/refresh-token").contentType("application/json")
                .content(json.writeValueAsString(java.util.Map.of("refreshToken", second))))
                .andExpect(status().isUnauthorized());
    }

    @Test void evaluatorCanSaveAndSubmitAndCannotInflateScores() throws Exception {
        var token = login("demo", DEMO_PASSWORD).get("accessToken").asText();
        var candidate = candidates.findAll().stream().filter(c -> "DEMO-C006".equals(c.getNationalId())).findFirst().orElseThrow();
        var start = mvc.perform(post("/api/v1/evaluations/start").header("Authorization", "Bearer " + token)
                .contentType("application/json").content(json.writeValueAsString(java.util.Map.of("candidateId", candidate.getId()))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        var id = json.readTree(start).asText();
        var question = questions.findByIsActiveTrueOrderByOrderIndex().getFirst();
        var invalid = java.util.Map.of("answers", java.util.List.of(java.util.Map.of("questionId", question.getId(), "score", 999)));
        mvc.perform(post("/api/v1/evaluations/" + id + "/save").header("Authorization", "Bearer " + token)
                .contentType("application/json").content(json.writeValueAsString(invalid)))
                .andExpect(status().isBadRequest());
        var answers = questions.findByIsActiveTrueOrderByOrderIndex().stream()
                .map(q -> java.util.Map.of("questionId", q.getId(), "score", 5)).toList();
        mvc.perform(post("/api/v1/evaluations/" + id + "/save").header("Authorization", "Bearer " + token)
                .contentType("application/json").content(json.writeValueAsString(java.util.Map.of("answers", answers, "notes", "Test"))))
                .andExpect(status().isNoContent());
        // Separate HTTP requests use separate persistence contexts in the real server.
        entityManager.flush(); entityManager.clear();
        mvc.perform(post("/api/v1/evaluations/" + id + "/submit").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalScore").value(30));
        mvc.perform(post("/api/v1/evaluations/" + id + "/submit").header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }
}
