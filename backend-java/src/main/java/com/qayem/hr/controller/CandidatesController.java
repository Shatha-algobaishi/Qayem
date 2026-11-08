package com.qayem.hr.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.qayem.hr.ai.AiService;
import com.qayem.hr.ai.CvTextExtractor;
import com.qayem.hr.entity.*;
import com.qayem.hr.enums.*;
import com.qayem.hr.repository.*;
import com.qayem.hr.security.JwtUtil;

import java.io.*;
import java.math.BigDecimal;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/candidates")
@PreAuthorize("hasAnyAuthority('Admin','Manager','DataEntry','Evaluator')")
public class CandidatesController {

    private final CandidateRepository candidateRepo;
    private final CandidateEvaluatorRepository ceRepo;
    private final SessionRepository sessionRepo;
    private final SystemSettingRepository settingRepo;
    private final UserRepository userRepo;
    private final RoleRepository roleRepo;
    private final UserRoleRepository userRoleRepo;
    private final AuditLogRepository auditRepo;
    private final JwtUtil jwtUtil;
    private final CvTextExtractor cvTextExtractor;
    private final AiService aiService;

    @Value("${app.uploads-path:/app/uploads}")
    private String uploadsPath;

    @Value("${app.max-file-size-mb:10}")
    private int maxFileSizeMb;

    public CandidatesController(CandidateRepository candidateRepo, CandidateEvaluatorRepository ceRepo,
                                  SessionRepository sessionRepo, SystemSettingRepository settingRepo,
                                  UserRepository userRepo, RoleRepository roleRepo,
                                  UserRoleRepository userRoleRepo, AuditLogRepository auditRepo,
                                  JwtUtil jwtUtil, CvTextExtractor cvTextExtractor, AiService aiService) {
        this.candidateRepo = candidateRepo;
        this.ceRepo = ceRepo;
        this.sessionRepo = sessionRepo;
        this.settingRepo = settingRepo;
        this.userRepo = userRepo;
        this.roleRepo = roleRepo;
        this.userRoleRepo = userRoleRepo;
        this.auditRepo = auditRepo;
        this.jwtUtil = jwtUtil;
        this.cvTextExtractor = cvTextExtractor;
        this.aiService = aiService;
    }

