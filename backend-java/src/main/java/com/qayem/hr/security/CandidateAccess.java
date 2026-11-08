package com.qayem.hr.security;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import com.qayem.hr.repository.*;
import java.util.List;
import java.util.UUID;

@Component("candidateAccess")
public class CandidateAccess {
    private final CandidateRepository candidates;
    private final CandidateEvaluatorRepository assignments;
    private final SessionEvaluatorRepository sessions;

    public CandidateAccess(CandidateRepository candidates, CandidateEvaluatorRepository assignments,
                           SessionEvaluatorRepository sessions) {
        this.candidates = candidates; this.assignments = assignments; this.sessions = sessions;
    }

    public boolean canRead(UUID candidateId, Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) return false;
        if (auth.getAuthorities().stream().anyMatch(a -> List.of("Admin", "Manager", "DataEntry").contains(a.getAuthority())))
            return true;
        UUID userId = UUID.fromString(auth.getName());
        return assignments.existsByCandidateIdAndUserId(candidateId, userId)
                || candidates.findById(candidateId).filter(c -> c.getSessionId() != null
                && sessions.existsBySessionIdAndUserIdAndIsActiveTrue(c.getSessionId(), userId)).isPresent();
    }
}
