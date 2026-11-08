package com.qayem.hr.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import com.qayem.hr.entity.*;
import com.qayem.hr.enums.*;
import com.qayem.hr.repository.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/reports")
@PreAuthorize("hasAnyAuthority('Admin','Manager')")
public class ReportsController {

    private final CandidateRepository candidateRepo;
    private final SessionRepository sessionRepo;
    private final EvaluationRepository evalRepo;
    private final UserRepository userRepo;

    public ReportsController(CandidateRepository candidateRepo, SessionRepository sessionRepo,
                              EvaluationRepository evalRepo, UserRepository userRepo) {
        this.candidateRepo = candidateRepo;
        this.sessionRepo = sessionRepo;
        this.evalRepo = evalRepo;
        this.userRepo = userRepo;
    }

    @GetMapping("/candidates")
    public ResponseEntity<?> candidatesReport(@RequestParam(required = false) UUID sessionId,
                                               @RequestParam(required = false) String decision,
                                               @RequestParam(defaultValue = "false") boolean exportCsv) {
        EvaluationDecision decEnum = null;
        if (decision != null) try { decEnum = EvaluationDecision.valueOf(decision); } catch (Exception ignored) {}
        final EvaluationDecision finalDec = decEnum;

        List<Candidate> all = candidateRepo.findAll().stream()
                .filter(c -> sessionId == null || sessionId.equals(c.getSessionId()))
                .filter(c -> finalDec == null || finalDec.equals(c.getFinalDecision()))
                .sorted(Comparator.comparing(c -> c.getSession() != null ? c.getSession().getSessionCode() : ""))
                .collect(Collectors.toList());

        List<Map<String, Object>> data = all.stream().map(c -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("nationalId", c.getNationalId()); m.put("fullNameAr", c.getFullNameAr());
            m.put("fullNameEn", c.getFullNameEn()); m.put("qualification", c.getQualification());
            m.put("university", c.getUniversity()); m.put("gpa", c.getGpa()); m.put("gpaSystem", c.getGpaSystem());
            m.put("yearsOfExperience", c.getYearsOfExperience()); m.put("applicationType", c.getApplicationType());
            m.put("sessionCode", c.getSession() != null ? c.getSession().getSessionCode() : "");
            m.put("sessionTitleAr", c.getSession() != null ? c.getSession().getTitleAr() : "");
            m.put("department", c.getSession() != null ? c.getSession().getDepartment() : "");
            m.put("aggregateScore", c.getAggregateScore());
            m.put("systemDecision", c.getSystemDecision() != null ? c.getSystemDecision().toString() : null);
            m.put("finalDecision", c.getFinalDecision() != null ? c.getFinalDecision().toString() : null);
            m.put("hasDiscrepancy", c.isHasDiscrepancy()); m.put("isOverridden", c.getOverriddenBy() != null);
            m.put("overrideReason", c.getOverrideReason()); m.put("registeredAt", c.getRegisteredAt());
            return m;
        }).collect(Collectors.toList());

        if (exportCsv) {
            String[] headers = {"رقم الهوية","الاسم عربي","الاسم إنجليزي","المؤهل","الجامعة","المعدل","نظام المعدل",
                "سنوات الخبرة","نوع الطلب","كود الجلسة","عنوان الجلسة","القسم","متوسط الدرجة","قرار النظام",
                "القرار النهائي","تباين","تعديل مدير","سبب التعديل","تاريخ التسجيل"};
            List<Object[]> rows = data.stream().map(r -> new Object[]{
                r.get("nationalId"), r.get("fullNameAr"), r.get("fullNameEn"), r.get("qualification"), r.get("university"),
                r.get("gpa"), r.get("gpaSystem"), r.get("yearsOfExperience"), r.get("applicationType"),
                r.get("sessionCode"), r.get("sessionTitleAr"), r.get("department"), r.get("aggregateScore"),
                r.get("systemDecision"), r.get("finalDecision"),
                Boolean.TRUE.equals(r.get("hasDiscrepancy")) ? "نعم" : "لا",
                Boolean.TRUE.equals(r.get("isOverridden")) ? "نعم" : "لا", r.get("overrideReason"), r.get("registeredAt")
            }).collect(Collectors.toList());
            return csvResponse(rows, headers, "candidates-report");
        }

