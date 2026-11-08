package com.qayem.hr;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.qayem.hr.repository.CandidateRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.util.Map;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="spring.datasource.url=jdbc:h2:mem:qayem_local_test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;NON_KEYWORDS=KEY,VALUE")
@AutoConfigureMockMvc
@ActiveProfiles("demo-local")
@Transactional
class LocalDemoIntegrationTest extends DemoTestConfiguration {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired CandidateRepository candidates;
    private String login() throws Exception {
        var response=mvc.perform(post("/api/v1/auth/login").contentType("application/json")
                .content(json.writeValueAsString(Map.of("username","demo","password",DEMO_PASSWORD))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.user.demoWriteEnabled").value(true))
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("accessToken").asText();
    }
    @Test void localPracticeAllowsWorkflowButBlocksAccountAdministration() throws Exception {
        mvc.perform(post("/api/v1/auth/demo-login")).andExpect(status().isNotFound());
        var token=login();
        var candidate=candidates.findAll().stream().filter(c->c.getNationalId().equals("DEMO-C006")).findFirst().orElseThrow();
        mvc.perform(post("/api/v1/evaluations/start").header("Authorization","Bearer "+token)
                .contentType("application/json").content(json.writeValueAsString(Map.of("candidateId",candidate.getId()))))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/v1/users").header("Authorization","Bearer "+token)
                .contentType("application/json").content("{}" )).andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/auth/change-password").header("Authorization","Bearer "+token)
                .contentType("application/json").content("{}" )).andExpect(status().isForbidden());
    }
}
