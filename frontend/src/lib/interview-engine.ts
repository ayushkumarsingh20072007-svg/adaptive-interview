import {
  CandidateSetup,
  Question,
  AnswerFeedback,
  InterviewSession,
  EvaluationReport,
  SkillMetric,
  SkillStatusCategory,
} from "./types";
import { QUESTION_BANK, ROLE_LABELS } from "./mock-data";
import { saveStoredSession, saveStoredReport } from "./storage";

/**
 * Creates and initializes a new deterministic interview session based on candidate setup.
 */
export function initializeInterviewSession(setup: CandidateSetup): InterviewSession {
  const initialSession: InterviewSession = {
    id: `session-${Date.now()}`,
    setup,
    status: "in-progress",
    startedAt: new Date().toISOString(),
    durationSeconds: 0,
    answers: [],
    currentQuestionIndex: 0,
    userId: setup.userId,
  };

  saveStoredSession(initialSession);
  return initialSession;
}

/**
 * Retrieves the starting question for a given role, prioritizing the candidate's selected experience level.
 */
export function getInitialQuestion(setup: CandidateSetup): Question {
  const roleBank = QUESTION_BANK[setup.targetRole] || QUESTION_BANK.fullstack;
  const targetLevel = setup.experienceLevel || "intermediate";
  const matchingQuestion = roleBank.find((q) => q.difficulty === targetLevel);
  return matchingQuestion || roleBank[0];
}

/**
 * Deterministically evaluates a candidate's answer without random number generation.
 * Evaluates technical keyword matches, conceptual depth, and structure.
 */
