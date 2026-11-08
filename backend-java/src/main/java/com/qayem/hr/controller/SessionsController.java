package com.qayem.hr.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import com.qayem.hr.entity.*;
import com.qayem.hr.enums.SessionStatus;
import com.qayem.hr.repository.*;
import com.qayem.hr.security.JwtUtil;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/sessions")
public class SessionsController {

    private final SessionRepository sessionRepo;
    private final SessionEvaluatorRepository seRepo;
    private final UserRepository userRepo;
    private final CandidateRepository candidateRepo;
    private final RoleRepository roleRepo;
    private final JwtUtil jwtUtil;

    public SessionsController(SessionRepository sessionRepo, SessionEvaluatorRepository seRepo,
                               UserRepository userRepo, CandidateRepository candidateRepo,
                               RoleRepository roleRepo, JwtUtil jwtUtil) {
        this.sessionRepo = sessionRepo;
        this.seRepo = seRepo;
        this.userRepo = userRepo;
        this.candidateRepo = candidateRepo;
        this.roleRepo = roleRepo;
        this.jwtUtil = jwtUtil;
    }

    @GetMapping
    public ResponseEntity<?> getSessions(@RequestParam(required = false) String status,
                                          @RequestParam(required = false) String department,
                                          @RequestParam(required = false) String search,
                                          @RequestParam(defaultValue = "1") int page,
                                          @RequestParam(defaultValue = "20") int pageSize,
                                          Authentication auth) {
        UUID currentUserId = UUID.fromString((String) auth.getPrincipal());
        boolean isEvaluatorOnly = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("Evaluator"))
                && auth.getAuthorities().stream()
                .noneMatch(a -> List.of("Admin","Manager","DataEntry").contains(a.getAuthority()));

