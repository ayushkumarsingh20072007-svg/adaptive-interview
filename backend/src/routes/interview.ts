import { Router, Request, Response } from "express";
import { callGemini, parseGeminiJson } from "../services/gemini";
import {
  CandidateSetup,
  Question,
  AnswerFeedback,
  AnswerRecord,
  InterviewSession,
  EvaluationReport,
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
      .map((a: AnswerRecord, idx: number) => `Q${idx + 1} [${a.category}]: "${a.questionText}"\nAnswer: "${a.answerText.slice(0, 300)}"\nScore: ${a.feedback.score}/100`)
      .join("\n\n");

    const prompt = `You are a senior hiring manager synthesizing an evidence-backed interview report.
Candidate: ${session.setup.candidateName}
Role: ${session.setup.targetRole} (${session.setup.experienceLevel})
Average Score: ${averageScore}/100

Transcript:
${transcript || "No transcript"}

Respond ONLY with valid JSON:
{
  "verdict": "<Strong Hire Recommendation|Hire Recommendation|Additional Review Recommended>",
  "metrics": [
    {"category": "<Category>", "score": <0-100>, "level": "<Proficient|Mastery|Developing|Needs Focus>", "totalEvaluated": <count>}
  ],
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "areasToImprove": ["<gap 1>", "<gap 2>"],
  "actionableRoadmap": ["<action 1>", "<action 2>", "<action 3>"]
}`;

    const raw = await callGemini(prompt);
    const aiReport = parseGeminiJson<any>(raw);

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
      metrics: aiReport.metrics || [],
      strengths: aiReport.strengths || [],
      areasToImprove: aiReport.areasToImprove || [],
      actionableRoadmap: aiReport.actionableRoadmap || [],
      answerRecords: answers,
      isDemoSimulation: false,
      userId: session.userId,
    };

    return res.status(200).json({ report });
  } catch (err) {
    console.error("[interview] generate-report error:", err);
    return res.status(500).json({ error: "Failed to synthesize report." });
  }
});

export default router;