export function evaluateAnswer(question: Question, answerText: string): AnswerFeedback {
  const raw = answerText.trim();
  const normalized = raw.toLowerCase();

  // 1. Detect evasive, empty, or refusal answers
  const evasivePhrases = [
    "don't know",
    "dont know",
    "no idea",
    "not sure",
    "skip",
    "pass",
    "idk",
    "no clue",
    "cannot answer",
    "can't answer",
    "n/a",
    "wrong",
    "asdf",
    "test",
    "nothing",
  ];
  const isEvasive = evasivePhrases.some(
    (phrase) => normalized === phrase || normalized.startsWith(phrase + " ") || normalized.endsWith(" " + phrase)
  );
  const isTooShort = normalized.length < 15;

  if (isEvasive || isTooShort) {
    const penaltyScore = isEvasive ? 16 : Math.max(15, Math.min(26, Math.round(normalized.length * 1.5)));
    return {
      score: penaltyScore,
      strengths: [],
      gaps: [
        `Candidate did not provide a substantive technical explanation for '${question.category}'.`,
        `Expected foundational concepts: ${question.expectedKeywords.slice(0, 3).join(", ")}.`,
      ],
      adaptiveNote: "Calibrating next question toward fundamental conceptual building blocks.",
      technicalCorrectness: "incorrect",
      explanationQuality: "confusing",
      reasoningAndProblemSolving: "Candidate provided an evasive or insufficient response.",
      completeness: "incomplete",
      evidenceQuote: null,
      missingConcepts: [...question.expectedKeywords],
      competencyStatus: "claimed_unvalidated",
      confidence: "high",
    };
  }

  // 2. Keyword and concept match analysis
  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  for (const kw of question.expectedKeywords) {
    if (normalized.includes(kw.toLowerCase())) {
      matchedKeywords.push(kw);
    } else {
      missingKeywords.push(kw);
    }
  }

  const totalKw = Math.max(1, question.expectedKeywords.length);
  const matchRatio = matchedKeywords.length / totalKw;

  // 3. Calibrated Scoring:
  // - 0 keywords matched: candidate missed topic but attempted (score 18 - 34)
  // - Partial match (0.1 - 0.4): weak attempt with missing core components (score 36 - 55)
  // - Moderate match (0.4 - 0.7): acceptable foundational explanation (score 58 - 74)
  // - Strong match (>= 0.7): accurate, depth, keywords matched (score 76 - 95)
  let calculatedScore: number;

  if (matchedKeywords.length === 0) {
    calculatedScore = Math.max(18, Math.min(34, 18 + Math.min(14, Math.round(normalized.length / 25))));
  } else if (matchRatio < 0.4) {
    calculatedScore = Math.round(36 + matchRatio * 40 + (normalized.length > 100 ? 5 : 0));
  } else if (matchRatio < 0.7) {
    calculatedScore = Math.round(55 + matchRatio * 28 + (normalized.length > 120 ? 5 : 0));
  } else {
    calculatedScore = Math.round(75 + matchRatio * 18 + (normalized.length > 150 ? 5 : 0));
  }

  const finalScore = Math.min(98, Math.max(16, calculatedScore));

  // Determine strengths
  const strengths: string[] = [];
  if (matchedKeywords.length > 0) {
    strengths.push(
      `Referenced relevant concepts: ${matchedKeywords.slice(0, 3).join(", ")}.`
    );
  }
  if (finalScore >= 70 && normalized.length > 120) {
    strengths.push("Articulated practical reasoning with structured architectural flow.");
  }

  // Determine gaps
  const gaps: string[] = [];
  if (missingKeywords.length > 0) {
    gaps.push(
      `Missing technical coverage for: ${missingKeywords.slice(0, 3).join(", ")}.`
    );
  }
  if (finalScore < 60) {
    gaps.push("Answer lacked technical accuracy and core architectural depth.");
  }

  // Adaptive note
  const isBeginnerQ = question.difficulty === "beginner";
  const adaptiveNote = isBeginnerQ
    ? finalScore >= 75
      ? "Demonstrated solid understanding of fundamental concepts; advancing to basic application and error handling."
      : finalScore >= 50
      ? "Demonstrated partial understanding; probing core syntax, basic properties, and foundational usage."
      : "Foundational conceptual gap detected; shifting follow-up to fundamental building blocks."
    : finalScore >= 75
    ? "Identified solid proficiency; advancing difficulty toward practical edge-cases and system trade-offs."
    : finalScore >= 50
    ? "Identified partial understanding; probing specific trade-offs and structural mechanics."
    : "Low technical accuracy detected; shifting follow-up to core fundamental concepts.";

  // Extract verified verbatim evidence quote from candidate's actual answer text
  let evidenceQuote: string | null = null;
  if (matchedKeywords.length > 0) {
    // Locate the first sentence or clause in raw text containing any matched keyword
    const sentences = raw.split(/(?<=[.!?\n])\s+/);
    for (const sentence of sentences) {
      const sentenceLower = sentence.toLowerCase();
      if (matchedKeywords.some((kw) => sentenceLower.includes(kw.toLowerCase())) && sentence.trim().length >= 10) {
        evidenceQuote = sentence.trim();
        break;
      }
    }
    // Fallback: substring around first keyword if no sentence split matched
    if (!evidenceQuote && raw.length >= 10) {
      evidenceQuote = raw.slice(0, Math.min(180, raw.length)).trim();
    }
  }

  const technicalCorrectness = finalScore >= 75 ? "accurate" : finalScore >= 50 ? "partial" : "incorrect";
  const explanationQuality = finalScore >= 75 ? "clear" : finalScore >= 50 ? "acceptable" : "confusing";
  const completeness = finalScore >= 80 ? "complete" : finalScore >= 50 ? "partially_complete" : "incomplete";
  const competencyStatus: SkillStatusCategory =
    finalScore >= 75 && Boolean(evidenceQuote && evidenceQuote.length >= 10)
      ? "demonstrated"
      : "claimed_unvalidated";

  return {
    score: finalScore,
    strengths,
    gaps,
    adaptiveNote,
    technicalCorrectness,
    explanationQuality,
    reasoningAndProblemSolving:
      finalScore >= 75
        ? "Candidate demonstrated coherent architectural reasoning with technical concept linkages."
        : finalScore >= 50
        ? "Candidate demonstrated partial conceptual understanding with gaps in practical edge cases."
        : "Candidate did not articulate sound technical mechanics or core problem-solving flow.",
    completeness,
    evidenceQuote,
    missingConcepts: missingKeywords,
    competencyStatus,
    confidence: isEvasive ? "high" : matchRatio >= 0.7 ? "high" : matchRatio >= 0.4 ? "medium" : "low",
  };
}

