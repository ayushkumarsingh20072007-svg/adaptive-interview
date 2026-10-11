import {
  CandidateSetup,
  Question,
  AnswerFeedback,
  InterviewSession,
  EvaluationReport,
  SkillMetric,
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
 * Retrieves the starting question for a given role.
 */
export function getInitialQuestion(setup: CandidateSetup): Question {
  const roleBank = QUESTION_BANK[setup.targetRole] || QUESTION_BANK.fullstack;
  return roleBank[0];
}

/**
 * Deterministically evaluates a candidate's answer without random number generation.
 * Evaluates technical keyword matches, conceptual depth, and structure.
 */
export function evaluateAnswer(question: Question, answerText: string): AnswerFeedback {
  const normalized = answerText.toLowerCase().trim();
  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  for (const kw of question.expectedKeywords) {
    if (normalized.includes(kw.toLowerCase())) {
      matchedKeywords.push(kw);
    } else {
      missingKeywords.push(kw);
    }
  }

  // Base score calculation based on length and keywords
  let baseScore = 72;

  // Length check bonus (encourages articulated reasoning)
  if (normalized.length > 80) baseScore += 5;
  if (normalized.length > 200) baseScore += 5;

  // Keyword match contribution
  const matchRatio = question.expectedKeywords.length > 0 
    ? matchedKeywords.length / question.expectedKeywords.length 
    : 0.5;
  const keywordScore = Math.round(matchRatio * 16);

  const finalScore = Math.min(96, Math.max(65, baseScore + keywordScore));

  // Determine strengths
  const strengths: string[] = [];
  if (matchedKeywords.length > 0) {
    strengths.push(
      `Accurately integrated core terminology: ${matchedKeywords.slice(0, 3).join(", ")}.`
    );
  }
  if (normalized.length > 150) {
    strengths.push("Provided concrete architectural rationale rather than brief definitions.");
  } else {
    strengths.push("Direct and concise conceptual explanation.");
  }

  // Determine gaps
  const gaps: string[] = [];
  if (missingKeywords.length > 0) {
    gaps.push(
      `Could explicitly address trade-offs regarding: ${missingKeywords.slice(0, 2).join(", ")}.`
    );
  } else {
    gaps.push("Could further explore failure edge-cases and fallback degradation strategies.");
  }

  // Adaptive note
  const adaptiveNote = matchedKeywords.length >= 2
    ? "Identified advanced conceptual grasp; adapting follow-up toward edge cases and scalability."
    : "Calibrating next question to evaluate fundamental structural patterns.";

  return {
    score: finalScore,
    strengths,
    gaps,
    adaptiveNote,
  };
}

/**
 * Deterministically branches to the next question based on answer analysis and role question bank.
 */
export function getNextAdaptiveQuestion(
  currentQuestion: Question,
  candidateAnswer: string,
  session: InterviewSession
): Question | null {
  const roleBank = QUESTION_BANK[session.setup.targetRole] || QUESTION_BANK.fullstack;
  const answeredIds = new Set(session.answers.map((a) => a.questionId));
  answeredIds.add(currentQuestion.id);

  const normalized = candidateAnswer.toLowerCase();

  // 1. Check if an adaptive branch trigger is matched
  if (currentQuestion.followUpBranches) {
    for (const branch of currentQuestion.followUpBranches) {
      if (branch.keywordTrigger) {
        const matches = branch.keywordTrigger.some((kw) => normalized.includes(kw.toLowerCase()));
        if (matches) {
          const followUpQ = roleBank.find((q) => q.id === branch.followUpQuestionId);
          if (followUpQ && !answeredIds.has(followUpQ.id)) {
            return followUpQ;
          }
        }
      }
    }
  }

  // 2. Otherwise pick next available unasked question in the role bank
  const nextInBank = roleBank.find((q) => !answeredIds.has(q.id));
  if (nextInBank) {
    return nextInBank;
  }

  // 3. Fallback: Check if there's an unasked question in fullstack if role questions exhausted
  const fallbackBank = QUESTION_BANK.fullstack;
  const fallbackQ = fallbackBank.find((q) => !answeredIds.has(q.id));
  return fallbackQ || null;
}

/**
 * Synthesizes an evaluation report from a completed or ended interview session.
 */
export function generateEvaluationReport(session: InterviewSession): EvaluationReport {
  const answers = session.answers;
  const totalAnswers = answers.length;

  let averageScore = 80;
  if (totalAnswers > 0) {
    const sum = answers.reduce((acc, curr) => acc + curr.feedback.score, 0);
    averageScore = Math.round(sum / totalAnswers);
  }

  // Category metrics aggregation
  const categoryMap = new Map<string, { sum: number; count: number }>();
  for (const a of answers) {
    const existing = categoryMap.get(a.category) || { sum: 0, count: 0 };
    categoryMap.set(a.category, {
      sum: existing.sum + a.feedback.score,
      count: existing.count + 1,
    });
  }

  // Always ensure at least 2 metrics
  if (categoryMap.size === 0) {
    categoryMap.set("Core Architecture", { sum: 85, count: 1 });
    categoryMap.set("Problem Solving", { sum: 82, count: 1 });
  }

  const metrics: SkillMetric[] = Array.from(categoryMap.entries()).map(([cat, data], idx) => {
    const catScore = Math.round(data.sum / data.count);
    let level: SkillMetric["level"] = "Proficient";
    if (catScore >= 90) level = "Mastery";
    else if (catScore < 75) level = "Needs Focus";
    else if (catScore < 82) level = "Developing";

    const relevantAnswer = answers.find((a) => a.category === cat);
    let quote = "";
    if (relevantAnswer && relevantAnswer.answerText.trim().length > 20) {
      // Extract verbatim clause from the candidate's real answer
      const sentences = relevantAnswer.answerText.split(/[.?!]/).map((s) => s.trim()).filter((s) => s.length >= 15);
      quote = sentences.length > 0 ? sentences[0].slice(0, 120) : relevantAnswer.answerText.slice(0, 100);
    }

    const status: SkillMetric["status"] =
      catScore >= 75 && quote
        ? "demonstrated"
        : catScore < 65 || !quote
        ? "claimed_unvalidated"
        : "demonstrated";

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
    userId: session.setup.userId || session.userId,
    evidenceCitations,
    recruiterFollowUps,
    skillStatusCounts,
  };

  saveStoredReport(report);
  return report;
}
