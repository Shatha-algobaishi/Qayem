package com.qayem.hr.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import com.qayem.hr.ai.AiSummaryOrchestrator;
import com.qayem.hr.entity.*;
import com.qayem.hr.enums.EvaluationStatus;
import com.qayem.hr.repository.*;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/evaluations")
public class EvaluationsController {

    private final EvaluationRepository evalRepo;
    private final EvaluationAnswerRepository answerRepo;
    private final CandidateRepository candidateRepo;
    private final QuestionRepository questionRepo;
    private final SessionEvaluatorRepository seRepo;
    private final CandidateEvaluatorRepository ceRepo;
    private final NotificationRepository notifRepo;
    private final UserRepository userRepo;
    private final SystemSettingRepository settingRepo;
    private final AuditLogRepository auditRepo;
    private final AiSummaryOrchestrator aiOrchestrator;

    public EvaluationsController(EvaluationRepository evalRepo, EvaluationAnswerRepository answerRepo,
                                  CandidateRepository candidateRepo, QuestionRepository questionRepo,
                                  SessionEvaluatorRepository seRepo, CandidateEvaluatorRepository ceRepo,
                                  NotificationRepository notifRepo, UserRepository userRepo,
                                  SystemSettingRepository settingRepo, AuditLogRepository auditRepo,
                                  AiSummaryOrchestrator aiOrchestrator) {
        this.evalRepo = evalRepo;
        this.answerRepo = answerRepo;
        this.candidateRepo = candidateRepo;
        this.questionRepo = questionRepo;
        this.seRepo = seRepo;
        this.ceRepo = ceRepo;
        this.notifRepo = notifRepo;
        this.userRepo = userRepo;
        this.settingRepo = settingRepo;
        this.auditRepo = auditRepo;
        this.aiOrchestrator = aiOrchestrator;
    }

    @GetMapping("/questions")
    public ResponseEntity<?> getQuestions() {
        return ResponseEntity.ok(questionRepo.findByIsActiveTrueOrderByOrderIndex().stream().map(q -> Map.of(
            "id", q.getId(), "textAr", q.getTextAr(),
            "textEn", Objects.toString(q.getTextEn(), ""),
            "category", Objects.toString(q.getCategory(), ""),
            "orderIndex", q.getOrderIndex(), "maxScore", q.getMaxScore(), "isActive", q.isActive()
        )).collect(Collectors.toList()));
    }

    @PostMapping("/start")
    @PreAuthorize("hasAuthority('Evaluator')")
    public ResponseEntity<?> startEvaluation(@RequestBody StartEvaluationRequest req, Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());

        Candidate candidate = candidateRepo.findById(req.candidateId()).orElse(null);
        if (candidate == null) return ResponseEntity.notFound().build();

        UUID resolvedSessionId = req.sessionId() != null ? req.sessionId() : candidate.getSessionId();

        boolean sessionAssigned = resolvedSessionId != null
                && seRepo.existsBySessionIdAndUserIdAndIsActiveTrue(resolvedSessionId, me);
        boolean candidateAssigned = ceRepo.existsByCandidateIdAndUserId(req.candidateId(), me);
        if (!sessionAssigned && !candidateAssigned) return ResponseEntity.status(403).build();

        Evaluation existing = evalRepo.findByCandidateIdAndEvaluatorId(req.candidateId(), me).orElse(null);
        if (existing != null) return ResponseEntity.ok(existing.getId());

        Evaluation eval = Evaluation.create(req.candidateId(), resolvedSessionId, me);
        evalRepo.save(eval);

        candidate.markInProgress();
        candidateRepo.save(candidate);

        notifRepo.save(Notification.create(me, "بدء التقييم", "Evaluation Started",
            "تم بدء تقييم المرشح بنجاح.", "Candidate evaluation has been started successfully.",
            "Submission", "Evaluation", eval.getId().toString()));

        return ResponseEntity.status(201).body(eval.getId());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('Admin','Manager','Evaluator')")
    public ResponseEntity<?> getEvaluation(@PathVariable UUID id, Authentication auth) {
        Evaluation eval = evalRepo.findById(id).orElse(null);
        if (eval == null) return ResponseEntity.notFound().build();

        UUID me = UUID.fromString((String) auth.getPrincipal());
        boolean isEvaluatorOnly = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("Evaluator"))
                && auth.getAuthorities().stream().noneMatch(a -> List.of("Admin","Manager").contains(a.getAuthority()));
        if (isEvaluatorOnly && !eval.getEvaluatorId().equals(me)) return ResponseEntity.status(403).build();