/**
 * Deterministically branches to the next question based on answer analysis and role question bank,
 * strictly calibrated to the candidate's chosen experience level.
 */
export function getNextAdaptiveQuestion(
  currentQuestion: Question,
  candidateAnswer: string,
  session: InterviewSession
): Question | null {
  const roleBank = QUESTION_BANK[session.setup.targetRole] || QUESTION_BANK.fullstack;
  const answeredIds = new Set(session.answers.map((a) => a.questionId));
  answeredIds.add(currentQuestion.id);

  const targetLevel = session.setup.experienceLevel || "intermediate";
  const normalized = candidateAnswer.toLowerCase();

  // 1. Check if an adaptive branch trigger is matched
  if (currentQuestion.followUpBranches) {
    for (const branch of currentQuestion.followUpBranches) {
      if (branch.keywordTrigger) {
        const matches = branch.keywordTrigger.some((kw) => normalized.includes(kw.toLowerCase()));
        if (matches) {
          const followUpQ = roleBank.find((q) => q.id === branch.followUpQuestionId);
          if (followUpQ && !answeredIds.has(followUpQ.id)) {
            // Guardrail: A beginner candidate should never be jumped directly to an advanced question
            if (targetLevel === "beginner" && followUpQ.difficulty === "advanced") {
              // Skip this branch and continue
            } else {
              return followUpQ;
            }
          }
        }
      }
    }
  }

  // 2. Pick next available unasked question matching the candidate's experience level
  const sameLevelUnasked = roleBank.find((q) => !answeredIds.has(q.id) && q.difficulty === targetLevel);
  if (sameLevelUnasked) {
    return sameLevelUnasked;
  }

  // 3. If exact level is exhausted, select from adjacent difficulty without over-escalating
  const fallbackOrdered =
    targetLevel === "beginner"
      ? roleBank.filter((q) => q.difficulty === "intermediate")
      : targetLevel === "advanced"
      ? roleBank.filter((q) => q.difficulty === "intermediate")
      : roleBank.filter((q) => q.difficulty === "beginner" || q.difficulty === "advanced");

  const nextClosest = fallbackOrdered.find((q) => !answeredIds.has(q.id));
  if (nextClosest) {
    return nextClosest;
  }

  // 4. Any remaining unasked question in the role bank
  const nextInBank = roleBank.find((q) => !answeredIds.has(q.id));
  if (nextInBank) {
    return nextInBank;
  }

  // 5. Cross-role fallback if role questions exhausted, matching level first
  const fallbackBank = QUESTION_BANK.fullstack;
  const crossRoleMatch = fallbackBank.find((q) => !answeredIds.has(q.id) && q.difficulty === targetLevel);
  if (crossRoleMatch) {
    return crossRoleMatch;
  }

  const fallbackQ = fallbackBank.find((q) => !answeredIds.has(q.id));
  return fallbackQ || null;
}

/**
 * Synthesizes an evaluation report from a completed or ended interview session.
 */
