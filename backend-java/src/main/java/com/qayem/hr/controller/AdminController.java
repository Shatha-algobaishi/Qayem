package com.qayem.hr.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import com.qayem.hr.entity.*;
import com.qayem.hr.enums.EvaluationStatus;
import com.qayem.hr.repository.*;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasAuthority('Admin')")
public class AdminController {

    private final QuestionRepository questionRepo;
    private final EvaluationAnswerRepository answerRepo;
    private final SystemSettingRepository settingRepo;
    private final ReferenceListRepository refListRepo;
    private final ReferenceListItemRepository refItemRepo;
    private final EvaluationRepository evalRepo;
    private final CandidateRepository candidateRepo;
    private final CandidateEvaluatorRepository ceRepo;
    private final AuditLogRepository auditRepo;

    public AdminController(QuestionRepository questionRepo, EvaluationAnswerRepository answerRepo,
                           SystemSettingRepository settingRepo, ReferenceListRepository refListRepo,
                           ReferenceListItemRepository refItemRepo, EvaluationRepository evalRepo,
                           CandidateRepository candidateRepo, CandidateEvaluatorRepository ceRepo,
                           AuditLogRepository auditRepo) {
        this.questionRepo = questionRepo;
        this.answerRepo = answerRepo;
        this.settingRepo = settingRepo;
        this.refListRepo = refListRepo;
        this.refItemRepo = refItemRepo;
        this.evalRepo = evalRepo;
        this.candidateRepo = candidateRepo;
        this.ceRepo = ceRepo;
        this.auditRepo = auditRepo;
    }

    // ── Questions ─────────────────────────────────────────────────────────────

    @GetMapping("/questions")
    public ResponseEntity<?> getAllQuestions() {
        return ResponseEntity.ok(questionRepo.findAllByOrderByOrderIndex().stream().map(q -> Map.of(
            "id", q.getId(), "textAr", q.getTextAr(),
            "textEn", Objects.toString(q.getTextEn(), ""),
            "category", Objects.toString(q.getCategory(), ""),
            "orderIndex", q.getOrderIndex(), "maxScore", q.getMaxScore(), "isActive", q.isActive()
        )).collect(Collectors.toList()));
    }

    @PostMapping("/questions")
    public ResponseEntity<?> createQuestion(@RequestBody QuestionRequest req, Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        if (questionRepo.existsByOrderIndex(req.orderIndex()))
            return ResponseEntity.status(409).body(Map.of("message", "A question with this order index already exists."));

        Question q = Question.create(req.textAr(), req.textEn(), req.orderIndex(), req.category(), req.maxScore());
        questionRepo.save(q);
        auditRepo.save(AuditLog.create("QUESTION_CREATED", "Question", q.getId().toString(), me));
        return ResponseEntity.status(201).body(Map.of("id", q.getId()));
    }