        return ResponseEntity.ok(mapEval(eval));
    }

    @GetMapping("/my")
    @PreAuthorize("hasAuthority('Evaluator')")
    public ResponseEntity<?> getMyEvaluations(Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        List<Evaluation> evals = evalRepo.findByEvaluatorIdOrderByCreatedAtDesc(me);
        Set<UUID> evaluatedCandidateIds = evals.stream().map(Evaluation::getCandidateId).collect(Collectors.toSet());

        List<Map<String, Object>> pendingCandidates = ceRepo.findByUserId(me).stream()
                .filter(ce -> !evaluatedCandidateIds.contains(ce.getCandidateId()))
                .map(ce -> {
                    Candidate c = ce.getCandidate();
                    // fullNameEn is optional at registration and routinely null — Map.of() would NPE.
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", c.getId()); m.put("sessionId", Objects.toString(c.getSessionId(), ""));
                    m.put("fullNameAr", c.getFullNameAr()); m.put("fullNameEn", c.getFullNameEn());
                    m.put("nationalId", Objects.toString(c.getNationalId(), "")); m.put("assignedAt", ce.getAssignedAt());
                    return m;
                }).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
            "evaluations", evals.stream().map(this::mapEval).collect(Collectors.toList()),
            "pendingCandidates", pendingCandidates
        ));
    }

    @GetMapping("/session/{sessionId}")
    @PreAuthorize("hasAnyAuthority('Admin','Manager')")
    public ResponseEntity<?> getSessionEvaluations(@PathVariable UUID sessionId) {
        BigDecimal notQMax = getT("Threshold_NotQualified", BigDecimal.valueOf(17));
        BigDecimal condMax = getT("Threshold_Conditional", BigDecimal.valueOf(23));
        BigDecimal discT   = getT("Threshold_Discrepancy", BigDecimal.valueOf(5));

        List<Candidate> candidates = candidateRepo.findAll().stream()
                .filter(c -> sessionId.equals(c.getSessionId()))
                .collect(Collectors.toList());

        List<Map<String, Object>> result = candidates.stream().map(c -> {
            var submitted = c.getEvaluations().stream()
                    .filter(e -> e.getStatus() != EvaluationStatus.Draft).collect(Collectors.toList());
            BigDecimal avg  = submitted.isEmpty() ? null : BigDecimal.valueOf(submitted.stream().mapToInt(e -> e.getTotalScore() != null ? e.getTotalScore() : 0).average().orElse(0));
            BigDecimal high = submitted.isEmpty() ? null : BigDecimal.valueOf(submitted.stream().mapToInt(e -> e.getTotalScore() != null ? e.getTotalScore() : 0).max().orElse(0));
            BigDecimal low  = submitted.isEmpty() ? null : BigDecimal.valueOf(submitted.stream().mapToInt(e -> e.getTotalScore() != null ? e.getTotalScore() : 0).min().orElse(0));
            BigDecimal var_ = (high != null && low != null) ? high.subtract(low) : null;
            boolean hasDis  = var_ != null && var_.compareTo(discT) > 0;

            Map<String, Object> cm = new LinkedHashMap<>();
            cm.put("id", c.getId()); cm.put("fullNameAr", c.getFullNameAr()); cm.put("fullNameEn", c.getFullNameEn());
            cm.put("nationalId", Objects.toString(c.getNationalId(), ""));
            cm.put("averageScore", avg); cm.put("highestScore", high); cm.put("lowestScore", low); cm.put("variance", var_);
            cm.put("hasDiscrepancy", hasDis);
            cm.put("systemDecision", c.getSystemDecision() != null ? c.getSystemDecision().toString() : null);
            cm.put("finalDecision", c.getFinalDecision() != null ? c.getFinalDecision().toString() : null);
            cm.put("isOverridden", c.getOverriddenBy() != null);
            cm.put("submittedEvaluations", submitted.size());
            cm.put("totalEvaluations", c.getEvaluations().size());
            cm.put("evaluations", c.getEvaluations().stream().map(this::mapEval).collect(Collectors.toList()));
            return cm;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    @PostMapping("/{id}/save")
    @org.springframework.transaction.annotation.Transactional
    @PreAuthorize("hasAuthority('Evaluator')")
    public ResponseEntity<?> saveAnswers(@PathVariable UUID id, @RequestBody SubmitEvaluationRequest req,
                                          Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        Evaluation eval = evalRepo.findById(id).orElse(null);
        if (eval == null) return ResponseEntity.notFound().build();
        if (!eval.getEvaluatorId().equals(me)) return ResponseEntity.status(403).build();
        if (eval.getStatus() != EvaluationStatus.Draft)
            return ResponseEntity.badRequest().body(Map.of("message", "Cannot modify a submitted evaluation."));

        if (req.answers() == null || req.answers().size() > 200 || (req.notes() != null && req.notes().length() > 4000))
            throw new IllegalArgumentException("Invalid evaluation answers or notes.");
        Set<UUID> questionIds = new HashSet<>();
        for (AnswerRequest answer : req.answers()) {
            if (answer == null || answer.questionId() == null || !questionIds.add(answer.questionId()))
                throw new IllegalArgumentException("Each question must occur exactly once.");
            Question question = questionRepo.findById(answer.questionId()).orElseThrow(() -> new IllegalArgumentException("Unknown question."));
            if (!question.isActive() || answer.score() < 0 || answer.score() > question.getMaxScore()
                    || (answer.comment() != null && answer.comment().length() > 4000))
                throw new IllegalArgumentException("Invalid score or comment.");
        }
        answerRepo.deleteAll(answerRepo.findByEvaluationId(id));
        answerRepo.flush();

        List<EvaluationAnswer> newAnswers = req.answers().stream()
                .filter(a -> a.score() >= 1)
                .map(a -> EvaluationAnswer.create(id, a.questionId(), a.score(), a.comment()))
                .collect(Collectors.toList());
        answerRepo.saveAll(newAnswers);
        eval.setNotes(req.notes());
        evalRepo.save(eval);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/submit")
    @org.springframework.transaction.annotation.Transactional
    @PreAuthorize("hasAuthority('Evaluator')")
    public ResponseEntity<?> submitEvaluation(@PathVariable UUID id, Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        BigDecimal notQMax = getT("Threshold_NotQualified", BigDecimal.valueOf(17));
        BigDecimal condMax = getT("Threshold_Conditional", BigDecimal.valueOf(23));
        BigDecimal discT   = getT("Threshold_Discrepancy", BigDecimal.valueOf(5));

        int activeQCount = (int) questionRepo.countByIsActiveTrue();

        Evaluation eval = evalRepo.findById(id).orElse(null);
        if (eval == null) return ResponseEntity.notFound().build();
        if (!eval.getEvaluatorId().equals(me)) return ResponseEntity.status(403).build();

        Set<UUID> activeIds = questionRepo.findByIsActiveTrueOrderByOrderIndex().stream().map(Question::getId).collect(Collectors.toSet());
        Set<UUID> answeredIds = eval.getAnswers().stream().map(EvaluationAnswer::getQuestionId).collect(Collectors.toSet());
        if (!activeIds.equals(answeredIds)) throw new IllegalArgumentException("Answer all active questions before submitting.");
        eval.submit(activeQCount, notQMax, condMax);
        evalRepo.save(eval);

        // AI (feature 2): summarize this evaluator's own submission. Runs off-thread
        // so a slow/unavailable model never delays the submit response.
        afterCommit(() -> aiOrchestrator.generateEvaluationSummary(eval.getId()));

        Candidate candidate = candidateRepo.findById(eval.getCandidateId()).orElse(null);
        if (candidate != null) {
            List<Evaluation> allSubmitted = evalRepo.findByCandidateId(eval.getCandidateId()).stream()
                    .filter(e -> e.getStatus() != EvaluationStatus.Draft)
                    .collect(Collectors.toList());

            if (!allSubmitted.isEmpty()) {
                BigDecimal avg  = BigDecimal.valueOf(allSubmitted.stream().mapToInt(e -> e.getTotalScore() != null ? e.getTotalScore() : 0).average().orElse(0));
                BigDecimal high = BigDecimal.valueOf(allSubmitted.stream().mapToInt(e -> e.getTotalScore() != null ? e.getTotalScore() : 0).max().orElse(0));
                BigDecimal low  = BigDecimal.valueOf(allSubmitted.stream().mapToInt(e -> e.getTotalScore() != null ? e.getTotalScore() : 0).min().orElse(0));
                candidate.updateAggregateScore(avg, high, low, discT, notQMax, condMax);

                long assignedCount = ceRepo.countByCandidateId(candidate.getId());
                if (assignedCount > 0 && allSubmitted.size() >= assignedCount) {
                    candidate.markCompleted();
                    // AI (feature 3): every assigned evaluator is done — generate the
                    // final aggregate summary (also off-thread).
                    afterCommit(() -> aiOrchestrator.generateCandidateFinalSummary(candidate.getId()));
                }

                if (candidate.isHasDiscrepancy()) {
                    userRepo.findAll().stream()
                            .filter(u -> u.getRole() != null && "Manager".equals(u.getRole().getName()) && u.isActive())
                            .forEach(mgr -> notifRepo.save(Notification.create(mgr.getId(),
                                "⚠ تباين عالٍ في التقييمات", "⚠ High Evaluation Discrepancy",
                                "تباين عالٍ بين المقيمين للمرشح.",
                                "High evaluator discrepancy detected.",
                                "Discrepancy", "Candidate", candidate.getId().toString())));
                }
                candidateRepo.save(candidate);
            }
        }

        auditRepo.save(AuditLog.create("EVALUATION_SUBMITTED", "Evaluation", id.toString(), me,
            null, "{\"totalScore\":" + eval.getTotalScore() + "}", null));

        return ResponseEntity.ok(Map.of(
            "totalScore", eval.getTotalScore(),
            "systemDecision", eval.getSystemDecision() != null ? eval.getSystemDecision().toString() : null,
            "aggregateScore", candidate != null ? candidate.getAggregateScore() : null,
            "hasDiscrepancy", candidate != null && candidate.isHasDiscrepancy(),
            "variance", candidate != null ? candidate.getScoreVariance() : null
        ));
    }

    private void afterCommit(Runnable task) {
        org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                new org.springframework.transaction.support.TransactionSynchronization() {
                    @Override public void afterCommit() { task.run(); }
                });
    }

    private Map<String, Object> mapEval(Evaluation e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", e.getId()); m.put("candidateId", e.getCandidateId());
        m.put("candidateNameAr", e.getCandidate() != null ? e.getCandidate().getFullNameAr() : "");
        m.put("candidateNameEn", e.getCandidate() != null ? e.getCandidate().getFullNameEn() : "");
        m.put("evaluatorId", e.getEvaluatorId());
        m.put("evaluatorNameAr", e.getEvaluator() != null ? e.getEvaluator().getFullNameAr() : "");
        m.put("totalScore", e.getTotalScore());
        m.put("systemDecision", e.getSystemDecision() != null ? e.getSystemDecision().toString() : null);
        m.put("status", e.getStatus().toString());
        m.put("notes", e.getNotes()); m.put("submittedAt", e.getSubmittedAt());
        m.put("aiSummary", e.getAiSummary());
        m.put("answers", e.getAnswers().stream()
            .sorted(Comparator.comparingInt(a -> a.getQuestion().getOrderIndex()))
            .map(a -> Map.of("questionId", a.getQuestionId(),
                "questionTextAr", a.getQuestion().getTextAr(),
                "questionTextEn", Objects.toString(a.getQuestion().getTextEn(), ""),
                "questionOrder", a.getQuestion().getOrderIndex(),
                "score", a.getScore(), "comment", Objects.toString(a.getComment(), "")))
            .collect(Collectors.toList()));
        return m;
    }

    private BigDecimal getT(String key, BigDecimal def) {
        return settingRepo.findByKey(key)
                .map(s -> { try { return new BigDecimal(s.getValue()); } catch (Exception e) { return def; } })
                .orElse(def);
    }

    record StartEvaluationRequest(UUID candidateId, UUID sessionId) {}
    record AnswerRequest(UUID questionId, int score, String comment) {}
    record SubmitEvaluationRequest(List<AnswerRequest> answers, String notes) {}
}
