package com.qayem.hr.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * AI features for the HR system, all built on top of {@link OllamaClient}.
 *
 * Hard rule across every method here: the model is only ever shown data that
 * already exists in the system (CV text, submitted scores, evaluator notes).
 * It is explicitly instructed not to invent facts, not to change/assign
 * scores, and not to make a final accept/reject decision — those stay
 * system-computed or human-decided. Every AI call degrades gracefully
 * (returns empty / falls back to a deterministic summary) so a slow or
 * unavailable model never breaks core HR workflows.
 */
@Service
public class AiService {

    private static final Logger log = LoggerFactory.getLogger(AiService.class);

    private final OllamaClient ollama;
    private final ObjectMapper mapper = new ObjectMapper();

    public AiService(OllamaClient ollama) {
        this.ollama = ollama;
    }

    public boolean ollamaEnabled() {
        return ollama.isEnabled();
    }

    // ─────────────────────────────────────────────────────────────────────
    // Feature 1 — CV field extraction (Data Entry upload)
    // ─────────────────────────────────────────────────────────────────────

    private static final String CV_SYSTEM_PROMPT = """
        You are a data-extraction assistant for a government HR system. You will be given
        raw text extracted from a candidate's CV/resume. Extract ONLY facts that are
        literally present in the text below. Never guess, infer, translate, or invent a
        value. If a field is not clearly present in the text, output null for it.

        Respond with ONLY a single JSON object, no prose, matching exactly this shape:
        {
          "fullNameAr": string or null,
          "fullNameEn": string or null,
          "firstNameAr": string or null,
          "secondNameAr": string or null,
          "lastNameAr": string or null,
          "email": string or null,
          "phoneNumber": string or null,
          "nationalId": string or null,
          "qualification": string or null,
          "specializationAr": string or null,
          "specializationEn": string or null,
          "yearsOfExperience": integer or null,
          "university": string or null,
          "gpa": number or null,
          "currentEmployer": string or null,
          "currentTitle": string or null
        }

        Rules:
        - "fullNameAr" is only for a name written in Arabic script; do not transliterate.
        - "fullNameEn" is only for a name written in Latin script.
        - "yearsOfExperience" must be a whole number of years, only if stated or trivially
          computable by summing explicit employment date ranges present in the text.
        - Do not fabricate an email, phone number, or national ID under any circumstance.
        - "nationalId" must be exactly 10 digits and nothing else (Saudi national ID format).
          If the text has no such 10-digit number, output null — never a company name, code,
          or any other token even if it looks like an identifier.
        - "email" must contain "@" and a domain. "phoneNumber" must consist mostly of digits.
        """;

    private static final Set<String> CV_ALLOWED_FIELDS = Set.of(
            "fullNameAr", "fullNameEn", "firstNameAr", "secondNameAr", "lastNameAr",
            "email", "phoneNumber", "nationalId", "qualification", "specializationAr",
            "specializationEn", "yearsOfExperience", "university", "gpa",
            "currentEmployer", "currentTitle");

    /**
     * Returns extracted candidate fields as a plain map (values are Strings,
     * Integers, Doubles, or null), suitable for direct JSON serialization to
     * the frontend for the Data Entry user to review and correct before saving.
     * Returns an empty map if the AI could not produce a usable result.
     */
    public Map<String, Object> extractCvFields(String cvText) {
        if (cvText == null || cvText.isBlank()) return Map.of();

        var result = ollama.generateJson(CV_SYSTEM_PROMPT, "CV TEXT:\n" + cvText);
        if (result.isEmpty()) return Map.of();

        Map<String, Object> out = new LinkedHashMap<>();
        JsonNode node = result.get();
        for (String field : CV_ALLOWED_FIELDS) {
            JsonNode v = node.get(field);
            if (v == null || v.isNull()) continue;
            if (v.isTextual()) {
                String s = v.asText().trim();
                if (!s.isEmpty() && !s.equalsIgnoreCase("null") && isPlausible(field, s)) out.put(field, s);
            } else if (v.isNumber()) {
                out.put(field, v.isIntegralNumber() ? v.asInt() : v.asDouble());
            }
        }
        return out;
    }