    @PutMapping("/questions/{id}")
    public ResponseEntity<?> updateQuestion(@PathVariable UUID id, @RequestBody QuestionRequest req,
                                             Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        Question q = questionRepo.findById(id).orElse(null);
        if (q == null) return ResponseEntity.notFound().build();
        q.update(req.textAr(), req.textEn(), req.category(), req.maxScore());
        questionRepo.save(q);
        auditRepo.save(AuditLog.create("QUESTION_UPDATED", "Question", id.toString(), me));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/questions/{id}/activate")
    public ResponseEntity<?> activateQuestion(@PathVariable UUID id, Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        Question q = questionRepo.findById(id).orElse(null);
        if (q == null) return ResponseEntity.notFound().build();
        q.activate(); questionRepo.save(q);
        auditRepo.save(AuditLog.create("QUESTION_ACTIVATED", "Question", id.toString(), me));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/questions/{id}/deactivate")
    public ResponseEntity<?> deactivateQuestion(@PathVariable UUID id, Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        Question q = questionRepo.findById(id).orElse(null);
        if (q == null) return ResponseEntity.notFound().build();
        if (questionRepo.countByIsActiveTrue() <= 1)
            return ResponseEntity.badRequest().body(Map.of("message", "At least one question must remain active."));
        q.deactivate(); questionRepo.save(q);
        auditRepo.save(AuditLog.create("QUESTION_DEACTIVATED", "Question", id.toString(), me));
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/questions/reorder")
    public ResponseEntity<?> reorderQuestions(@RequestBody ReorderRequest req, Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        req.items().forEach(item -> questionRepo.findById(item.id())
                .ifPresent(q -> { q.reorder(item.orderIndex()); questionRepo.save(q); }));
        auditRepo.save(AuditLog.create("QUESTIONS_REORDERED", "Question", "batch", me));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/questions/{id}")
    public ResponseEntity<?> deleteQuestion(@PathVariable UUID id, Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        Question q = questionRepo.findById(id).orElse(null);
        if (q == null) return ResponseEntity.notFound().build();

        if (answerRepo.existsByQuestionId(id)) {
            q.deactivate(); questionRepo.save(q);
            auditRepo.save(AuditLog.create("QUESTION_DEACTIVATED_HAS_DATA", "Question", id.toString(), me));
            return ResponseEntity.ok(Map.of("message", "Question has existing evaluation data — deactivated instead of deleted."));
        }
        questionRepo.delete(q);
        auditRepo.save(AuditLog.create("QUESTION_DELETED", "Question", id.toString(), me));
        return ResponseEntity.noContent().build();
    }

    // ── Settings ──────────────────────────────────────────────────────────────

    @GetMapping("/settings")
    public ResponseEntity<?> getSettings() {
        return ResponseEntity.ok(settingRepo.findAll().stream()
                .sorted(Comparator.comparing(SystemSetting::getKey))
                .map(s -> Map.of("id", s.getId(), "key", s.getKey(), "value", s.getValue(),
                    "description", Objects.toString(s.getDescription(), ""),
                    "descriptionAr", Objects.toString(s.getDescriptionAr(), ""),
                    "dataType", Objects.toString(s.getDataType(), "")))
                .collect(Collectors.toList()));
    }

    @PutMapping("/settings/{key}")
    public ResponseEntity<?> updateSetting(@PathVariable String key, @RequestBody Map<String, String> body,
                                            Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        if (!key.equals(body.get("key"))) return ResponseEntity.badRequest().body(Map.of("message", "Key mismatch."));
        SystemSetting setting = settingRepo.findByKey(key).orElse(null);
        if (setting == null) return ResponseEntity.notFound().build();
        setting.updateValue(body.get("value"));
        settingRepo.save(setting);
        auditRepo.save(AuditLog.create("SETTING_CHANGED", "SystemSetting", key, me,
            null, "{\"value\":\"" + body.get("value") + "\"}", null));
        return ResponseEntity.noContent().build();
    }

    // ── Reference Lists ───────────────────────────────────────────────────────

    @GetMapping("/reference-lists")
    public ResponseEntity<?> getReferenceLists() {
        return ResponseEntity.ok(refListRepo.findAll().stream()
                .sorted(Comparator.comparing(ReferenceList::getListName))
                .map(r -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", r.getId()); m.put("listName", r.getListName());
                    m.put("labelAr", r.getLabelAr()); m.put("labelEn", r.getLabelEn());
                    m.put("isActive", r.isActive());
                    m.put("items", r.getItems().stream().filter(ReferenceListItem::isActive)
                        .sorted(Comparator.comparingInt(ReferenceListItem::getOrderIndex))
                        .map(i -> Map.of("id", i.getId(), "valueAr", i.getValueAr(),
                            "valueEn", Objects.toString(i.getValueEn(), ""),
                            "orderIndex", i.getOrderIndex(), "isActive", i.isActive()))
                        .collect(Collectors.toList()));
                    return m;
                }).collect(Collectors.toList()));
    }

    @GetMapping("/reference-lists/{listName}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getReferenceList(@PathVariable String listName) {
        String canonical = switch (listName) {
            case "Departments" -> "Department";
            case "GeneralDepartments" -> "GeneralDepartment";
            case "Agencies" -> "Agency";
            case "Qualifications" -> "Qualification";
            case "ApplicationTypes" -> "ApplicationType";
            default -> listName;
        };
        ReferenceList list = refListRepo.findByListName(canonical).orElse(null);
        if (list == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of(
            "id", list.getId(), "listName", list.getListName(),
            "labelAr", list.getLabelAr(), "labelEn", Objects.toString(list.getLabelEn(), ""),
            "items", list.getItems().stream().filter(ReferenceListItem::isActive)
                .sorted(Comparator.comparingInt(ReferenceListItem::getOrderIndex))
                .map(i -> Map.of("id", i.getId(), "valueAr", i.getValueAr(),
                    "valueEn", Objects.toString(i.getValueEn(), ""), "orderIndex", i.getOrderIndex()))
                .collect(Collectors.toList())
        ));
    }

    @PostMapping("/reference-lists/{listName}/items")
    public ResponseEntity<?> addRefItem(@PathVariable String listName, @RequestBody RefItemRequest req,
                                         Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        ReferenceList list = refListRepo.findByListName(listName).orElse(null);
        if (list == null) return ResponseEntity.status(404).body(Map.of("message", "Reference list not found."));

        Integer maxOrder = refItemRepo.findMaxOrderIndex(list.getId());
        int nextOrder = maxOrder != null ? maxOrder + 1 : 1;
        ReferenceListItem item = ReferenceListItem.create(list.getId(), req.valueAr(), req.valueEn(), nextOrder);
        refItemRepo.save(item);
        auditRepo.save(AuditLog.create("REFLIST_ITEM_ADDED", "ReferenceListItem", listName, me));
        return ResponseEntity.ok(Map.of("id", item.getId(), "valueAr", item.getValueAr(),
            "valueEn", Objects.toString(item.getValueEn(), ""), "orderIndex", item.getOrderIndex()));
    }

    @PutMapping("/reference-lists/items/{itemId}")
    public ResponseEntity<?> updateRefItem(@PathVariable UUID itemId, @RequestBody RefItemRequest req,
                                            Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        ReferenceListItem item = refItemRepo.findById(itemId).orElse(null);
        if (item == null) return ResponseEntity.notFound().build();
        item.update(req.valueAr(), req.valueEn(), item.getOrderIndex());
        refItemRepo.save(item);
        auditRepo.save(AuditLog.create("REFLIST_ITEM_UPDATED", "ReferenceListItem", itemId.toString(), me));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/reference-lists/items/{itemId}")
    public ResponseEntity<?> deleteRefItem(@PathVariable UUID itemId, Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        ReferenceListItem item = refItemRepo.findById(itemId).orElse(null);
        if (item == null) return ResponseEntity.notFound().build();
        item.deactivate(); refItemRepo.save(item);
        auditRepo.save(AuditLog.create("REFLIST_ITEM_DELETED", "ReferenceListItem", itemId.toString(), me));
        return ResponseEntity.noContent().build();
    }

    // ── Delete evaluation ─────────────────────────────────────────────────────

    @DeleteMapping("/evaluations/{id}")
    public ResponseEntity<?> deleteEvaluation(@PathVariable UUID id, Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        Evaluation eval = evalRepo.findById(id).orElse(null);
        if (eval == null) return ResponseEntity.notFound().build();

        UUID candidateId = eval.getCandidateId();
        UUID evaluatorId = eval.getEvaluatorId();

        answerRepo.deleteAll(eval.getAnswers());
        evalRepo.delete(eval);

        ceRepo.findByCandidateIdAndUserId(candidateId, evaluatorId).ifPresent(ceRepo::delete);

        auditRepo.save(AuditLog.create("ADMIN_DELETE_EVALUATION", "Evaluation", id.toString(), me));

        // Recompute aggregate
        Candidate candidate = candidateRepo.findById(candidateId).orElse(null);
        if (candidate != null) {
            List<Evaluation> remaining = evalRepo.findByCandidateId(candidateId).stream()
                    .filter(e -> e.getStatus() != EvaluationStatus.Draft && e.getTotalScore() != null)
                    .collect(Collectors.toList());
            if (!remaining.isEmpty()) {
                BigDecimal notQ = getT("Threshold_NotQualified", BigDecimal.valueOf(17));
                BigDecimal cond = getT("Threshold_Conditional", BigDecimal.valueOf(23));
                BigDecimal disc = getT("Threshold_Discrepancy", BigDecimal.valueOf(5));
                BigDecimal avg  = BigDecimal.valueOf(remaining.stream().mapToInt(e -> e.getTotalScore()).average().orElse(0));
                BigDecimal high = BigDecimal.valueOf(remaining.stream().mapToInt(e -> e.getTotalScore()).max().orElse(0));
                BigDecimal low  = BigDecimal.valueOf(remaining.stream().mapToInt(e -> e.getTotalScore()).min().orElse(0));
                candidate.updateAggregateScore(avg, high, low, disc, notQ, cond);
            } else {
                candidate.resetAggregateScore();
            }
            candidateRepo.save(candidate);
        }
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/fix-candidate-statuses")
    public ResponseEntity<?> fixCandidateStatuses() {
        int statusFixed = 0, decisionCleared = 0;
        for (Candidate c : candidateRepo.findAll()) {
            long assignedCount  = ceRepo.countByCandidateId(c.getId());
            long submittedCount = c.getEvaluations().stream()
                    .filter(e -> e.getStatus() == EvaluationStatus.Submitted || e.getStatus() == EvaluationStatus.ReviewedByManager)
                    .count();

            com.qayem.hr.enums.CandidateStatus target;
            if (assignedCount == 0) target = com.qayem.hr.enums.CandidateStatus.Pending;
            else if (submittedCount >= assignedCount) target = com.qayem.hr.enums.CandidateStatus.Completed;
            else target = com.qayem.hr.enums.CandidateStatus.InProgress;

            if (c.getCandidateStatus() != target) {
                if (target == com.qayem.hr.enums.CandidateStatus.Pending)       c.resetToPending();
                else if (target == com.qayem.hr.enums.CandidateStatus.InProgress) c.markInProgress();
                else c.markCompleted();
                statusFixed++;
            }

            if (c.getFinalDecision() != null && c.getOverriddenBy() == null) {
                c.clearFinalDecision(); decisionCleared++;
            }
            candidateRepo.save(c);
        }
        return ResponseEntity.ok(Map.of("statusFixed", statusFixed, "decisionCleared", decisionCleared));
    }

    private BigDecimal getT(String key, BigDecimal def) {
        return settingRepo.findByKey(key)
                .map(s -> { try { return new BigDecimal(s.getValue()); } catch (Exception e) { return def; } })
                .orElse(def);
    }

    record QuestionRequest(String textAr, String textEn, int orderIndex, String category, int maxScore) {}
    record ReorderItem(UUID id, int orderIndex) {}
    record ReorderRequest(List<ReorderItem> items) {}
    record RefItemRequest(String valueAr, String valueEn) {}
}
