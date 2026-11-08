package com.qayem.hr.controller;

import org.springframework.data.domain.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import com.qayem.hr.entity.*;
import com.qayem.hr.enums.*;
import com.qayem.hr.repository.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/manager")
@PreAuthorize("hasAnyAuthority('Manager','Admin')")
public class ManagerController {

    private final CandidateRepository candidateRepo;
    private final EvaluationRepository evalRepo;
    private final SessionRepository sessionRepo;
    private final UserRepository userRepo;
    private final SystemSettingRepository settingRepo;
    private final AuditLogRepository auditRepo;
    private final CandidateEvaluatorRepository ceRepo;

    public ManagerController(CandidateRepository candidateRepo, EvaluationRepository evalRepo,
                              SessionRepository sessionRepo, UserRepository userRepo,
                              SystemSettingRepository settingRepo, AuditLogRepository auditRepo,
                              CandidateEvaluatorRepository ceRepo) {
        this.candidateRepo = candidateRepo;
        this.evalRepo = evalRepo;
        this.sessionRepo = sessionRepo;
        this.userRepo = userRepo;
        this.settingRepo = settingRepo;
        this.auditRepo = auditRepo;
        this.ceRepo = ceRepo;
    }

    @GetMapping("/dashboard")
    public ResponseEntity<?> getDashboard() {
        BigDecimal notQMax = getT("Threshold_NotQualified", BigDecimal.valueOf(17));
        BigDecimal condMax = getT("Threshold_Conditional", BigDecimal.valueOf(23));

        long totalSessions  = sessionRepo.count();
        long activeSessions = sessionRepo.findAll().stream().filter(s -> s.getStatus() == SessionStatus.Active).count();
        List<Candidate> candidates = candidateRepo.findAll();

        List<Map<String, Object>> enriched = candidates.stream().map(c -> {
            var submitted = c.getEvaluations().stream()
                    .filter(e -> e.getStatus() != EvaluationStatus.Draft && e.getTotalScore() != null)
                    .collect(Collectors.toList());
            BigDecimal liveAvg = submitted.isEmpty() ? null
                    : BigDecimal.valueOf(submitted.stream().mapToInt(Evaluation::getTotalScore).average().orElse(0));
            EvaluationDecision liveDecision = liveAvg != null ? Candidate.classifyScore(liveAvg, notQMax, condMax) : null;
            // Map.of() throws NPE on any null value (aggregateScore/finalDecision/etc.
            // are routinely null for candidates with no submitted evaluation yet) —
            // use a null-tolerant map instead.
            Map<String, Object> em = new LinkedHashMap<>();
            em.put("id", c.getId()); em.put("fullNameAr", c.getFullNameAr()); em.put("fullNameEn", c.getFullNameEn());
            em.put("aggregateScore", liveAvg); em.put("finalDecision", c.getFinalDecision());
            em.put("liveDecision", liveDecision);
            em.put("effectiveDecision", c.getFinalDecision()!=null?c.getFinalDecision():liveDecision); em.put("hasSession", c.getSessionId() != null);
            em.put("jobPositionAr", c.getSession() != null ? c.getSession().getJobPositionAr() : null);
            return em;
        }).collect(Collectors.toList());

        List<Map<String, Object>> recentSessions = sessionRepo.findAll(Sort.by(Sort.Direction.DESC, "scheduledDate"))
                .stream().filter(s -> s.getStatus() == SessionStatus.Active).limit(10)
                .map(s -> Map.<String, Object>of(
                    "sessionId", s.getId(), "sessionCode", s.getSessionCode(), "titleAr", s.getTitleAr(),
                    "totalCandidates", s.getCandidates().size(),
                    "pendingDecisions", s.getCandidates().stream().filter(c -> c.getFinalDecision() == null).count(),
                    "completedDecisions", s.getCandidates().stream().filter(c -> c.getFinalDecision() != null).count(),
                    "scheduledDate", Objects.toString(s.getScheduledDate(), ""),
                    "hasDiscrepancy", s.getCandidates().stream().anyMatch(Candidate::isHasDiscrepancy)
                )).collect(Collectors.toList());

        List<Map<String, Object>> topCandidates = enriched.stream()
                .filter(c -> c.get("aggregateScore") != null)
                .sorted((a, b) -> ((BigDecimal)b.get("aggregateScore")).compareTo((BigDecimal)a.get("aggregateScore")))
                .limit(5)
                .map(ManagerController::toRankedCandidateSummary)
                .collect(Collectors.toList());

        List<Map<String, Object>> bottomCandidates = enriched.stream()
                .filter(c -> c.get("aggregateScore") != null)
                .sorted(Comparator.comparing(c -> (BigDecimal) c.get("aggregateScore")))
                .limit(5)
                .map(ManagerController::toRankedCandidateSummary)
                .collect(Collectors.toList());

        Map<String, Object> dashboard = new LinkedHashMap<>();
        dashboard.put("totalSessions", totalSessions);
        dashboard.put("totalActiveSessions", activeSessions);
        dashboard.put("totalCandidates", enriched.stream().filter(c -> (boolean) c.get("hasSession")).count());
        dashboard.put("totalApplicants", enriched.stream().filter(c -> !(boolean) c.get("hasSession")).count());
        dashboard.put("employedCount",   enriched.stream().filter(c -> EvaluationDecision.Employed.equals(c.get("finalDecision"))).count());
        dashboard.put("recommendedCount", enriched.stream().filter(c -> EvaluationDecision.Recommended.equals(c.get("effectiveDecision"))).count());
        dashboard.put("conditionalCount", enriched.stream().filter(c -> EvaluationDecision.ConditionallyQualified.equals(c.get("effectiveDecision"))).count());
        dashboard.put("notQualifiedCount", enriched.stream().filter(c -> EvaluationDecision.NotQualified.equals(c.get("effectiveDecision"))).count());
        dashboard.put("recentSessions", recentSessions);
        dashboard.put("topCandidates", topCandidates);
        dashboard.put("bottomCandidates", bottomCandidates);
        return ResponseEntity.ok(dashboard);
    }