export function generateEvaluationReport(session: InterviewSession): EvaluationReport {
  const answers = session?.answers || [];
  const totalAnswers = answers.length;

  let averageScore = 0;
  if (totalAnswers > 0) {
    const sum = answers.reduce((acc, curr) => acc + Math.max(16, curr.feedback?.score || 16), 0);
    averageScore = Math.max(18, Math.round(sum / totalAnswers));
  }

  // Category metrics aggregation
  const categoryMap = new Map<string, { sum: number; count: number }>();
  for (const a of answers) {
    const existing = categoryMap.get(a.category) || { sum: 0, count: 0 };
    categoryMap.set(a.category, {
      sum: existing.sum + Math.max(16, a.feedback?.score || 16),
      count: existing.count + 1,
    });
  }

  // Always ensure at least 2 metrics
  if (categoryMap.size === 0) {
    categoryMap.set("Core Architecture", { sum: 20, count: 1 });
    categoryMap.set("Problem Solving", { sum: 22, count: 1 });
  }

  const metrics: SkillMetric[] = Array.from(categoryMap.entries()).map(([cat, data], idx) => {
    const catScore = Math.max(18, Math.round(data.sum / data.count));
    let level: SkillMetric["level"] = "Developing";
    if (catScore >= 85) level = "Mastery";
    else if (catScore >= 70) level = "Proficient";
    else if (catScore >= 50) level = "Developing";
    else level = "Needs Focus";

    const relevantAnswer = answers.find((a) => a.category === cat);
    let quote = "";
    if (relevantAnswer && relevantAnswer.answerText.trim().length > 20) {
      // Extract verbatim clause from the candidate's real answer
      const sentences = relevantAnswer.answerText.split(/[.?!]/).map((s) => s.trim()).filter((s) => s.length >= 15);
      quote = sentences.length > 0 ? sentences[0].slice(0, 120) : relevantAnswer.answerText.slice(0, 100);
    }

    const status: SkillMetric["status"] =
      catScore >= 70 && quote
        ? "demonstrated"
        : "claimed_unvalidated";

    return {
      category: cat,
      score: catScore,
      level,
      totalEvaluated: data.count,
      status,
      confidence: quote ? (catScore >= 80 ? "high" : "medium") : "low",
      explanation: quote
        ? `Validated against candidate's concrete response with ${catScore}% benchmark scoring.`
        : "Candidate response lacked sufficient technical depth to fully validate claimed competency.",
      rubricCriteria: ["Technical Precision", "Architectural Trade-offs", "Edge Case Handling"],
      evidenceQuote: quote,
      questionReference: `Q${idx + 1}`,
    };
  });

  // Extract evidence citations directly from actual candidate answers
  const evidenceCitations: EvaluationReport["evidenceCitations"] = answers.map((ans, idx) => {
    let quote = "";
    let confidence: "high" | "medium" | "low" = "medium";
    let status: "demonstrated" | "claimed_unvalidated" | "not_assessed" = "demonstrated";

    if (ans.answerText.trim().length >= 25) {
      // Direct verbatim extract from candidate's answer
      const clauses = ans.answerText.split(/[,.;]/).map((c) => c.trim()).filter((c) => c.length >= 20);
      quote = clauses.length > 0 ? clauses[0] : ans.answerText.slice(0, 100);
      confidence = ans.feedback.score >= 80 ? "high" : "medium";
      status = ans.feedback.score >= 70 ? "demonstrated" : "claimed_unvalidated";
    } else {
      quote = "";
      confidence = "low";
      status = "claimed_unvalidated";
    }

    return {
      quote,
      context: quote
        ? `Candidate demonstrated ${ans.category} concepts with feedback score ${ans.feedback.score}/100.`
        : "Candidate answer was too brief or incomplete to extract supporting quote evidence.",
      competency: ans.category,
      questionIndex: idx + 1,
      questionText: ans.questionText,
      confidence,
      status,
    };
  });

  // Extract strengths from answers
  const strengths: string[] = [];
  answers.forEach((ans) => {
    if (ans.feedback.strengths.length > 0) {
      strengths.push(`${ans.category}: ${ans.feedback.strengths[0]}`);
    }
  });
  if (strengths.length === 0) {
    strengths.push("Demonstrated baseline technical comprehension across target role topics.");
    strengths.push("Clear problem articulation during structured inquiry.");
  }

  // Extract improvement areas
  const areasToImprove: string[] = [];
  answers.forEach((ans) => {
    if (ans.feedback.gaps.length > 0) {
      areasToImprove.push(`${ans.category}: ${ans.feedback.gaps[0]}`);
    }
  });
  if (areasToImprove.length === 0) {
    areasToImprove.push("Explore advanced resilience and system failure recovery scenarios.");
    areasToImprove.push("Practice time-bounded optimization trade-offs under constraints.");
  }

  // Generate recruiter follow-ups for round 2
  const recruiterFollowUps: EvaluationReport["recruiterFollowUps"] = [];
  if (answers.length > 0) {
    const lowestAnswer = [...answers].sort((a, b) => a.feedback.score - b.feedback.score)[0];
    recruiterFollowUps.push({
      id: `rf-det-1`,
      question: `Could you walk through a concrete production failure you resolved related to ${lowestAnswer.category}, including how you diagnosed it under monitoring?`,
      targetSkill: lowestAnswer.category,
      rationale: `Candidate scored ${lowestAnswer.feedback.score}% on ${lowestAnswer.category}. Probing real-world operational debugging will verify practical depth.`,
      verificationContext: `Candidate's response in Q${answers.indexOf(lowestAnswer) + 1} showed conceptual gaps: ${lowestAnswer.feedback.gaps[0] || "surface-level answer"}.`,
      uncertaintyLevel: "medium",
    });

    const highestAnswer = [...answers].sort((a, b) => b.feedback.score - a.feedback.score)[0];
    recruiterFollowUps.push({
      id: `rf-det-2`,
      question: `In your design for ${highestAnswer.category}, how would your architecture handle a 10x traffic spike or network split between availability zones?`,
      targetSkill: highestAnswer.category,
      rationale: `Candidate showed proficiency in ${highestAnswer.category}. Probe scalability limits and edge-case boundaries.`,
      verificationContext: `Demonstrated strength in Q${answers.indexOf(highestAnswer) + 1}.`,
      uncertaintyLevel: "low",
    });
  } else {
    recruiterFollowUps.push({
      id: `rf-det-default`,
      question: `Can you walk through your end-to-end architectural workflow for a high-availability microservice?`,
      targetSkill: "System Architecture",
      rationale: `No live answer turns recorded to validate architectural fluency.`,
      uncertaintyLevel: "high",
    });
  }

  // Skill status counts
  const skillStatusCounts = {
    demonstrated: metrics.filter((m) => m.status === "demonstrated").length,
    claimedUnvalidated: metrics.filter((m) => m.status === "claimed_unvalidated").length,
    notAssessed: metrics.filter((m) => m.status === "not_assessed").length,
  };

  // Actionable roadmap
  const actionableRoadmap = [
    `Deepen conceptual drill-down on ${metrics[0]?.category || "System Design"} patterns and edge cases.`,
    "Implement real-world benchmarking tests for memory allocations and network round-trips.",
    "Formulate structured responses using the STAR or Trade-off matrix framework during architectural questions.",
  ];

  let verdict: EvaluationReport["verdict"] = "Hire Recommendation";
  if (averageScore >= 88) verdict = "Strong Hire Recommendation";
  else if (averageScore < 72) verdict = "Additional Review Recommended";

  const durationMin = Math.max(1, Math.round(session.durationSeconds / 60));

  const report: EvaluationReport = {
    sessionId: session.id,
    candidateName: session.setup?.candidateName || "Anonymous Candidate",
    targetRole: ROLE_LABELS[session.setup?.targetRole || "fullstack"] || "Software Engineer",
    experienceLevel:
      (session.setup?.experienceLevel || "intermediate").charAt(0).toUpperCase() +
      (session.setup?.experienceLevel || "intermediate").slice(1),
    interviewFocus: (session.setup?.interviewFocus || "mixed").replace("-", " ").toUpperCase(),
    completedAt: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    durationMinutes: durationMin,
    overallScore: averageScore,
    verdict,
    metrics,
    strengths: strengths.slice(0, 3),
    areasToImprove: areasToImprove.slice(0, 3),
    actionableRoadmap,
    answerRecords: answers,
    isDemoSimulation: true,
    userId: session.setup?.userId || session.userId,
    evidenceCitations,
    recruiterFollowUps,
    skillStatusCounts,
  };

  saveStoredReport(report);
  return report;
}
