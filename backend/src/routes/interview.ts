import { Router, Request, Response } from "express";
import { callGemini, parseGeminiJson } from "../services/gemini";
import {
  CandidateSetup,
  Question,
  AnswerFeedback,
  AnswerRecord,
  InterviewSession,
  EvaluationReport,
  SkillStatusCategory,
} from "../types";

const router = Router();

// Generate initial question tailored to candidate profile
router.post("/generate-question", async (req: Request, res: Response) => {
  try {
    const { setup, previousQuestions = [], resumeText = "" } = req.body;

    if (!setup) {
      return res.status(400).json({ error: "Missing candidate setup." });
    }

    const previousQList =
      previousQuestions.length > 0
        ? `\n\nAlready asked (do NOT repeat):\n${previousQuestions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}`
        : "";

    const resumeContext = resumeText
      ? `\n\nCandidate's Resume / Skills:\n${String(resumeText).slice(0, 1500)}`
      : "";

    const prompt = `You are an expert technical interviewer conducting a live ${setup.interviewFocus.replace("-", " ")} interview for a ${setup.targetRole} role.
Experience level: ${setup.experienceLevel}.
Candidate name: ${setup.candidateName || "the candidate"}.
Skills to probe: ${setup.skills?.join(", ") || "general software engineering"}.${resumeContext}

Generate ONE highly specific, probing technical interview question.
Requirements:
- Directly relevant to the ${setup.targetRole} role and ${setup.interviewFocus} focus.
- Match difficulty to ${setup.experienceLevel} level.
- Open-ended, requiring architectural thinking or trade-offs.
- No trivial, multiple-choice, or yes/no questions.${previousQList}

Respond ONLY with valid JSON:
{
  "id": "ai-q-${Date.now()}",
  "role": "${setup.targetRole}",
  "category": "<topic area>",
  "difficulty": "${setup.experienceLevel}",
  "questionText": "<the full question>",
  "context": "<1-2 sentence context or null>",
  "hint": "<a subtle guiding hint>",
  "expectedKeywords": ["<keyword1>", "<keyword2>", "<keyword3>", "<keyword4>"]
}`;

    const raw = await callGemini(prompt);
    const question = parseGeminiJson<Question>(raw);
    return res.status(200).json({ question });
  } catch (err) {
    console.error("[interview] generate-question error:", err);
    return res.status(500).json({ error: "Failed to generate AI question." });
  }
});

// Evaluate an answer using Gemini rubric
router.post("/evaluate-answer", async (req: Request, res: Response) => {
  try {
    const { question, answerText, candidateName, targetRole, experienceLevel } = req.body;

    if (!question || !answerText) {
      return res.status(400).json({ error: "Missing question or answer text." });
    }

    const prompt = `You are a strict, fair, and calibrated technical interviewer evaluating a candidate's response.

Role: ${targetRole || question.role}
Seniority Level: ${experienceLevel || question.difficulty}
Category: ${question.category}

Question:
"${question.questionText}"

Expected Keywords / Concepts:
${(question.expectedKeywords || []).join(", ")}

Candidate's Answer:
"${answerText}"

Score the answer from 0 to 100 based on technical correctness, depth, trade-off understanding, and clarity.
Respond ONLY with valid JSON:
{
  "score": <0-100 integer>,
  "strengths": ["<strength 1>", "<strength 2>"],
  "gaps": ["<gap 1>", "<gap 2>"],
  "adaptiveNote": "<1-2 sentence constructive assessment>"
}`;

    const raw = await callGemini(prompt);
    const feedback = parseGeminiJson<AnswerFeedback>(raw);
    return res.status(200).json({ feedback });
  } catch (err) {
    console.error("[interview] evaluate-answer error:", err);
    return res.status(500).json({ error: "Failed to evaluate answer." });
  }
});

// Adaptive Next Question
router.post("/next-question", async (req: Request, res: Response) => {
  try {
    const { setup, lastQuestion, lastAnswerText, lastScore, previousAnswers = [] } = req.body;

    if (!setup || !lastQuestion) {
      return res.status(400).json({ error: "Missing required setup or last question." });
    }

    const previousQList = previousAnswers
      .map((a: AnswerRecord, idx: number) => `Q${idx + 1} (${a.category}): "${a.questionText}" [Score: ${a.feedback.score}]`)
      .join("\n");

    const prompt = `You are an adaptive technical interviewer.
Target Role: ${setup.targetRole} | Level: ${setup.experienceLevel}
Focus: ${setup.interviewFocus}

Last Question: "${lastQuestion.questionText}" (${lastQuestion.category})
Last Answer: "${lastAnswerText}"
Last Score: ${lastScore}/100

Previous Questions:
${previousQList || "None"}

Generate the NEXT adaptive question:
- If last score >= 80: increase difficulty or ask deeper architectural trade-offs.
- If last score < 70: pivot to foundational core concepts or a different domain area.

Respond ONLY with valid JSON:
{
  "id": "ai-next-q-${Date.now()}",
  "role": "${setup.targetRole}",
  "category": "<category>",
  "difficulty": "${setup.experienceLevel}",
  "questionText": "<adaptive question text>",
  "context": "<context or null>",
  "hint": "<guiding hint>",
  "expectedKeywords": ["<kw1>", "<kw2>", "<kw3>"]
}`;

    const raw = await callGemini(prompt);
    const question = parseGeminiJson<Question>(raw);
    return res.status(200).json({ question });
  } catch (err) {
    console.error("[interview] next-question error:", err);
    return res.status(500).json({ error: "Failed to generate next question." });
  }
});