    private static final java.util.regex.Pattern SAUDI_NATIONAL_ID = java.util.regex.Pattern.compile("\\d{10}");
    private static final java.util.regex.Pattern MOSTLY_DIGITS = java.util.regex.Pattern.compile("[\\d+\\-() ]{7,}");

    /**
     * Small local models don't reliably follow "extract only what's literally
     * there" for structured fields — this is a defense-in-depth check so an
     * obviously-wrong value (e.g. a letterhead code mistaken for a national ID)
     * never reaches the Data Entry form, rather than relying on the prompt alone.
     */
    private static boolean isPlausible(String field, String value) {
        return switch (field) {
            case "nationalId" -> SAUDI_NATIONAL_ID.matcher(value).matches();
            case "email" -> value.contains("@") && value.contains(".");
            case "phoneNumber" -> MOSTLY_DIGITS.matcher(value).matches();
            default -> true;
        };
    }

    // ─────────────────────────────────────────────────────────────────────
    // Feature 2 — Per-evaluation summary (after one evaluator submits)
    // ─────────────────────────────────────────────────────────────────────

    private static final String EVAL_SYSTEM_PROMPT = """
        You are a summarization assistant for a government HR interview system. You will
        be given one evaluator's question-by-question scores/comments and general notes
        for a single candidate. Summarize ONLY what is expressed in that data. Do not add
        information that isn't there, do not change or restate scores as if you computed
        them, and do not decide whether the candidate should be hired — you are only
        producing a readable summary for reviewers.

        Respond with ONLY a single JSON object, no prose, matching exactly this shape:
        {
          "overallSummary": string,
          "strengths": [string, ...]  (max 5, empty array if none evident),
          "weaknesses": [string, ...] (max 5, empty array if none evident),
          "keyNotes": [string, ...]   (max 5, other noteworthy observations)
        }

        Write in Arabic if the evaluator's comments/notes are in Arabic, otherwise match
        their language. Keep each list item short (one sentence).
        """;

    public record AnswerInput(String questionText, int score, int maxScore, String comment) {}

