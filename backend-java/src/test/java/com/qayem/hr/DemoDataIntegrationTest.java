package com.qayem.hr;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qayem.hr.entity.*;
import com.qayem.hr.enums.*;
import com.qayem.hr.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("demo")
@Transactional
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DemoDataIntegrationTest extends DemoTestConfiguration {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired CandidateRepository candidates;
    @Autowired SessionRepository sessions;
    @Autowired EvaluationRepository evaluations;
    @Autowired UserRepository users;
    @Autowired CandidateEvaluatorRepository assignments;
    private String token;

    @BeforeAll void loginOnce() throws Exception {
        var response=mvc.perform(post("/api/v1/auth/login").contentType("application/json")
                .content(json.writeValueAsString(Map.of("username","demo","password",DEMO_PASSWORD))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        token=json.readTree(response).get("accessToken").asText();
    }
    private JsonNode get(String path) throws Exception {
        return json.readTree(mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(path)
                .header("Authorization","Bearer "+token)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }
    private UUID session(String code) {
        return sessions.findAll().stream().filter(s->s.getSessionCode().equals(code)).findFirst().orElseThrow().getId();
    }
    private JsonNode row(JsonNode comparison,String nationalId) {
        for(var row:comparison.get("rankings")) if(row.get("nationalId").asText().equals(nationalId)) return row;
        throw new AssertionError("Missing candidate "+nationalId);
    }
    @Test void fixtureContainsRealLinkedScenarioDiversity() {
        assertEquals(4,sessions.count()); assertEquals(12,candidates.count()); assertEquals(3,users.count());
        assertEquals(36,assignments.count()); assertEquals(27,evaluations.count());
        assertEquals(2,evaluations.findAll().stream().filter(e->e.getStatus()==EvaluationStatus.Draft).count());
        assertEquals(8,candidates.findAll().stream().filter(c->c.getCandidateStatus()==CandidateStatus.Completed).count());
        assertEquals(2,candidates.findAll().stream().filter(c->c.getCandidateStatus()==CandidateStatus.Pending).count());
        assertEquals(2,candidates.findAll().stream().filter(Candidate::isHasDiscrepancy).count());
        assertEquals(4,candidates.findAll().stream().filter(c->c.getOverriddenBy()!=null).count());
        assertEquals(4,candidates.findAll().stream().map(Candidate::getFinalDecision).filter(Objects::nonNull).distinct().count());
    }
    @Test void everySubmittedTotalMatchesItsAnswers() {
        for(var evaluation:evaluations.findAll()) {
            if(evaluation.getStatus()==EvaluationStatus.Draft) { assertNull(evaluation.getTotalScore()); continue; }
            assertEquals(6,evaluation.getAnswers().size());
            assertEquals(evaluation.getTotalScore().intValue(),evaluation.getAnswers().stream().mapToInt(EvaluationAnswer::getScore).sum());
            assertTrue(evaluation.getAnswers().stream().allMatch(a->a.getScore()>=1 && a.getScore()<=a.getQuestion().getMaxScore()));
        }
    }
    @Test void comparisonPreservesNullForMissingAndDraftEvaluatorScores() throws Exception {
        var comparison=get("/api/v1/manager/sessions/"+session("DEMO-002")+"/comparison");
        for(String id:List.of("DEMO-C005","DEMO-C006")) {
            var row=row(comparison,id);
            assertTrue(row.get("averageScore").isNull()); assertEquals(3,row.get("totalEvaluators").asInt());
            assertEquals(3,row.get("evaluatorScores").size());
            for(var score:row.get("evaluatorScores")) assertTrue(score.get("score").isNull());
        }
        var complete=row(comparison,"DEMO-C004");
        assertTrue(complete.get("hasDiscrepancy").asBoolean()); assertEquals(13,complete.get("variance").asInt());
        assertEquals(3,complete.get("submittedEvaluations").asInt());
    }
    @Test void partialComparisonUsesOnlySubmittedScores() throws Exception {
        var row=row(get("/api/v1/manager/sessions/"+session("DEMO-003")+"/comparison"),"DEMO-C008");
        assertEquals(18,row.get("averageScore").asDouble());
        int scored=0; for(var score:row.get("evaluatorScores")) if(!score.get("score").isNull()) scored++;
        assertEquals(1,scored); assertEquals(1,row.get("submittedEvaluations").asInt());
    }
    @Test void dashboardAndReportsReflectTheFixture() throws Exception {
        var dashboard=get("/api/v1/manager/dashboard");
        assertEquals(4,dashboard.get("totalSessions").asInt()); assertEquals(12,dashboard.get("totalCandidates").asInt());
        assertEquals(2,dashboard.get("totalActiveSessions").asInt()); assertEquals(1,dashboard.get("employedCount").asInt());
        assertEquals(3,get("/api/v1/reports/evaluators").get("items").size());
        assertEquals(7,get("/api/v1/reports/results").get("items").size());
        assertEquals(2,get("/api/v1/candidates?finalDecision=Recommended").get("totalCount").asInt());
        assertEquals(12,get("/api/v1/reports/candidates").get("items").size());
    }
    @Test void exportsContainTheFictionalRecords() throws Exception {
        var csv=mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/reports/results?exportCsv=true")
                .header("Authorization","Bearer "+token)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(csv.contains("DEMO-C001")); assertTrue(csv.contains("DEMO-C012"));
        assertFalse(csv.contains("DEMO-C006"));
    }
}