// Synthesize Evaluation Report
router.post("/generate-report", async (req: Request, res: Response) => {
  try {
    const { session } = req.body;

    if (!session) {
      return res.status(400).json({ error: "Missing session data." });
    }

    const answers = session.answers || [];
    let averageScore = 75;
    if (answers.length > 0) {
      const sum = answers.reduce((acc: number, curr: AnswerRecord) => acc + curr.feedback.score, 0);
      averageScore = Math.round(sum / answers.length);
    }

    const transcript = answers
      .map(
        (a: AnswerRecord, idx: number) =>
          `[Question ${idx + 1}] (${a.category} - ${a.difficulty}): "${a.questionText}"\n[Candidate Answer]: "${a.answerText}"\n[Turn Score]: ${a.feedback.score}/100\n[Strengths]: ${a.feedback.strengths.join("; ")}\n[Gaps]: ${a.feedback.gaps.join("; ")}`
      )
      .join("\n\n");

    const resumeSkills = session.setup.skills?.join(", ") || "General Engineering";

    const prompt = `You are a calibrated senior engineering hiring manager synthesizing an evidence-backed interview report.
Role: ${session.setup.targetRole} | Level: ${session.setup.experienceLevel}
Focus: ${session.setup.interviewFocus.replace("-", " ")}
Candidate: ${session.setup.candidateName || "Candidate"}
Claimed Skills / Focus Areas: ${resumeSkills}
Duration: ${Math.max(1, Math.round(session.durationSeconds / 60))} min
Overall Average Score: ${averageScore}/100

TRANSCRIPT:
${transcript || "No candidate answers recorded."}

EVALUATION RUBRIC & INSTRUCTIONS:
1. Evaluate 3 to 5 competencies tested in the interview.
2. For each competency, determine the skill status:
   - "demonstrated": sufficient answer evidence supports the skill with clear conceptual or practical execution.
   - "claimed_unvalidated": claimed in resume/skills or attempted, but answer was vague, weak, incorrect, or lacked depth.
   - "not_assessed": skill was not sufficiently tested or questioned in this session.
3. Ground every assessment in VERBATIM candidate quotes:
   - "evidenceQuote" and "quote" MUST be exact word-for-word substrings of the candidate's actual answer text from the transcript.
   - If no verbatim supporting quote exists, return an empty string "" for quote and state why evidence is insufficient.
   - Do NOT fabricate, rephrase, or hallucinate candidate statements.
4. Distinguish an incorrect answer from an unassessed skill.
5. Generate 2 to 3 targeted "recruiterFollowUps" for human recruiters in round two to probe unvalidated claims or test depth.

Respond ONLY with valid JSON:
{
  "verdict": "<Strong Hire Recommendation|Hire Recommendation|Additional Review Recommended>",
  "metrics": [
    {
      "category": "<competency name>",
      "score": <0-100 integer>,
      "level": "<Needs Focus|Developing|Proficient|Mastery>",
      "totalEvaluated": <number of questions>,
      "status": "<demonstrated|claimed_unvalidated|not_assessed>",
      "confidence": "<high|medium|low>",
      "explanation": "<1-2 sentence assessment justification>",
      "rubricCriteria": ["<criterion 1>", "<criterion 2>"],
      "evidenceQuote": "<verbatim candidate quote substring or empty string>",
      "questionReference": "Q1"
    }
  ],
  "evidenceCitations": [
    {
      "quote": "<verbatim candidate quote substring or empty string>",
      "context": "<how this quote proves or disproves competency>",
      "competency": "<competency name>",
      "questionIndex": 1,
      "confidence": "<high|medium|low>",
      "status": "<demonstrated|claimed_unvalidated|not_assessed>"
    }
  ],
  "recruiterFollowUps": [
    {
      "question": "<specific technical probing question for round 2>",
      "targetSkill": "<competency or claimed skill>",
      "rationale": "<why recruiter must probe this>",
      "verificationContext": "<candidate quote or gap that prompted this>",
      "uncertaintyLevel": "<low|medium|high>"
    }
  ],
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "areasToImprove": ["<gap 1>", "<gap 2>", "<gap 3>"],
  "actionableRoadmap": ["<action 1>", "<action 2>", "<action 3>"]
}`;

    const raw = await callGemini(prompt);
    const aiReport = parseGeminiJson<any>(raw);

    // ─── VERBATIM QUOTE INTEGRITY VALIDATION ───
    const verifiedCitations: any[] = [];
    const rawCitations = aiReport.evidenceCitations || [];

    for (const item of rawCitations) {
      const trimmedQuote = (item.quote || "").trim();
      const targetAns = answers.find(
        (a: AnswerRecord) => trimmedQuote.length >= 6 && a.answerText.toLowerCase().includes(trimmedQuote.toLowerCase())
      );

      if (targetAns && trimmedQuote.length >= 6) {
        const qIdx = answers.indexOf(targetAns) + 1;
        verifiedCitations.push({
          quote: trimmedQuote,
          context: item.context || "Direct response evidence supporting competency assessment.",
          competency: item.competency || targetAns.category,
          questionIndex: qIdx,
          questionText: targetAns.questionText,
          confidence: item.confidence || "high",
          status: item.status || "demonstrated",
        });
      } else {
        verifiedCitations.push({
          quote: "",
          context: item.context
            ? `${item.context} (Assessment derived from overall answer analysis; no direct verbatim quote isolated)`
            : "No isolated verbatim answer quote recorded for this competency.",
          competency: item.competency || "Technical Competency",
          questionIndex: item.questionIndex && item.questionIndex <= answers.length ? item.questionIndex : 1,
          questionText: answers[0]?.questionText,
          confidence: "low",
          status: item.status === "demonstrated" ? "claimed_unvalidated" : (item.status || "not_assessed"),
        });
      }
    }

    const metrics = (aiReport.metrics || []).map((m: any, idx: number) => {
      const qRef = m.questionReference || `Q${(idx % Math.max(1, answers.length)) + 1}`;
      let evidenceQuote = (m.evidenceQuote || "").trim();
      const quoteMatches = answers.some(
        (a: AnswerRecord) => evidenceQuote.length >= 6 && a.answerText.toLowerCase().includes(evidenceQuote.toLowerCase())
      );
      if (!quoteMatches) {
        evidenceQuote = "";
      }

      let status: SkillStatusCategory = m.status || "claimed_unvalidated";
      if (status === "demonstrated" && (!evidenceQuote || m.score < 70)) {
        status = "claimed_unvalidated";
      } else if (!m.status) {
        status = m.score >= 75 && evidenceQuote ? "demonstrated" : "claimed_unvalidated";
      }
      if (!m.totalEvaluated || m.totalEvaluated === 0) {
        status = "not_assessed";
      }

      return {
        category: m.category,
        score: Math.min(100, Math.max(0, Math.round(m.score))),
        level: m.level || "Proficient",
        totalEvaluated: m.totalEvaluated || 1,
        status,
        confidence: m.confidence || (evidenceQuote ? "high" : "medium"),
        explanation: m.explanation || `Evaluated with score ${m.score}% based on candidate responses.`,
        rubricCriteria: m.rubricCriteria || ["Technical Accuracy", "Implementation Trade-offs"],
        evidenceQuote,
        questionReference: qRef,
      };
    });

    const skillStatusCounts = {
      demonstrated: metrics.filter((m: any) => m.status === "demonstrated").length,
      claimedUnvalidated: metrics.filter((m: any) => m.status === "claimed_unvalidated").length,
      notAssessed: metrics.filter((m: any) => m.status === "not_assessed").length,
    };

    const recruiterFollowUps = (aiReport.recruiterFollowUps || []).map((rf: any, idx: number) => ({
      id: `rf-${Date.now()}-${idx}`,
      question: rf.question,
      targetSkill: rf.targetSkill,
      rationale: rf.rationale,
      verificationContext: rf.verificationContext,
      uncertaintyLevel: rf.uncertaintyLevel || "medium",
    }));

    const report: EvaluationReport = {
      sessionId: session.id,
      candidateName: session.setup.candidateName,
      targetRole: session.setup.targetRole,
      experienceLevel: session.setup.experienceLevel,
      interviewFocus: session.setup.interviewFocus,
      completedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      durationMinutes: Math.max(1, Math.round(session.durationSeconds / 60)),
      overallScore: averageScore,
      verdict: aiReport.verdict || "Hire Recommendation",
      metrics,
      strengths: aiReport.strengths || [],
      areasToImprove: aiReport.areasToImprove || [],
      actionableRoadmap: aiReport.actionableRoadmap || [],
      answerRecords: answers,
      isDemoSimulation: false,
      userId: session.userId,
      evidenceCitations: verifiedCitations,
      recruiterFollowUps,
      skillStatusCounts,
    };

    return res.status(200).json({ report });
  } catch (err) {
    console.error("[interview] generate-report error:", err);
    return res.status(500).json({ error: "Failed to synthesize report." });
  }
});

export default router;
