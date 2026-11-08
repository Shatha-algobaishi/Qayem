package com.qayem.hr.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.qayem.hr.entity.Candidate;
import com.qayem.hr.entity.Evaluation;
import com.qayem.hr.enums.EvaluationStatus;
import com.qayem.hr.repository.CandidateRepository;
import com.qayem.hr.repository.EvaluationRepository;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Runs AI summary generation off the request thread (see AsyncConfig) so a
 * slow/unavailable Ollama instance never delays an evaluator's submit call.
 * Each method re-fetches its own data and commits independently — evaluation
 * submission itself has already succeeded by the time these run.
 */
@Component
public class AiSummaryOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(AiSummaryOrchestrator.class);

    private final AiService aiService;
    private final EvaluationRepository evalRepo;
    private final CandidateRepository candidateRepo;

    public AiSummaryOrchestrator(AiService aiService, EvaluationRepository evalRepo,
                                  CandidateRepository candidateRepo) {
        this.aiService = aiService;
        this.evalRepo = evalRepo;
        this.candidateRepo = candidateRepo;
    }

    /** Feature 2: summarize a single evaluator's just-submitted evaluation. */
    @Async("aiTaskExecutor")
    @Transactional
    public void generateEvaluationSummary(UUID evaluationId) {
        if (!aiService.ollamaEnabled()) return;
        try {
            Evaluation eval = evalRepo.findById(evaluationId).orElse(null);
            if (eval == null) return;

            List<AiService.AnswerInput> answers = eval.getAnswers().stream()
                    .sorted(Comparator.comparingInt(a -> a.getQuestion().getOrderIndex()))
                    .map(a -> new AiService.AnswerInput(a.getQuestion().getTextAr(), a.getScore(),
                            a.getQuestion().getMaxScore(), a.getComment()))
                    .collect(Collectors.toList());

            String candidateLabel = eval.getCandidate() != null ? eval.getCandidate().getFullNameAr() : "candidate";
            String summary = aiService.summarizeEvaluation(candidateLabel, eval.getTotalScore(), eval.getNotes(), answers);
            if (summary != null) {
                eval.setAiSummary(summary);
                evalRepo.save(eval);
            }
        } catch (Exception e) {
            log.warn("Failed to generate per-evaluation AI summary for {}: {}", evaluationId, e.getMessage());
        }
    }

    /** Feature 3: aggregate summary once every assigned evaluator has submitted. */
    @Async("aiTaskExecutor")
    @Transactional
    public void generateCandidateFinalSummary(UUID candidateId) {
        try {
            Candidate candidate = candidateRepo.findById(candidateId).orElse(null);
            if (candidate == null) return;

            List<Evaluation> submitted = candidate.getEvaluations().stream()
                    .filter(e -> e.getStatus() != EvaluationStatus.Draft)
                    .collect(Collectors.toList());
            if (submitted.isEmpty()) return;

            List<AiService.EvaluatorInput> evaluators = submitted.stream().map(e -> {
                List<AiService.AnswerInput> answers = e.getAnswers().stream()
                        .sorted(Comparator.comparingInt(a -> a.getQuestion().getOrderIndex()))
                        .map(a -> new AiService.AnswerInput(a.getQuestion().getTextAr(), a.getScore(),
                                a.getQuestion().getMaxScore(), a.getComment()))
                        .collect(Collectors.toList());
                String name = e.getEvaluator() != null ? e.getEvaluator().getFullNameAr() : "evaluator";
                return new AiService.EvaluatorInput(name, e.getTotalScore(), e.getNotes(), answers);
            }).collect(Collectors.toList());

            double avg = submitted.stream().mapToInt(e -> e.getTotalScore() != null ? e.getTotalScore() : 0)
                    .average().orElse(0);

            String summary = aiService.summarizeCandidateFinal(evaluators, avg);
            if (summary != null) {
                candidate.setAiSummary(summary);
                candidateRepo.save(candidate);
            }
        } catch (Exception e) {
            log.warn("Failed to generate final AI summary for candidate {}: {}", candidateId, e.getMessage());
        }
    }
}
