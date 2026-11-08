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
        return json.readTree(mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(java.net.URI.create(path))
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
        assertEquals(6,sessions.count()); assertEquals(30,candidates.count()); assertEquals(8,users.count());
        assertEquals(90,assignments.count()); assertEquals(69,evaluations.count());
        assertEquals(6,evaluations.findAll().stream().filter(e->e.getStatus()==EvaluationStatus.Draft).count());
        assertEquals(20,candidates.findAll().stream().filter(c->c.getCandidateStatus()==CandidateStatus.Completed).count());
        assertEquals(4,candidates.findAll().stream().filter(c->c.getCandidateStatus()==CandidateStatus.Pending).count());
        assertEquals(4,candidates.findAll().stream().filter(Candidate::isHasDiscrepancy).count());
        assertEquals(4,candidates.findAll().stream().filter(c->c.getOverriddenBy()!=null).count());
        assertEquals(4,candidates.findAll().stream().map(Candidate::getFinalDecision).filter(Objects::nonNull).distinct().count());
    }
    @Autowired com.qayem.hr.seeder.DemoSeeder seeder;
    @Test void seedingIsIdempotent() {
        seeder.run(null);
        assertEquals(30,candidates.count());assertEquals(69,evaluations.count());assertEquals(90,assignments.count());
    }
    @Test void departmentsFiltersAndProfilesAreLinked() throws Exception {
        for(String department:List.of("الموارد البشرية","تقنية المعلومات","المالية","التسويق","العمليات","خدمة العملاء")) {
            var filtered=json.readTree(mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/candidates").param("department",department).header("Authorization","Bearer "+token)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
            assertEquals(5,filtered.get("totalCount").asInt());
            for(var item:filtered.get("items")) assertEquals(department,item.get("department").asText());
        }
        assertEquals(4,get("/api/v1/candidates?status=Pending").get("totalCount").asInt());
        assertEquals(6,get("/api/v1/candidates?status=InProgress").get("totalCount").asInt());
        assertEquals(20,get("/api/v1/candidates?status=Completed").get("totalCount").asInt());
        assertEquals(5,get("/api/v1/candidates?sessionId="+session("DEMO-006")).get("totalCount").asInt());
        var n=get("/api/v1/candidates?search=Noura");assertEquals(1,n.get("totalCount").asInt());
        var profile=get("/api/v1/candidates/"+n.get("items").get(0).get("id").asText());
        assertEquals("نورة",profile.get("fullNameAr").asText());assertEquals(3,profile.get("assignedEvaluators").size());
        assertEquals(3,profile.get("evaluations").size());assertFalse(profile.get("notes").asText().isBlank());
    }
    @Test void visitorLoginRequiresNoPasswordAndCannotWrite() throws Exception {
        var result=mvc.perform(post("/api/v1/auth/demo-login")).andExpect(status().isOk())
                .andExpect(jsonPath("$.user.isDemo").value(true)).andExpect(jsonPath("$.user.demoWriteEnabled").value(false))
                .andReturn().getResponse().getContentAsString();
        var t=json.readTree(result).get("accessToken").asText();
        mvc.perform(post("/api/v1/candidates").header("Authorization","Bearer "+t).contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
        assertFalse(result.contains(DEMO_PASSWORD));
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
        assertEquals(6,dashboard.get("totalSessions").asInt()); assertEquals(30,dashboard.get("totalCandidates").asInt());
        assertEquals(3,dashboard.get("totalActiveSessions").asInt()); assertEquals(1,dashboard.get("employedCount").asInt());
        assertEquals(8,get("/api/v1/reports/evaluators").get("items").size());
        assertEquals(13,get("/api/v1/reports/results").get("items").size());
        assertEquals(6,get("/api/v1/candidates?finalDecision=Recommended").get("totalCount").asInt());
        assertEquals(30,get("/api/v1/reports/candidates").get("items").size());
    }
    @Test void chartCountsMatchTheirCandidateFilters() throws Exception {
        var dashboard=get("/api/v1/manager/dashboard");int sum=0;
        for(var pair:Map.of("Recommended","recommendedCount","ConditionallyQualified","conditionalCount","NotQualified","notQualifiedCount","Employed","employedCount").entrySet()) {
            int count=get("/api/v1/candidates?effectiveDecision="+pair.getKey()).get("totalCount").asInt();
            assertEquals(count,dashboard.get(pair.getValue()).asInt());sum+=count;
        }
        sum+=get("/api/v1/candidates?unscored=true").get("totalCount").asInt();assertEquals(30,sum);
    }
    @Test void exportsContainTheFictionalRecords() throws Exception {
        var csv=mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/reports/results?exportCsv=true")
                .header("Authorization","Bearer "+token)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(csv.contains("DEMO-C001")); assertTrue(csv.contains("DEMO-C012"));
        assertFalse(csv.contains("DEMO-C006"));
    }
}