    @GetMapping("/available-evaluators")
    @PreAuthorize("hasAnyAuthority('Admin','DataEntry')")
    public ResponseEntity<?> getAvailableEvaluators() {
        Role evalRole = roleRepo.findByName("Evaluator").orElse(null);
        if (evalRole == null) return ResponseEntity.ok(List.of());

        List<UUID> evalUserIds = userRoleRepo.findAll().stream()
                .filter(ur -> ur.getRoleId().equals(evalRole.getId()))
                .map(UserRole::getUserId).collect(Collectors.toList());

        List<Map<String, Object>> result = userRepo.findAll().stream()
                .filter(u -> u.isActive() && !u.isDeleted()
                        && (evalRole.getId().equals(u.getRoleId()) || evalUserIds.contains(u.getId())))
                .sorted(Comparator.comparing(User::getFullNameAr))
                .map(u -> Map.<String, Object>of("id", u.getId(), "fullNameAr", u.getFullNameAr(),
                        "fullNameEn", Objects.toString(u.getFullNameEn(), ""), "email", u.getEmail()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @GetMapping
    public ResponseEntity<?> getCandidates(
            @RequestParam(required = false) UUID sessionId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String applicationType,
            @RequestParam(required = false) Boolean hasSession,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String systemDecision,
            @RequestParam(required = false) String finalDecision,
            @RequestParam(required = false) BigDecimal minScore,
            @RequestParam(required = false) BigDecimal maxScore,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize, Authentication auth) {
        if (page < 1 || pageSize < 1 || pageSize > 200) throw new IllegalArgumentException("Invalid pagination.");

        Specification<Candidate> spec = (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            boolean unrestricted = auth.getAuthorities().stream().anyMatch(a -> List.of("Admin", "Manager", "DataEntry").contains(a.getAuthority()));
            if (!unrestricted) {
                UUID me = UUID.fromString(auth.getName());
                var direct = query.subquery(UUID.class);
                var assigned = direct.from(CandidateEvaluator.class);
                direct.select(assigned.get("candidateId")).where(cb.equal(assigned.get("userId"), me));
                var viaSession = query.subquery(UUID.class);
                var assignedSession = viaSession.from(SessionEvaluator.class);
                viaSession.select(assignedSession.get("sessionId")).where(cb.equal(assignedSession.get("userId"), me), cb.isTrue(assignedSession.get("isActive")));
                predicates.add(cb.or(root.get("id").in(direct), root.get("sessionId").in(viaSession)));
            }
            if (sessionId != null) predicates.add(cb.equal(root.get("sessionId"), sessionId));
            if (hasSession != null)
                predicates.add(hasSession ? cb.isNotNull(root.get("sessionId")) : cb.isNull(root.get("sessionId")));
            if (search != null && !search.isBlank()) {
                String like = "%" + search.toLowerCase() + "%";
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("fullNameAr")), like),
                    cb.like(cb.lower(root.get("fullNameEn")), like),
                    cb.like(cb.lower(root.get("nationalId")), like)
                ));
            }
            if (applicationType != null && !applicationType.isBlank())
                predicates.add(cb.equal(root.get("applicationType"), applicationType));
            if (status != null) {
                try { predicates.add(cb.equal(root.get("candidateStatus"), CandidateStatus.valueOf(status))); }
                catch (IllegalArgumentException ignored) {}
            }
            if (systemDecision != null) {
                try { predicates.add(cb.equal(root.get("systemDecision"), EvaluationDecision.valueOf(systemDecision))); }
                catch (IllegalArgumentException ignored) {}
            }
            if (finalDecision != null) {
                try { predicates.add(cb.equal(root.get("finalDecision"), EvaluationDecision.valueOf(finalDecision))); }
                catch (IllegalArgumentException ignored) {}
            }
            if (minScore != null) predicates.add(cb.greaterThanOrEqualTo(root.get("aggregateScore"), minScore));
            if (maxScore != null) predicates.add(cb.lessThanOrEqualTo(root.get("aggregateScore"), maxScore));
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };

        Pageable pageable = PageRequest.of(page - 1, pageSize, Sort.by("registeredAt"));
        Page<Candidate> pg = candidateRepo.findAll(spec, pageable);

        BigDecimal notQMax = getThreshold("Threshold_NotQualified", BigDecimal.valueOf(17));
        BigDecimal condMax = getThreshold("Threshold_Conditional", BigDecimal.valueOf(23));

