import { NextRequest, NextResponse } from "next/server";
import { callGemini, parseGeminiJson } from "@/lib/gemini";
import { InterviewSession, EvaluationReport, SkillMetric } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const session: InterviewSession = body.session;

    if (!session) {
      return NextResponse.json({ error: "Missing session data" }, { status: 400 });
    }

    const answers = session.answers;
    const totalAnswers = answers.length;

    let averageScore = 80;
    if (totalAnswers > 0) {
      const sum = answers.reduce((acc, curr) => acc + curr.feedback.score, 0);
      averageScore = Math.round(sum / totalAnswers);
    }

    const transcript = answers
      .map(
        (a, idx) =>
          `Q${idx + 1} [${a.category}]: "${a.questionText}"\nAnswer: "${a.answerText.slice(0, 300)}"\nScore: ${a.feedback.score}/100`
      )
      .join("\n\n");

    const prompt = `You are a senior hiring manager writing a candidate evaluation report.

Candidate: ${session.setup.candidateName || "Candidate"}
Role: ${session.setup.targetRole} | Level: ${session.setup.experienceLevel}
Focus: ${session.setup.interviewFocus.replace("-", " ")}
Duration: ${Math.max(1, Math.round(session.durationSeconds / 60))} min
Average Score: ${averageScore}/100

Transcript:
${transcript || "No answers."}

Respond ONLY with valid JSON (no markdown, no code fences):
{
  "verdict": "<Strong Hire Recommendation|Hire Recommendation|Additional Review Recommended>",
  "metrics": [{"category": "<area>", "score": <0-100>, "level": "<Needs Focus|Developing|Proficient|Mastery>", "totalEvaluated": <n>}],
  "strengths": ["<strength1>", "<strength2>", "<strength3>"],
  "areasToImprove": ["<gap1>", "<gap2>", "<gap3>"],
  "actionableRoadmap": ["<action1>", "<action2>", "<action3>"]
}`;

    console.log(`[🤖 Gemini AI] Synthesizing comprehensive final report for ${session.setup.candidateName}...`);
    const raw = await callGemini(prompt);
    console.log(`[🤖 Gemini AI] Report synthesis received from Gemini.`);
    const aiReport = parseGeminiJson<{
      verdict: string;
      metrics: { category: string; score: number; level: string; totalEvaluated: number }[];
      strengths: string[];
      areasToImprove: string[];
      actionableRoadmap: string[];
    }>(raw);

    const validVerdicts = [
      "Strong Hire Recommendation",
      "Hire Recommendation",
      "Additional Review Recommended",
    ] as const;
    let verdict: EvaluationReport["verdict"] = "Hire Recommendation";
    if ((validVerdicts as readonly string[]).includes(aiReport.verdict)) {
      verdict = aiReport.verdict as EvaluationReport["verdict"];
    } else if (averageScore >= 88) {
      verdict = "Strong Hire Recommendation";
    } else if (averageScore < 72) {
      verdict = "Additional Review Recommended";
    }

    const ROLE_LABELS: Record<string, string> = {
      frontend: "Frontend Engineer",
      backend: "Backend Engineer",
      fullstack: "Full-Stack Engineer",
      python: "Python Developer",
      java: "Java Developer",
      "data-analyst": "Data Analyst",
    };

    const metrics: SkillMetric[] = (aiReport.metrics || []).map((m) => ({
      category: m.category,
      score: Math.min(100, Math.max(0, Math.round(m.score))),
      level: (m.level as SkillMetric["level"]) || "Proficient",
      totalEvaluated: m.totalEvaluated || 1,
    }));

    if (metrics.length === 0) {
      metrics.push({ category: "Core Technical Skills", score: averageScore, level: "Proficient", totalEvaluated: totalAnswers });
    }

    const report: EvaluationReport = {
      sessionId: session.id,
      candidateName: session.setup.candidateName || "Anonymous Candidate",
      targetRole: ROLE_LABELS[session.setup.targetRole] || "Software Engineer",
      experienceLevel: session.setup.experienceLevel.charAt(0).toUpperCase() + session.setup.experienceLevel.slice(1),
      interviewFocus: session.setup.interviewFocus.replace("-", " ").toUpperCase(),
      completedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      durationMinutes: Math.max(1, Math.round(session.durationSeconds / 60)),
      overallScore: averageScore,
      verdict,
      metrics,
      strengths: (aiReport.strengths || []).slice(0, 3),
      areasToImprove: (aiReport.areasToImprove || []).slice(0, 3),
      actionableRoadmap: (aiReport.actionableRoadmap || []).slice(0, 4),
      answerRecords: session.answers,
      isDemoSimulation: false,
    };

    return NextResponse.json({ report });
  } catch (err) {
    console.error("[generate-report] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate report." },
      { status: 500 }
    );
  }
}