        Specification<InterviewSession> spec = (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            if (status != null && !status.isBlank()) {
                try { predicates.add(cb.equal(root.get("status"), SessionStatus.valueOf(status))); }
                catch (IllegalArgumentException ignored) {}
            }
            if (department != null && !department.isBlank())
                predicates.add(cb.equal(root.get("department"), department));
            if (search != null && !search.isBlank()) {
                String like = "%" + search.toLowerCase() + "%";
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("titleAr")), like),
                    cb.like(cb.lower(root.get("titleEn")), like),
                    cb.like(cb.lower(root.get("sessionCode")), like),
                    cb.like(cb.lower(root.get("jobPositionAr")), like)
                ));
            }
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };

        Pageable pageable = PageRequest.of(page - 1, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<InterviewSession> pg = sessionRepo.findAll(spec, pageable);

        List<InterviewSession> content = pg.getContent();
        if (isEvaluatorOnly) {
            content = content.stream().filter(s ->
                s.getEvaluators().stream().anyMatch(e -> e.isActive() && e.getUserId().equals(currentUserId))
                || s.getCandidates().stream().anyMatch(c ->
                    c.getAssignedEvaluators().stream().anyMatch(ce -> ce.getUserId().equals(currentUserId)))
            ).collect(Collectors.toList());
        }

        List<Map<String, Object>> items = content.stream().map(s -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", s.getId());
            m.put("sessionCode", s.getSessionCode());
            m.put("titleAr", s.getTitleAr());
            m.put("titleEn", s.getTitleEn());
            m.put("jobPositionAr", s.getJobPositionAr());
            m.put("department", s.getDepartment());
            m.put("generalDepartment", s.getGeneralDepartment());
            m.put("agency", s.getAgency());
            m.put("scheduledDate", s.getScheduledDate());
            m.put("location", s.getLocation());
            m.put("status", s.getStatus().toString());
            m.put("candidateCount", s.getCandidates().size());
            m.put("evaluatorCount", (int) s.getEvaluators().stream().filter(SessionEvaluator::isActive).count());
            m.put("createdAt", s.getCreatedAt());
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
            "items", items,
            "totalCount", pg.getTotalElements(),
            "page", page,
            "pageSize", pageSize,
            "totalPages", pg.getTotalPages()
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getSession(@PathVariable UUID id, Authentication auth) {
        InterviewSession s = sessionRepo.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();

        UUID currentUserId = UUID.fromString((String) auth.getPrincipal());
        boolean isEvaluatorOnly = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("Evaluator"))
                && auth.getAuthorities().stream()
                .noneMatch(a -> List.of("Admin","Manager","DataEntry").contains(a.getAuthority()));
        if (isEvaluatorOnly && s.getEvaluators().stream().noneMatch(e -> e.getUserId().equals(currentUserId)))
            return ResponseEntity.status(403).build();

        List<Map<String, Object>> evaluators = s.getEvaluators().stream()
                .filter(SessionEvaluator::isActive)
                .map(e -> Map.<String, Object>of(
                    "userId", e.getUserId(),
                    "fullNameAr", e.getUser().getFullNameAr(),
                    "fullNameEn", Objects.toString(e.getUser().getFullNameEn(), ""),
                    "email", e.getUser().getEmail(),
                    "assignedAt", e.getAssignedAt()
                )).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", s.getId());
        result.put("sessionCode", s.getSessionCode());
        result.put("titleAr", s.getTitleAr());
        result.put("titleEn", s.getTitleEn());
        result.put("jobPositionAr", s.getJobPositionAr());
        result.put("jobPositionEn", s.getJobPositionEn());
        result.put("department", s.getDepartment());
        result.put("generalDepartment", s.getGeneralDepartment());
        result.put("agency", s.getAgency());
        result.put("scheduledDate", s.getScheduledDate());
        result.put("location", s.getLocation());
        result.put("status", s.getStatus());
        result.put("notes", s.getNotes());
        result.put("createdAt", s.getCreatedAt());
        result.put("closedAt", s.getClosedAt());
        result.put("evaluators", evaluators);
        result.put("candidatesCount", s.getCandidates().size());
        return ResponseEntity.ok(result);
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('Admin','DataEntry')")
    public ResponseEntity<?> createSession(@RequestBody CreateSessionRequest req, Authentication auth) {
        UUID currentUserId = UUID.fromString((String) auth.getPrincipal());
        String code = generateCode();
        String titleAr = req.titleAr() != null && !req.titleAr().isBlank()
                ? req.titleAr()
                : "مقابلة " + req.jobPositionAr() + " - " + req.department();
        String titleEn = req.titleEn() != null && !req.titleEn().isBlank()
                ? req.titleEn()
                : "Interview – " + (req.jobPositionEn() != null ? req.jobPositionEn() : req.jobPositionAr()) + " – " + req.department();
        String jobPosEn = req.jobPositionEn() != null ? req.jobPositionEn() : req.jobPositionAr();

        InterviewSession s = InterviewSession.create(code, titleAr, titleEn,
                req.jobPositionAr(), jobPosEn, req.department(), currentUserId,
                req.scheduledDate(), req.location(), req.notes(), req.agency(), req.generalDepartment());
        sessionRepo.save(s);
        return ResponseEntity.status(201).body(s.getId());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('Admin','DataEntry')")
    public ResponseEntity<?> updateSession(@PathVariable UUID id, @RequestBody UpdateSessionRequest req) {
        InterviewSession s = sessionRepo.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        s.update(req.titleAr(), req.titleEn(), req.jobPositionAr(), req.jobPositionEn(),
                req.department(), req.scheduledDate(), req.location(), req.notes(),
                req.agency(), req.generalDepartment());
        sessionRepo.save(s);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/activate")
    @PreAuthorize("hasAuthority('Admin')")
    public ResponseEntity<?> activate(@PathVariable UUID id) {
        InterviewSession s = sessionRepo.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        s.activate(); sessionRepo.save(s);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/close")
    @PreAuthorize("hasAnyAuthority('Admin','Manager','DataEntry')")
    public ResponseEntity<?> close(@PathVariable UUID id, Authentication auth) {
        UUID me = UUID.fromString((String) auth.getPrincipal());
        InterviewSession s = sessionRepo.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        s.close(me); sessionRepo.save(s);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/reopen")
    @PreAuthorize("hasAnyAuthority('Admin','DataEntry')")
    public ResponseEntity<?> reopen(@PathVariable UUID id) {
        InterviewSession s = sessionRepo.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        s.reopen(); sessionRepo.save(s);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/evaluators")
    public ResponseEntity<?> getEvaluators(@PathVariable UUID id) {
        return ResponseEntity.ok(seRepo.findBySessionIdAndIsActiveTrue(id).stream().map(e ->
            Map.of(
                "userId", e.getUserId(),
                "fullNameAr", e.getUser().getFullNameAr(),
                "fullNameEn", Objects.toString(e.getUser().getFullNameEn(), ""),
                "email", e.getUser().getEmail(),
                "assignedAt", e.getAssignedAt()
            )
        ).collect(Collectors.toList()));
    }

    @PostMapping("/{id}/evaluators")
    @PreAuthorize("hasAuthority('Admin')")
    public ResponseEntity<?> assignEvaluator(@PathVariable UUID id,
                                              @RequestBody Map<String, UUID> body,
                                              Authentication auth) {
        UUID userId = body.get("userId");
        InterviewSession s = sessionRepo.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        if (seRepo.existsBySessionIdAndUserIdAndIsActiveTrue(id, userId))
            return ResponseEntity.status(409).body(Map.of("message", "Evaluator is already assigned."));
        User user = userRepo.findById(userId).orElse(null);
        if (user == null || !user.isActive() || !"Evaluator".equals(user.getRole().getName()))
            return ResponseEntity.badRequest().body(Map.of("message", "User not found or inactive."));
        UUID me = UUID.fromString((String) auth.getPrincipal());
        seRepo.save(SessionEvaluator.create(id, userId, me));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/evaluators/{userId}")
    @PreAuthorize("hasAuthority('Admin')")
    public ResponseEntity<?> removeEvaluator(@PathVariable UUID id, @PathVariable UUID userId) {
        SessionEvaluator se = seRepo.findBySessionIdAndUserId(id, userId).orElse(null);
        if (se == null) return ResponseEntity.notFound().build();
        se.deactivate(); seRepo.save(se);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('Admin')")
    public ResponseEntity<?> deleteSession(@PathVariable UUID id) {
        InterviewSession s = sessionRepo.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        sessionRepo.delete(s);
        return ResponseEntity.noContent().build();
    }

    private String generateCode() {
        int year = LocalDateTime.now().getYear();
        long count = sessionRepo.count();
        return String.format("SES-%d-%04d", year, count + 1);
    }

    record CreateSessionRequest(String titleAr, String titleEn, String jobPositionAr, String jobPositionEn,
                                 String department, String generalDepartment, String agency,
                                 LocalDateTime scheduledDate, String location, String notes) {}
    record UpdateSessionRequest(String titleAr, String titleEn, String jobPositionAr, String jobPositionEn,
                                 String department, String generalDepartment, String agency,
                                 LocalDateTime scheduledDate, String location, String notes) {}
}