        return ResponseEntity.ok(Map.of("totalCount", data.size(), "items", data));
    }

    @GetMapping("/sessions")
    public ResponseEntity<?> sessionsReport(@RequestParam(required = false) String status,
                                             @RequestParam(defaultValue = "false") boolean exportCsv) {
        SessionStatus stEnum = null;
        if (status != null) try { stEnum = SessionStatus.valueOf(status); } catch (Exception ignored) {}
        final SessionStatus finalSt = stEnum;

        List<Map<String, Object>> data = sessionRepo.findAll().stream()
                .filter(s -> finalSt == null || finalSt.equals(s.getStatus()))
                .sorted(Comparator.comparing(InterviewSession::getCreatedAt, Comparator.reverseOrder()))
                .map(s -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("sessionCode", s.getSessionCode()); m.put("titleAr", s.getTitleAr());
                    m.put("department", s.getDepartment()); m.put("agency", s.getAgency());
                    m.put("jobPositionAr", s.getJobPositionAr());
                    m.put("scheduledDate", s.getScheduledDate()); m.put("status", s.getStatus().toString());
                    m.put("totalCandidates", s.getCandidates().size());
                    m.put("evaluated", s.getCandidates().stream().filter(c -> c.getAggregateScore() != null).count());
                    m.put("recommended", s.getCandidates().stream().filter(c -> EvaluationDecision.Recommended.equals(c.getFinalDecision())).count());
                    m.put("conditional", s.getCandidates().stream().filter(c -> EvaluationDecision.ConditionallyQualified.equals(c.getFinalDecision())).count());
                    m.put("notQualified", s.getCandidates().stream().filter(c -> EvaluationDecision.NotQualified.equals(c.getFinalDecision())).count());
                    m.put("discrepancies", s.getCandidates().stream().filter(Candidate::isHasDiscrepancy).count());
                    m.put("evaluatorCount", s.getEvaluators().stream().filter(SessionEvaluator::isActive).count());
                    m.put("createdAt", s.getCreatedAt()); m.put("closedAt", s.getClosedAt());
                    return m;
                }).collect(Collectors.toList());

        if (exportCsv) {
            String[] headers = {"كود الجلسة","العنوان","القسم","الجهة","المسمى الوظيفي","تاريخ الجلسة","الحالة",
                "إجمالي المرشحين","تم تقييمهم","يُوصى بهم","مؤهلون","غير مؤهلين","تباينات","عدد المقيّمين","تاريخ الإنشاء","تاريخ الإغلاق"};
            List<Object[]> rows = data.stream().map(r -> new Object[]{
                r.get("sessionCode"), r.get("titleAr"), r.get("department"), r.get("agency"), r.get("jobPositionAr"),
                r.get("scheduledDate"), r.get("status"), r.get("totalCandidates"), r.get("evaluated"),
                r.get("recommended"), r.get("conditional"), r.get("notQualified"), r.get("discrepancies"),
                r.get("evaluatorCount"), r.get("createdAt"), r.get("closedAt")
            }).collect(Collectors.toList());
            return csvResponse(rows, headers, "sessions-report");
        }
        return ResponseEntity.ok(Map.of("totalCount", data.size(), "items", data));
    }

    @GetMapping("/evaluators")
    public ResponseEntity<?> evaluatorsReport(@RequestParam(defaultValue = "false") boolean exportCsv) {
        List<Evaluation> submitted = evalRepo.findAll().stream()
                .filter(e -> e.getStatus() != EvaluationStatus.Draft && e.getTotalScore() != null)
                .collect(Collectors.toList());

        Map<UUID, Double> candAvgs = submitted.stream().collect(Collectors.groupingBy(
            Evaluation::getCandidateId, Collectors.averagingInt(Evaluation::getTotalScore)));

        List<Map<String, Object>> data = submitted.stream()
                .collect(Collectors.groupingBy(Evaluation::getEvaluatorId))
                .entrySet().stream().map(entry -> {
                    List<Evaluation> evals = entry.getValue();
                    double[] scores = evals.stream().mapToDouble(e -> e.getTotalScore()).toArray();
                    double avg = Arrays.stream(scores).average().orElse(0);
                    OptionalDouble devs = evals.stream().filter(e -> candAvgs.containsKey(e.getCandidateId()))
                            .mapToDouble(e -> e.getTotalScore() - candAvgs.get(e.getCandidateId())).average();
                    double meanDev = devs.isPresent() ? devs.getAsDouble() : 0;
                    String bias = meanDev > 5 ? "انحياز إيجابي" : meanDev < -5 ? "انحياز سلبي" : "اتساق معياري";

                    User ev = userRepo.findById(entry.getKey()).orElse(null);
                    return Map.<String, Object>of(
                        "fullNameAr", ev != null ? ev.getFullNameAr() : "",
                        "fullNameEn", ev != null ? Objects.toString(ev.getFullNameEn(), "") : "",
                        "totalEvaluations", evals.size(),
                        "averageScore", BigDecimal.valueOf(avg).setScale(2, RoundingMode.HALF_UP),
                        "minScore", (int) Arrays.stream(scores).min().orElse(0),
                        "maxScore", (int) Arrays.stream(scores).max().orElse(0),
                        "meanDeviation", BigDecimal.valueOf(meanDev).setScale(2, RoundingMode.HALF_UP),
                        "biasLabel", bias
                    );
                }).sorted((a, b) -> ((Integer)b.get("totalEvaluations")).compareTo((Integer)a.get("totalEvaluations")))
                .collect(Collectors.toList());

        if (exportCsv) {
            String[] headers = {"الاسم عربي","الاسم إنجليزي","إجمالي التقييمات","متوسط الدرجات المعطاة","أدنى درجة","أعلى درجة","متوسط الانحراف","تصنيف الانحياز"};
            List<Object[]> rows = data.stream().map(r -> new Object[]{
                r.get("fullNameAr"), r.get("fullNameEn"), r.get("totalEvaluations"), r.get("averageScore"),
                r.get("minScore"), r.get("maxScore"), r.get("meanDeviation"), r.get("biasLabel")
            }).collect(Collectors.toList());
            return csvResponse(rows, headers, "evaluators-report");
        }
        return ResponseEntity.ok(Map.of("totalCount", data.size(), "items", data));
    }

    @GetMapping("/results")
    public ResponseEntity<?> resultsReport(@RequestParam(required = false) UUID sessionId,
                                            @RequestParam(defaultValue = "false") boolean exportCsv) {
        List<Map<String, Object>> data = candidateRepo.findAll().stream()
                .filter(c -> c.getFinalDecision() != null && (sessionId == null || sessionId.equals(c.getSessionId())))
                .sorted(Comparator.comparing((Candidate c) -> c.getSession() != null ? c.getSession().getSessionCode() : "")
                        .thenComparing(Comparator.comparing(Candidate::getAggregateScore, Comparator.nullsLast(Comparator.reverseOrder()))))
                .map(c -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("nationalId", c.getNationalId()); m.put("fullNameAr", c.getFullNameAr()); m.put("fullNameEn", c.getFullNameEn());
                    m.put("sessionCode", c.getSession() != null ? c.getSession().getSessionCode() : "");
                    m.put("sessionTitleAr", c.getSession() != null ? c.getSession().getTitleAr() : "");
                    m.put("department", c.getSession() != null ? c.getSession().getDepartment() : "");
                    m.put("aggregateScore", c.getAggregateScore()); m.put("highestScore", c.getHighestScore());
                    m.put("lowestScore", c.getLowestScore()); m.put("scoreVariance", c.getScoreVariance());
                    m.put("finalDecision", c.getFinalDecision().toString());
                    m.put("isOverridden", c.getOverriddenBy() != null); m.put("overrideReason", c.getOverrideReason());
                    m.put("hasDiscrepancy", c.isHasDiscrepancy());
                    return m;
                }).collect(Collectors.toList());

        if (exportCsv) {
            String[] headers = {"رقم الهوية","الاسم عربي","الاسم إنجليزي","كود الجلسة","عنوان الجلسة","القسم","متوسط الدرجة","أعلى درجة","أدنى درجة","الفارق","القرار النهائي","تعديل مدير","سبب التعديل","تباين"};
            List<Object[]> rows = data.stream().map(r -> new Object[]{
                r.get("nationalId"), r.get("fullNameAr"), r.get("fullNameEn"),
                r.get("sessionCode"), r.get("sessionTitleAr"), r.get("department"),
                r.get("aggregateScore"), r.get("highestScore"), r.get("lowestScore"), r.get("scoreVariance"),
                r.get("finalDecision"), Boolean.TRUE.equals(r.get("isOverridden")) ? "نعم" : "لا",
                r.get("overrideReason"), Boolean.TRUE.equals(r.get("hasDiscrepancy")) ? "نعم" : "لا"
            }).collect(Collectors.toList());
            return csvResponse(rows, headers, "results-report");
        }
        return ResponseEntity.ok(Map.of("totalCount", data.size(), "items", data));
    }

    private ResponseEntity<?> csvResponse(List<Object[]> rows, String[] headers, String fileBase) {
        StringBuilder sb = new StringBuilder();
        sb.append(String.join(",", Arrays.stream(headers).map(this::quoteCsv).toList())).append("\r\n");
        rows.forEach(row -> sb.append(Arrays.stream(row)
                .map(v -> quoteCsv(v != null ? v.toString() : ""))
                .collect(Collectors.joining(","))).append("\r\n"));

        byte[] bom  = new byte[]{(byte)0xEF, (byte)0xBB, (byte)0xBF};
        byte[] body = sb.toString().getBytes(StandardCharsets.UTF_8);
        byte[] out  = new byte[bom.length + body.length];
        System.arraycopy(bom, 0, out, 0, bom.length);
        System.arraycopy(body, 0, out, bom.length, body.length);

        String filename = fileBase + "-" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) + ".csv";
        return ResponseEntity.ok()
                .header("Content-Type", "text/csv; charset=utf-8")
                .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
                .body(out);
    }

    private String quoteCsv(String v) {
        if (v == null) return "";
        v = v.replace("\"", "\"\"");
        return (v.contains(",") || v.contains("\"") || v.contains("\n")) ? "\"" + v + "\"" : v;
    }
}
