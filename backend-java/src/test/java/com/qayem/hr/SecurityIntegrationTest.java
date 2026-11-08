package com.qayem.hr;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import com.qayem.hr.repository.UserRepository;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("demo")
@Transactional
class SecurityIntegrationTest extends DemoTestConfiguration {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;

    private String token() throws Exception {
        var response = mvc.perform(post("/api/v1/auth/login").contentType("application/json")
                .content(json.writeValueAsString(java.util.Map.of("username", "demo", "password", DEMO_PASSWORD))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("accessToken").asText();
    }

    @Test void demoHasFourRoles() throws Exception {
        mvc.perform(post("/api/v1/auth/login").contentType("application/json")
                .content(json.writeValueAsString(java.util.Map.of("username", "demo", "password", DEMO_PASSWORD))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.user.isDemo").value(true))
                .andExpect(jsonPath("$.user.additionalRoles.length()").value(3));
    }
    @Test void invalidPasswordReturns401() throws Exception {
        mvc.perform(post("/api/v1/auth/login").contentType("application/json")
                .content("{\"username\":\"demo\",\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized());
    }
    @Test void missingCredentialsReturn400() throws Exception {
        mvc.perform(post("/api/v1/auth/login").contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest());
    }
    @Test void unauthenticatedRequestsCannotReadCandidates() throws Exception {
        mvc.perform(get("/api/v1/candidates")).andExpect(status().isUnauthorized());
    }
    @Test void referenceListsRequireAuthentication() throws Exception {
        mvc.perform(get("/api/v1/admin/reference-lists/Qualification")).andExpect(status().isUnauthorized());
    }
    @Test void demoCannotCreateUsersOrChangePassword() throws Exception {
        var token = token();
        mvc.perform(post("/api/v1/users").header("Authorization", "Bearer " + token)
                .contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/auth/change-password").header("Authorization", "Bearer " + token)
                .contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
    }
    @Test void disabledAccountCannotUseExistingToken() throws Exception {
        var token = token();
        var user = users.findByUsername("demo").orElseThrow();
        user.deactivate(); users.saveAndFlush(user);
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }
    @Test void demoCanReadFictionalSessions() throws Exception {
        mvc.perform(get("/api/v1/sessions").header("Authorization", "Bearer " + token()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[*].sessionCode").value(org.hamcrest.Matchers.hasItems("DEMO-001","DEMO-002","DEMO-003","DEMO-004")));
    }
    @Test void tamperedTokenIsRejected() throws Exception {
        var token = token();
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + "X" + token.substring(1)))
                .andExpect(status().isUnauthorized());
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"Departments", "GeneralDepartments", "Agencies", "Qualifications", "ApplicationTypes"})
    void frontendReferenceNamesResolve(String name) throws Exception {
        mvc.perform(get("/api/v1/admin/reference-lists/" + name).header("Authorization", "Bearer " + token()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isArray());
    }
}