    /** Generates and returns a compact JSON string, or null if unavailable. */
    public String summarizeEvaluation(String candidateLabel, Integer totalScore, String evaluatorNotes,
                                       List<AnswerInput> answers) {
        StringBuilder sb = new StringBuilder();
        sb.append("Candidate: ").append(candidateLabel).append('\n');
        sb.append("Total score: ").append(totalScore != null ? totalScore : "n/a").append('\n');
        sb.append("Question-by-question scores:\n");
        for (AnswerInput a : answers) {
            sb.append("- ").append(a.questionText()).append(" => ")
              .append(a.score()).append('/').append(a.maxScore());
            if (a.comment() != null && !a.comment().isBlank())
                sb.append(" (comment: ").append(a.comment()).append(')');
            sb.append('\n');
        }
        if (evaluatorNotes != null && !evaluatorNotes.isBlank())
            sb.append("General notes:\n").append(evaluatorNotes).append('\n');

        var result = ollama.generateJson(EVAL_SYSTEM_PROMPT, sb.toString());
        if (result.isEmpty()) return null;

        ObjectNode clean = sanitizeSummaryNode(result.get(),
                "overallSummary", List.of("strengths", "weaknesses", "keyNotes"));
        if (clean == null) return null;
        try {
            return mapper.writeValueAsString(clean);
        } catch (Exception e) {
            log.warn("Failed to serialize evaluation AI summary: {}", e.getMessage());
            return null;
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Feature 3 — Final aggregate summary (after all evaluators complete)
    // ─────────────────────────────────────────────────────────────────────

    private static final String CANDIDATE_SYSTEM_PROMPT = """
        You are a summarization assistant for a government HR interview system. You will
        be given the scores and notes from ALL evaluators who assessed one candidate.
        Produce a neutral, factual synthesis for a human decision-maker (a manager) to
        read. Use ONLY the information given below.

        Absolute rules:
        - Do not invent facts, scores, or qualifications not present in the input.
        - Do not compute, alter, or restate a "final score" as your own judgment — the
          numeric average is provided to you already; simply reference it.
        - Do NOT recommend a specific hire/reject/accept decision. Do not use words like
          "hire", "accept", "reject", "قبول", "رفض", "توظيف". Only describe patterns in
          what the evaluators observed.
        - Explicitly call out where evaluators agreed with each other and where their
          scores or comments diverged (e.g. one evaluator praised a trait another
          criticized, or scores differ significantly).

        Respond with ONLY a single JSON object, no prose, matching exactly this shape:
        {
          "strengths": [string, ...] (max 5),
          "areasForImprovement": [string, ...] (max 5),
          "observations": [string, ...] (max 3, other general notes),
          "agreements": [string, ...] (max 4, points where evaluators' notes/scores aligned),
          "disagreements": [string, ...] (max 4, points where evaluators' notes/scores diverged),
          "summary": string (2-3 sentence neutral synthesis, no decision)
        }

        Write in Arabic if the evaluators' notes are mostly in Arabic, otherwise match
        their language.
        """;

    public record EvaluatorInput(String evaluatorName, Integer totalScore, String notes,
                                  List<AnswerInput> answers) {}

    /**
     * Generates the final candidate-level summary JSON (already including the
     * averageScore/evaluatorCount fields the frontend expects), trying the AI
     * first and falling back to a deterministic rule-based summary if the
     * model is unavailable/unusable — so this feature never regresses the
     * existing "AI Summary" card that ships today.
     */
    public String summarizeCandidateFinal(List<EvaluatorInput> evaluators, double averageScore) {
        String aiPart = tryAiCandidateSummary(evaluators);
        ObjectNode out = mapper.createObjectNode();
        out.put("averageScore", Math.round(averageScore * 10.0) / 10.0);
        out.put("evaluatorCount", evaluators.size());

        if (aiPart != null) {
            try {
                JsonNode parsed = mapper.readTree(aiPart);
                copyArray(parsed, out, "strengths", 5);
                copyArray(parsed, out, "areasForImprovement", 5);
                copyArray(parsed, out, "observations", 3);
                copyArray(parsed, out, "agreements", 4);
                copyArray(parsed, out, "disagreements", 4);
                String summary = parsed.path("summary").asText("");
                out.put("recommendation", summary.isBlank() ? ruleBasedRecommendation(averageScore) : summary);
                return writeOrNull(out);
            } catch (Exception e) {
                log.warn("Failed to parse candidate AI summary, falling back: {}", e.getMessage());
            }
        }

        return ruleBasedFallback(evaluators, averageScore, out);
    }

    private String tryAiCandidateSummary(List<EvaluatorInput> evaluators) {
        StringBuilder sb = new StringBuilder();
        sb.append("Number of evaluators: ").append(evaluators.size()).append('\n');
        for (EvaluatorInput e : evaluators) {
            sb.append("\nEvaluator: ").append(e.evaluatorName()).append('\n');
            sb.append("Total score: ").append(e.totalScore() != null ? e.totalScore() : "n/a").append('\n');
            for (AnswerInput a : e.answers()) {
                sb.append("- ").append(a.questionText()).append(" => ")
                  .append(a.score()).append('/').append(a.maxScore());
                if (a.comment() != null && !a.comment().isBlank())
                    sb.append(" (comment: ").append(a.comment()).append(')');
                sb.append('\n');
            }
            if (e.notes() != null && !e.notes().isBlank())
                sb.append("Notes: ").append(e.notes()).append('\n');
        }

        var result = ollama.generateJson(CANDIDATE_SYSTEM_PROMPT, sb.toString());
        if (result.isEmpty()) return null;
        return writeOrNull(result.get());
    }

    // ─────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────

    private ObjectNode sanitizeSummaryNode(JsonNode node, String textField, List<String> listFields) {
        ObjectNode out = mapper.createObjectNode();
        String text = node.path(textField).asText("");
        if (text.isBlank() && listFields.stream().allMatch(f -> node.path(f).size() == 0)) return null;
        out.put(textField, text);
        for (String f : listFields) copyArray(node, out, f, 5);
        return out;
    }

    private void copyArray(JsonNode source, ObjectNode target, String field, int max) {
        ArrayNode arr = mapper.createArrayNode();
        JsonNode src = source.path(field);
        if (src.isArray()) {
            Set<String> seen = new LinkedHashSet<>();
            for (JsonNode item : src) {
                if (seen.size() >= max) break;
                String s = item.asText("").trim();
                if (!s.isEmpty() && seen.add(s)) arr.add(s);
            }
        }
        target.set(field, arr);
    }

    private String writeOrNull(JsonNode node) {
        try {
            return mapper.writeValueAsString(node);
        } catch (Exception e) {
            return null;
        }
    }

    private static String ruleBasedRecommendation(double avgScore) {
        if (avgScore >= 24) return "يُوصى بترشيح المتقدم بناءً على نتائج التقييم المرتفعة وآراء المقيّمين.";
        if (avgScore >= 18) return "يُمكن النظر في ترشيح المتقدم كمؤهل مع متابعة نقاط التطوير.";
        return "لا يُوصى بترشيح المتقدم في الوقت الحالي بناءً على نتائج التقييم.";
    }

    /** Deterministic, non-AI summary used only when the model is unreachable/unusable. */
    private String ruleBasedFallback(List<EvaluatorInput> evaluators, double avgScore, ObjectNode out) {
        Set<String> strengths = new LinkedHashSet<>();
        Set<String> improvements = new LinkedHashSet<>();
        Set<String> observations = new LinkedHashSet<>();

        for (EvaluatorInput e : evaluators) {
            if (e.notes() == null || e.notes().isBlank()) continue;
            for (String sentence : e.notes().split("[.\\n;،]")) {
                String s = sentence.trim();
                if (s.length() <= 8) continue;
                String lower = s.toLowerCase();
                if (lower.contains("ممتاز") || lower.contains("قوي") || lower.contains("متميز")
                        || lower.contains("excellent") || lower.contains("strong") || lower.contains("great")) {
                    strengths.add(s);
                } else if (lower.contains("يحتاج") || lower.contains("ضعف") || lower.contains("تطوير")
                        || lower.contains("needs") || lower.contains("improve") || lower.contains("lack")) {
                    improvements.add(s);
                } else {
                    observations.add(s);
                }
            }
        }
        if (strengths.isEmpty() && avgScore >= 20)
            strengths.add(avgScore >= 25 ? "أداء ممتاز في معظم محاور التقييم" : "أداء جيد في المحاور الأساسية");
        if (improvements.isEmpty() && avgScore < 20)
            improvements.add("يحتاج إلى تطوير في بعض المحاور");

        ArrayNode s = mapper.createArrayNode();
        strengths.stream().limit(5).forEach(s::add);
        out.set("strengths", s);

        ArrayNode imp = mapper.createArrayNode();
        improvements.stream().limit(5).forEach(imp::add);
        out.set("areasForImprovement", imp);

        ArrayNode obs = mapper.createArrayNode();
        observations.stream().limit(3).forEach(obs::add);
        out.set("observations", obs);

        out.set("agreements", mapper.createArrayNode());
        out.set("disagreements", mapper.createArrayNode());
        out.put("recommendation", ruleBasedRecommendation(avgScore));

        return writeOrNull(out);
    }
}