        List<Map<String, Object>> items = pg.getContent().stream().map(c -> {
            var submitted = c.getEvaluations().stream()
                    .filter(e -> e.getStatus() != EvaluationStatus.Draft && e.getTotalScore() != null)
                    .collect(Collectors.toList());
            BigDecimal liveAvg = submitted.isEmpty() ? null
                    : BigDecimal.valueOf(submitted.stream().mapToInt(Evaluation::getTotalScore).average().orElse(0));
            BigDecimal effectiveScore = c.getAggregateScore() != null ? c.getAggregateScore() : liveAvg;
            String effectiveDec = c.getSystemDecision() != null ? c.getSystemDecision().toString()
                    : (effectiveScore != null ? Candidate.classifyScore(effectiveScore, notQMax, condMax).toString() : null);

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", c.getId()); m.put("sessionId", c.getSessionId());
            m.put("nationalId", c.getNationalId()); m.put("fullNameAr", c.getFullNameAr());
            m.put("fullNameEn", c.getFullNameEn()); m.put("firstNameAr", c.getFirstNameAr());
            m.put("secondNameAr", c.getSecondNameAr()); m.put("lastNameAr", c.getLastNameAr());
            m.put("email", c.getEmail()); m.put("phoneNumber", c.getPhoneNumber());
            m.put("qualification", c.getQualification()); m.put("specializationAr", c.getSpecializationAr());
            m.put("specializationEn", c.getSpecializationEn()); m.put("yearsOfExperience", c.getYearsOfExperience());
            m.put("applicationType", c.getApplicationType()); m.put("gpa", c.getGpa());
            m.put("gpaSystem", c.getGpaSystem()); m.put("university", c.getUniversity());
            m.put("currentEmployer", c.getCurrentEmployer()); m.put("currentTitle", c.getCurrentTitle());
            m.put("interviewScheduledAt", c.getInterviewScheduledAt()); m.put("interviewLocation", c.getInterviewLocation());
            m.put("candidateStatus", c.getCandidateStatus()); m.put("aggregateScore", effectiveScore);
            m.put("systemDecision", effectiveDec);
            m.put("finalDecision", c.getFinalDecision() != null ? c.getFinalDecision().toString() : null);
            m.put("isOverridden", c.getOverriddenBy() != null); m.put("hasCv", c.getCvFilePath() != null);
            m.put("registeredAt", c.getRegisteredAt());
            m.put("sessionCode", c.getSession() != null ? c.getSession().getSessionCode() : null);
            m.put("sessionTitleAr", c.getSession() != null ? c.getSession().getTitleAr() : null);
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
            "items", items, "totalCount", pg.getTotalElements(),
            "page", page, "pageSize", pageSize, "totalPages", pg.getTotalPages()
        ));
    }

    @GetMapping("/{id}")
    @PreAuthorize("@candidateAccess.canRead(#id, authentication)")
    public ResponseEntity<?> getCandidate(@PathVariable UUID id) {
        Candidate c = candidateRepo.findById(id).orElse(null);
        if (c == null) return ResponseEntity.notFound().build();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", c.getId()); result.put("sessionId", c.getSessionId());
        result.put("nationalId", c.getNationalId()); result.put("fullNameAr", c.getFullNameAr());
        result.put("fullNameEn", c.getFullNameEn()); result.put("firstNameAr", c.getFirstNameAr());
        result.put("secondNameAr", c.getSecondNameAr()); result.put("lastNameAr", c.getLastNameAr());
        result.put("email", c.getEmail()); result.put("phoneNumber", c.getPhoneNumber());
        result.put("qualification", c.getQualification()); result.put("specializationAr", c.getSpecializationAr());
        result.put("specializationEn", c.getSpecializationEn()); result.put("yearsOfExperience", c.getYearsOfExperience());
        result.put("applicationType", c.getApplicationType()); result.put("gpa", c.getGpa());
        result.put("gpaSystem", c.getGpaSystem()); result.put("university", c.getUniversity());
        result.put("currentEmployer", c.getCurrentEmployer()); result.put("currentTitle", c.getCurrentTitle());
        result.put("interviewScheduledAt", c.getInterviewScheduledAt()); result.put("interviewLocation", c.getInterviewLocation());
        result.put("candidateStatus", c.getCandidateStatus()); result.put("aggregateScore", c.getAggregateScore());
        result.put("highestScore", c.getHighestScore()); result.put("lowestScore", c.getLowestScore());
        result.put("scoreVariance", c.getScoreVariance()); result.put("hasDiscrepancy", c.isHasDiscrepancy());
        result.put("systemDecision", c.getSystemDecision()); result.put("finalDecision", c.getFinalDecision());
        result.put("overrideReason", c.getOverrideReason()); result.put("isOverridden", c.getOverriddenBy() != null);
        result.put("aiSummary", c.getAiSummary()); result.put("notes", c.getNotes());
        result.put("hasCv", c.getCvFilePath() != null); result.put("cvOriginalName", c.getCvOriginalName());
        result.put("cvUploadedAt", c.getCvUploadedAt()); result.put("registeredAt", c.getRegisteredAt());

        result.put("assignedEvaluators", c.getAssignedEvaluators().stream().map(ae -> Map.of(
            "userId", ae.getUserId(), "fullNameAr", ae.getUser().getFullNameAr(),
            "fullNameEn", Objects.toString(ae.getUser().getFullNameEn(), ""), "email", ae.getUser().getEmail(),
            "assignedAt", ae.getAssignedAt()
        )).collect(Collectors.toList()));

        result.put("evaluations", c.getEvaluations().stream().map(e -> {
            Map<String, Object> em = new LinkedHashMap<>();
            em.put("id", e.getId()); em.put("evaluatorId", e.getEvaluatorId());
            em.put("evaluatorNameAr", e.getEvaluator().getFullNameAr());
            em.put("totalScore", e.getTotalScore());
            em.put("systemDecision", e.getSystemDecision() != null ? e.getSystemDecision().toString() : null);
            em.put("status", e.getStatus().toString()); em.put("notes", e.getNotes());
            em.put("aiSummary", e.getAiSummary());
            em.put("submittedAt", e.getSubmittedAt());
            em.put("answers", e.getAnswers().stream()
                .sorted(Comparator.comparingInt(a -> a.getQuestion().getOrderIndex()))
                .map(a -> Map.of("questionId", a.getQuestionId(),
                    "questionTextAr", a.getQuestion().getTextAr(),
                    "questionTextEn", Objects.toString(a.getQuestion().getTextEn(), ""),
                    "questionOrder", a.getQuestion().getOrderIndex(),
                    "score", a.getScore(),
                    "comment", Objects.toString(a.getComment(), "")))
                .collect(Collectors.toList()));
            return em;
        }).collect(Collectors.toList()));
        return ResponseEntity.ok(result);
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('Admin','DataEntry')")
    public ResponseEntity<?> register(@RequestBody RegisterCandidateRequest req, Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        if (req.sessionId() != null && sessionRepo.findById(req.sessionId()).isEmpty())
            return ResponseEntity.status(404).body(Map.of("message", "Session not found."));

        String nationalId = req.nationalId() != null && !req.nationalId().isBlank() ? req.nationalId().trim() : null;
        if (nationalId != null && candidateRepo.existsByNationalId(nationalId))
            return ResponseEntity.status(409).body(Map.of("message", "Candidate with this National ID is already registered."));

        Candidate c = Candidate.create(req.sessionId(), nationalId,
                req.fullNameAr() != null ? req.fullNameAr() : "",
                req.fullNameEn() != null ? req.fullNameEn() : "",
                me, req.email(), req.phoneNumber(), req.qualification(),
                req.specializationAr(), req.specializationEn(), req.yearsOfExperience(),
                req.notes(), req.applicationType(), req.gpa(), req.gpaSystem(), req.university(),
                req.currentEmployer(), req.currentTitle(),
                req.firstNameAr(), req.secondNameAr(), req.lastNameAr());

        if (req.interviewScheduledAt() != null)
            c.scheduleInterview(req.interviewScheduledAt(), req.interviewLocation());

        candidateRepo.save(c);

        if (req.evaluatorIds() != null && !req.evaluatorIds().isEmpty()) {
            for (UUID evalId : req.evaluatorIds().stream().distinct().toList()) {
                userRepo.findById(evalId).filter(User::isActive).ifPresent(u ->
                    ceRepo.save(CandidateEvaluator.create(c.getId(), evalId, me)));
            }
        }

        auditRepo.save(AuditLog.create("CANDIDATE_REGISTERED", "Candidate", null, me,
            null, "{\"fullNameAr\":\"" + c.getFullNameAr() + "\"}", null));
        return ResponseEntity.status(201).body(c.getId());
    }

    @PostMapping("/{id}/assign-session")
    @PreAuthorize("hasAnyAuthority('Admin','DataEntry')")
    public ResponseEntity<?> assignSession(@PathVariable UUID id,
                                            @RequestBody Map<String, UUID> body, Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        Candidate c = candidateRepo.findById(id).orElse(null);
        if (c == null) return ResponseEntity.notFound().build();
        UUID sessionId = body.get("sessionId");
        if (sessionRepo.findById(sessionId).isEmpty()) return ResponseEntity.notFound().build();
        c.assignSession(sessionId);
        candidateRepo.save(c);
        auditRepo.save(AuditLog.create("CANDIDATE_SESSION_ASSIGNED", "Candidate", id.toString(), me));
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('Admin','DataEntry')")
    public ResponseEntity<?> update(@PathVariable UUID id, @RequestBody UpdateCandidateRequest req,
                                     Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        Candidate c = candidateRepo.findById(id).orElse(null);
        if (c == null) return ResponseEntity.notFound().build();

        String nationalId = req.nationalId() != null && !req.nationalId().isBlank() ? req.nationalId().trim() : null;
        if (nationalId != null && !nationalId.equals(c.getNationalId())
                && candidateRepo.existsByNationalIdAndIdNot(nationalId, id))
            return ResponseEntity.status(409).body(Map.of("message", "رقم الهوية مسجّل لمرشح آخر بالفعل."));

        c.update(req.fullNameAr() != null ? req.fullNameAr() : "",
                req.fullNameEn() != null ? req.fullNameEn() : "",
                req.email(), req.phoneNumber(), req.qualification(),
                req.specializationAr(), req.specializationEn(), req.yearsOfExperience(),
                req.notes(), req.applicationType(), req.gpa(), req.gpaSystem(), req.university(),
                req.currentEmployer(), req.currentTitle(),
                req.firstNameAr(), req.secondNameAr(), req.lastNameAr(), nationalId);
        candidateRepo.save(c);
        auditRepo.save(AuditLog.create("CANDIDATE_UPDATED", "Candidate", id.toString(), me));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/schedule-interview")
    @PreAuthorize("hasAnyAuthority('Admin','DataEntry')")
    public ResponseEntity<?> scheduleInterview(@PathVariable UUID id,
                                                @RequestBody ScheduleInterviewRequest req,
                                                Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        Candidate c = candidateRepo.findById(id).orElse(null);
        if (c == null) return ResponseEntity.notFound().build();
        c.scheduleInterview(req.scheduledAt(), req.location());
        candidateRepo.save(c);
        auditRepo.save(AuditLog.create("INTERVIEW_SCHEDULED", "Candidate", id.toString(), me));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/evaluators")
    @PreAuthorize("@candidateAccess.canRead(#id, authentication)")
    public ResponseEntity<?> getEvaluators(@PathVariable UUID id) {
        if (!candidateRepo.existsById(id)) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(ceRepo.findByCandidateId(id).stream().map(ce -> Map.of(
            "userId", ce.getUserId(), "fullNameAr", ce.getUser().getFullNameAr(),
            "fullNameEn", Objects.toString(ce.getUser().getFullNameEn(), ""), "email", ce.getUser().getEmail(),
            "assignedAt", ce.getAssignedAt()
        )).collect(Collectors.toList()));
    }

    @PostMapping("/{id}/evaluators")
    @PreAuthorize("hasAnyAuthority('Admin','DataEntry')")
    public ResponseEntity<?> assignEvaluators(@PathVariable UUID id,
                                               @RequestBody Map<String, List<UUID>> body,
                                               Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        Candidate c = candidateRepo.findById(id).orElse(null);
        if (c == null) return ResponseEntity.notFound().build();

        List<UUID> newIds = body.getOrDefault("evaluatorIds", List.of()).stream().distinct().toList();
        List<CandidateEvaluator> current = ceRepo.findByCandidateId(id);
        Set<UUID> currentIds = current.stream().map(CandidateEvaluator::getUserId).collect(Collectors.toSet());

        current.stream().filter(ce -> !newIds.contains(ce.getUserId())).forEach(ceRepo::delete);
        newIds.stream().filter(uid -> !currentIds.contains(uid))
                .forEach(uid -> userRepo.findById(uid).filter(User::isActive)
                        .ifPresent(u -> ceRepo.save(CandidateEvaluator.create(id, uid, me))));

        if (!newIds.isEmpty()) c.markInProgress(); else c.resetToPending();
        candidateRepo.save(c);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/evaluators/{userId}")
    @PreAuthorize("hasAnyAuthority('Admin','DataEntry')")
    public ResponseEntity<?> removeEvaluator(@PathVariable UUID id, @PathVariable UUID userId) {
        CandidateEvaluator ce = ceRepo.findByCandidateIdAndUserId(id, userId).orElse(null);
        if (ce == null) return ResponseEntity.notFound().build();
        ceRepo.delete(ce);
        return ResponseEntity.noContent().build();
    }

    /**
     * Feature 1 (AI): extracts candidate fields from a freshly-selected CV file
     * so Data Entry can review/correct them before the candidate record is
     * ever created. Purely read-only — nothing is persisted here.
     */
    @PostMapping("/cv/extract")
    @PreAuthorize("hasAnyAuthority('Admin','DataEntry')")
    public ResponseEntity<?> extractCv(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty())
            return ResponseEntity.badRequest().body(Map.of("message", "No file provided."));

        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "cv";
        String ext = originalName.contains(".") ? originalName.substring(originalName.lastIndexOf('.')) : "";
        List<String> allowed = List.of(".pdf", ".doc", ".docx");
        if (!allowed.contains(ext.toLowerCase()))
            return ResponseEntity.badRequest().body(Map.of("message", "File type not allowed."));

        String text;
        try (InputStream in = file.getInputStream()) {
            text = cvTextExtractor.extract(in, originalName);
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("fields", Map.of(), "message",
                "تعذّرت قراءة الملف تلقائيًا، يرجى تعبئة البيانات يدويًا."));
        }

        Map<String, Object> fields = aiService.extractCvFields(text);
        return ResponseEntity.ok(Map.of("fields", fields));
    }

    @PostMapping("/{id}/cv")
    @PreAuthorize("hasAnyAuthority('Admin','DataEntry')")
    public ResponseEntity<?> uploadCv(@PathVariable UUID id,
                                       @RequestParam("file") MultipartFile file,
                                       Authentication auth) throws IOException {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        Candidate c = candidateRepo.findById(id).orElse(null);
        if (c == null) return ResponseEntity.notFound().build();
        if (file == null || file.isEmpty())
            return ResponseEntity.badRequest().body(Map.of("message", "No file provided."));
        if (file.getSize() > (long) maxFileSizeMb * 1024 * 1024)
            return ResponseEntity.badRequest().body(Map.of("message", "File size exceeds " + maxFileSizeMb + " MB limit."));

        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "cv";
        String ext = originalName.contains(".") ? originalName.substring(originalName.lastIndexOf('.')) : "";
        List<String> allowed = List.of(".pdf", ".doc", ".docx");
        if (!allowed.contains(ext.toLowerCase()))
            return ResponseEntity.badRequest().body(Map.of("message", "File type not allowed."));

        // Delete old file if local
        if (c.getCvFilePath() != null && !c.getCvFilePath().startsWith("http")) {
            Path oldPath = Paths.get(uploadsPath).resolve(c.getCvFilePath().replaceFirst("^/", ""));
            Files.deleteIfExists(oldPath);
        }

        Path cvDir = Paths.get(uploadsPath, "cv");
        Files.createDirectories(cvDir);
        String fileName = id + "_" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")) + ext;
        Path dest = cvDir.resolve(fileName);
        file.transferTo(dest.toFile());

        String relativePath = "/cv/" + fileName;
        c.attachCv(relativePath, originalName);
        candidateRepo.save(c);

        auditRepo.save(AuditLog.create("CV_UPLOADED", "Candidate", id.toString(), me,
            null, "{\"fileName\":\"" + originalName + "\"}", null));
        return ResponseEntity.ok(Map.of("url", relativePath, "originalName", originalName));
    }

    @GetMapping("/{id}/cv/preview")
    @PreAuthorize("@candidateAccess.canRead(#id, authentication)")
    public ResponseEntity<Resource> previewCv(@PathVariable UUID id) {
        Candidate c = candidateRepo.findById(id).orElse(null);
        if (c == null || c.getCvFilePath() == null)
            return ResponseEntity.notFound().build();
        return serveCv(c, false);
    }

    @GetMapping("/{id}/cv/download")
    @PreAuthorize("@candidateAccess.canRead(#id, authentication)")
    public ResponseEntity<Resource> downloadCv(@PathVariable UUID id) {
        Candidate c = candidateRepo.findById(id).orElse(null);
        if (c == null || c.getCvFilePath() == null)
            return ResponseEntity.notFound().build();
        return serveCv(c, true);
    }

    private ResponseEntity<Resource> serveCv(Candidate c, boolean download) {
        if (c.getCvFilePath().startsWith("http"))
            return ResponseEntity.status(302)
                .header("Location", c.getCvFilePath()).build();

        Path fullPath = Paths.get(uploadsPath).resolve(c.getCvFilePath().replaceFirst("^/", ""));
        if (!Files.exists(fullPath)) return ResponseEntity.notFound().build();

        String ext = c.getCvFilePath().contains(".")
                ? c.getCvFilePath().substring(c.getCvFilePath().lastIndexOf('.')).toLowerCase() : "";
        MediaType mt = switch (ext) {
            case ".pdf"  -> MediaType.APPLICATION_PDF;
            case ".doc"  -> MediaType.parseMediaType("application/msword");
            case ".docx" -> MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            default      -> MediaType.APPLICATION_OCTET_STREAM;
        };

        Resource resource = new FileSystemResource(fullPath);
        String originalName = c.getCvOriginalName() != null ? c.getCvOriginalName() : "cv" + ext;
        ResponseEntity.BodyBuilder builder = ResponseEntity.ok().contentType(mt);
        if (download)
            builder = builder.header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + originalName + "\"");
        return builder.body(resource);
    }

    @DeleteMapping("/{id}/cv")
    @PreAuthorize("hasAnyAuthority('Admin','DataEntry')")
    public ResponseEntity<?> deleteCv(@PathVariable UUID id, Authentication auth) throws IOException {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        Candidate c = candidateRepo.findById(id).orElse(null);
        if (c == null) return ResponseEntity.notFound().build();
        if (c.getCvFilePath() == null)
            return ResponseEntity.status(404).body(Map.of("message", "No CV to delete."));

        if (!c.getCvFilePath().startsWith("http")) {
            Path fullPath = Paths.get(uploadsPath).resolve(c.getCvFilePath().replaceFirst("^/", ""));
            Files.deleteIfExists(fullPath);
        }
        c.removeCv(); candidateRepo.save(c);
        auditRepo.save(AuditLog.create("CV_DELETED", "Candidate", id.toString(), me));
        return ResponseEntity.noContent().build();
    }

    private BigDecimal getThreshold(String key, BigDecimal def) {
        return settingRepo.findByKey(key)
                .map(s -> { try { return new BigDecimal(s.getValue()); } catch (Exception e) { return def; } })
                .orElse(def);
    }

    record RegisterCandidateRequest(UUID sessionId, String nationalId, String fullNameAr, String fullNameEn,
        String firstNameAr, String secondNameAr, String lastNameAr,
        String email, String phoneNumber, String qualification,
        String specializationAr, String specializationEn, Short yearsOfExperience, String notes,
        String applicationType, BigDecimal gpa, String gpaSystem, String university,
        String currentEmployer, String currentTitle, LocalDateTime interviewScheduledAt,
        String interviewLocation, List<UUID> evaluatorIds) {}

    record UpdateCandidateRequest(String fullNameAr, String fullNameEn, String firstNameAr,
        String secondNameAr, String lastNameAr, String email, String phoneNumber,
        String qualification, String specializationAr, String specializationEn,
        Short yearsOfExperience, String notes, String nationalId, String applicationType,
        BigDecimal gpa, String gpaSystem, String university, String currentEmployer, String currentTitle) {}

    record ScheduleInterviewRequest(LocalDateTime scheduledAt, String location) {}
}