    // finalDecision is routinely null (no manager decision yet) — Map.of() would NPE.
    private static Map<String, Object> toRankedCandidateSummary(Map<String, Object> c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.get("id")); m.put("fullNameAr", c.get("fullNameAr"));
        m.put("fullNameEn", c.get("fullNameEn")); m.put("aggregateScore", c.get("aggregateScore"));
        m.put("finalDecision", c.get("finalDecision"));
        m.put("jobPositionAr", Objects.toString(c.get("jobPositionAr"), ""));
        return m;
    }

    @GetMapping("/pending-decisions")
    public ResponseEntity<?> getPendingDecisions() {
        BigDecimal discT = getT("Threshold_Discrepancy", BigDecimal.valueOf(5));
        List<Candidate> candidates = candidateRepo.findAll().stream()
                .filter(c -> c.getFinalDecision() == null && c.getCandidateStatus() != CandidateStatus.Pending)
                .sorted(Comparator.comparing(Candidate::getRegisteredAt))
                .collect(Collectors.toList());
        return ResponseEntity.ok(candidates.stream().map(c -> buildCandidateSummary(c, discT)).collect(Collectors.toList()));
    }

    @GetMapping("/sessions/{sessionId}/comparison")
    public ResponseEntity<?> getSessionComparison(@PathVariable UUID sessionId) {
        BigDecimal notQMax = getT("Threshold_NotQualified", BigDecimal.valueOf(17));
        BigDecimal condMax = getT("Threshold_Conditional", BigDecimal.valueOf(23));
        BigDecimal discT   = getT("Threshold_Discrepancy", BigDecimal.valueOf(5));

        InterviewSession session = sessionRepo.findById(sessionId).orElse(null);
        if (session == null) return ResponseEntity.notFound().build();

        List<Candidate> candidates = candidateRepo.findAll().stream()
                .filter(c -> sessionId.equals(c.getSessionId())).collect(Collectors.toList());

        List<UUID> evalIds = session.getEvaluators().stream().filter(SessionEvaluator::isActive)
                .map(SessionEvaluator::getUserId).collect(Collectors.toList());

        List<Map<String, Object>> rankings = candidates.stream().map(c -> {
            var submitted = c.getEvaluations().stream()
                    .filter(e -> e.getStatus() != EvaluationStatus.Draft && e.getTotalScore() != null).collect(Collectors.toList());
            BigDecimal avg  = submitted.isEmpty() ? null : BigDecimal.valueOf(submitted.stream().mapToInt(e -> e.getTotalScore() != null ? e.getTotalScore() : 0).average().orElse(0));
            BigDecimal high = submitted.isEmpty() ? null : BigDecimal.valueOf(submitted.stream().mapToInt(e -> e.getTotalScore() != null ? e.getTotalScore() : 0).max().orElse(0));
            BigDecimal low  = submitted.isEmpty() ? null : BigDecimal.valueOf(submitted.stream().mapToInt(e -> e.getTotalScore() != null ? e.getTotalScore() : 0).min().orElse(0));
            BigDecimal var_ = (high != null && low != null) ? high.subtract(low) : null;
            boolean hasDis  = var_ != null && var_.compareTo(discT) > 0;

            List<Map<String, Object>> evalScores = ceRepo.findByCandidateId(c.getId()).stream().map(CandidateEvaluator::getUserId).map(eid -> {
                Evaluation ev = submitted.stream().filter(e -> eid.equals(e.getEvaluatorId())).findFirst().orElse(null);
                User evaluator = userRepo.findById(eid).orElse(null);
                Map<String, Object> score = new LinkedHashMap<>();
                score.put("evaluatorId", eid);
                score.put("evaluatorNameAr", evaluator != null ? evaluator.getFullNameAr() : "—");
                score.put("evaluatorNameEn", evaluator != null ? evaluator.getFullNameEn() : "—");
                score.put("score", ev != null ? ev.getTotalScore() : null);
                return score;
            }).collect(Collectors.toList());

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("candidateId", c.getId()); m.put("fullNameAr", c.getFullNameAr());
            m.put("fullNameEn", c.getFullNameEn()); m.put("nationalId", c.getNationalId());
            m.put("averageScore", avg); m.put("highestScore", high); m.put("lowestScore", low);
            m.put("variance", var_); m.put("hasDiscrepancy", hasDis);
            m.put("systemDecision", avg != null ? Candidate.classifyScore(avg, notQMax, condMax).toString() : null);
            m.put("finalDecision", c.getFinalDecision() != null ? c.getFinalDecision().toString() : null);
            m.put("isOverridden", c.getOverriddenBy() != null); m.put("overrideReason", c.getOverrideReason());
            m.put("submittedEvaluations", submitted.size()); m.put("totalEvaluators", ceRepo.countByCandidateId(c.getId()));
            m.put("aiSummary", c.getAiSummary()); m.put("evaluatorScores", evalScores);
            return m;
        }).sorted((a, b) -> {
            BigDecimal sa_ = (BigDecimal) a.get("averageScore");
            BigDecimal sb_ = (BigDecimal) b.get("averageScore");
            if (sa_ == null && sb_ == null) return 0;
            if (sa_ == null) return 1; if (sb_ == null) return -1;
            return sb_.compareTo(sa_);
        }).collect(Collectors.toList());

        for (int i = 0; i < rankings.size(); i++) ((Map<String, Object>) rankings.get(i)).put("rank", i + 1);

        Map<String, Object> comparison = new LinkedHashMap<>();
        comparison.put("sessionId", sessionId);
        comparison.put("sessionCode", session.getSessionCode());
        comparison.put("titleAr", session.getTitleAr());
        comparison.put("titleEn", session.getTitleEn());
        comparison.put("totalCandidates", candidates.size());
        comparison.put("evaluatedCandidates", candidates.stream().filter(c -> c.getEvaluations().stream().anyMatch(e -> e.getStatus() != EvaluationStatus.Draft)).count());
        comparison.put("hasAnyDiscrepancy", rankings.stream().anyMatch(r -> (boolean) r.get("hasDiscrepancy")));
        comparison.put("discrepancyThreshold", discT);
        comparison.put("notQualifiedThreshold", notQMax);
        comparison.put("conditionalThreshold", condMax);
        comparison.put("rankings", rankings);
        return ResponseEntity.ok(comparison);
    }

    @GetMapping("/evaluator-analytics")
    public ResponseEntity<?> getEvaluatorAnalytics() {
        List<Evaluation> submitted = evalRepo.findAll().stream()
                .filter(e -> e.getStatus() != EvaluationStatus.Draft && e.getTotalScore() != null)
                .collect(Collectors.toList());

        Map<UUID, Double> candAvgs = submitted.stream().collect(Collectors.groupingBy(
            Evaluation::getCandidateId,
            Collectors.averagingInt(e -> e.getTotalScore())));

        return ResponseEntity.ok(submitted.stream().collect(Collectors.groupingBy(Evaluation::getEvaluatorId))
            .entrySet().stream().map(entry -> {
                UUID eid = entry.getKey();
                List<Evaluation> evals = entry.getValue();
                double[] scores = evals.stream().mapToDouble(e -> e.getTotalScore()).toArray();
                double avg = Arrays.stream(scores).average().orElse(0);
                double min = Arrays.stream(scores).min().orElse(0);
                double max = Arrays.stream(scores).max().orElse(0);
                double mean = Arrays.stream(scores).average().orElse(0);
                double stdDev = Math.sqrt(Arrays.stream(scores).map(s -> Math.pow(s - mean, 2)).average().orElse(0));

                OptionalDouble devs = evals.stream().filter(e -> candAvgs.containsKey(e.getCandidateId()))
                        .mapToDouble(e -> e.getTotalScore() - candAvgs.get(e.getCandidateId())).average();
                double meanDev = devs.isPresent() ? devs.getAsDouble() : 0;
                String bias = meanDev > 5 ? "PositiveBias" : meanDev < -5 ? "NegativeBias" : "StandardConsistency";

                User ev = userRepo.findById(eid).orElse(null);
                return Map.<String, Object>of(
                    "evaluatorId", eid,
                    "fullNameAr", ev != null ? ev.getFullNameAr() : "",
                    "fullNameEn", ev != null ? Objects.toString(ev.getFullNameEn(), "") : "",
                    "totalEvaluations", evals.size(),
                    "averageScoreGiven", BigDecimal.valueOf(avg).setScale(2, RoundingMode.HALF_UP),
                    "minScoreGiven", (int) min, "maxScoreGiven", (int) max,
                    "stdDeviation", BigDecimal.valueOf(stdDev).setScale(2, RoundingMode.HALF_UP),
                    "meanDeviation", BigDecimal.valueOf(meanDev).setScale(2, RoundingMode.HALF_UP),
                    "biasLabel", bias
                );
            }).sorted((a, b) -> ((Integer)b.get("totalEvaluations")).compareTo((Integer)a.get("totalEvaluations")))
            .collect(Collectors.toList()));
    }

    @PostMapping("/decisions")
    @PreAuthorize("hasAnyAuthority('Manager','Admin','DataEntry')")
    public ResponseEntity<?> issueDecision(@RequestBody DecisionRequest req, Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        Candidate c = candidateRepo.findById(req.candidateId()).orElse(null);
        if (c == null) return ResponseEntity.notFound().build();

        c.applyManagerDecision(req.decision(), req.reason(), me);
        c.markCompleted();

        evalRepo.findByCandidateId(req.candidateId()).stream()
                .filter(e -> e.getStatus() == EvaluationStatus.Submitted)
                .forEach(e -> { e.markReviewed(); evalRepo.save(e); });

        candidateRepo.save(c);

        auditRepo.save(AuditLog.create("MANAGER_DECISION", "Candidate", req.candidateId().toString(), me,
            null, "{\"decision\":\"" + req.decision() + "\",\"reason\":\"" + req.reason() + "\"}", null));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/audit-log")
    public ResponseEntity<?> getAuditLog(@RequestParam(required = false) String entityType,
                                          @RequestParam(required = false) String entityId,
                                          @RequestParam(required = false) String action,
                                          @RequestParam(defaultValue = "1") int page,
                                          @RequestParam(defaultValue = "50") int pageSize) {
        org.springframework.data.jpa.domain.Specification<AuditLog> spec = (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            if (entityType != null && !entityType.isBlank())
                predicates.add(cb.equal(root.get("entityType"), entityType));
            if (entityId != null && !entityId.isBlank())
                predicates.add(cb.equal(root.get("entityId"), entityId));
            if (action != null && !action.isBlank())
                predicates.add(cb.equal(root.get("action"), action));
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };

        Pageable pageable = PageRequest.of(page - 1, pageSize, Sort.by(Sort.Direction.DESC, "timestamp"));
        var pg = auditRepo.findAll(spec, pageable);

        List<Map<String, Object>> items = pg.getContent().stream().map(a -> Map.<String, Object>of(
            "id", a.getId(), "userId", a.getUserId(), "action", a.getAction(),
            "entityType", a.getEntityType(), "entityId", Objects.toString(a.getEntityId(), ""),
            "oldValues", Objects.toString(a.getOldValues(), ""),
            "newValues", Objects.toString(a.getNewValues(), ""),
            "ipAddress", Objects.toString(a.getIpAddress(), ""), "timestamp", a.getTimestamp()
        )).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
            "items", items, "totalCount", pg.getTotalElements(),
            "page", page, "pageSize", pageSize, "totalPages", pg.getTotalPages()
        ));
    }

    private Map<String, Object> buildCandidateSummary(Candidate c, BigDecimal discT) {
        var submitted = c.getEvaluations().stream()
                .filter(e -> e.getStatus() != EvaluationStatus.Draft && e.getTotalScore() != null).collect(Collectors.toList());
        BigDecimal avg  = submitted.isEmpty() ? null : BigDecimal.valueOf(submitted.stream().mapToInt(e -> e.getTotalScore() != null ? e.getTotalScore() : 0).average().orElse(0));
        BigDecimal high = submitted.isEmpty() ? null : BigDecimal.valueOf(submitted.stream().mapToInt(e -> e.getTotalScore() != null ? e.getTotalScore() : 0).max().orElse(0));
        BigDecimal low  = submitted.isEmpty() ? null : BigDecimal.valueOf(submitted.stream().mapToInt(e -> e.getTotalScore() != null ? e.getTotalScore() : 0).min().orElse(0));
        BigDecimal var_ = (high != null && low != null) ? high.subtract(low) : null;

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("candidateId", c.getId()); m.put("fullNameAr", c.getFullNameAr()); m.put("fullNameEn", c.getFullNameEn());
        m.put("nationalId", c.getNationalId()); m.put("averageScore", avg);
        m.put("highestScore", high); m.put("lowestScore", low); m.put("variance", var_);
        m.put("hasDiscrepancy", var_ != null && var_.compareTo(discT) > 0);
        m.put("systemDecision", c.getSystemDecision() != null ? c.getSystemDecision().toString() : null);
        m.put("finalDecision", c.getFinalDecision() != null ? c.getFinalDecision().toString() : null);
        m.put("isOverridden", c.getOverriddenBy() != null); m.put("overrideReason", c.getOverrideReason());
        m.put("aiSummary", c.getAiSummary());
        m.put("submittedEvaluations", submitted.size()); m.put("totalAssignedEvaluators", c.getEvaluations().size());
        m.put("evaluations", submitted.stream().map(e -> {
            Map<String, Object> em = new LinkedHashMap<>();
            em.put("id", e.getId()); em.put("evaluatorId", e.getEvaluatorId());
            em.put("evaluatorNameAr", e.getEvaluator() != null ? e.getEvaluator().getFullNameAr() : "");
            em.put("totalScore", e.getTotalScore());
            em.put("systemDecision", e.getSystemDecision() != null ? e.getSystemDecision().toString() : null);
            em.put("status", e.getStatus().toString()); em.put("notes", e.getNotes());
            em.put("submittedAt", e.getSubmittedAt()); em.put("answers", List.of());
            return em;
        }).collect(Collectors.toList()));
        return m;
    }

    private BigDecimal getT(String key, BigDecimal def) {
        return settingRepo.findByKey(key)
                .map(s -> { try { return new BigDecimal(s.getValue()); } catch (Exception e) { return def; } })
                .orElse(def);
    }

    record DecisionRequest(UUID candidateId, EvaluationDecision decision, String reason) {}
}
