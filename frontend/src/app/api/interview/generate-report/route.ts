import { NextRequest, NextResponse } from "next/server";
import { callGemini, parseGeminiJson } from "@/lib/gemini";
import { InterviewSession, EvaluationReport, SkillMetric, SkillStatusCategory } from "@/lib/types";
import { resolveRequestUser } from "@/lib/resolve-user";
import { persistReport } from "@/lib/report-persistence";
import { generateEvaluationReport } from "@/lib/interview-engine";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  let session: InterviewSession | undefined;
  let effectiveUserId: string | undefined;

  try {
    const auth = await resolveRequestUser(req);
    const body = await req.json();
    session = body.session;
    const forceDeterministic = Boolean(body.forceDeterministic);

    if (!session || !session.id) {
      return NextResponse.json({ error: "Missing session data" }, { status: 400 });
    }

    // Never trust client-supplied userId: only authenticate via server session cookie
    effectiveUserId = auth.authenticated && auth.user ? auth.user.id : undefined;

    // Check if session exists in DB and belongs to a different candidate
    const existingDbSession = await prisma.interviewSession.findUnique({
      where: { id: session.id },
    });

    if (existingDbSession && existingDbSession.userId) {
      if (!auth.authenticated || !auth.user || auth.user.id !== existingDbSession.userId) {
        return NextResponse.json(
          { error: "Forbidden: You cannot generate or overwrite a report for another candidate's session." },
          { status: 403 }
        );
      }
    }

    const answers = session.answers || [];
    const totalAnswers = answers.length;

    // If deterministic mode forced or no answers recorded, use deterministic generator directly
    if (forceDeterministic || totalAnswers === 0) {
      const report = generateEvaluationReport(session);
      report.userId = effectiveUserId;
      report.isDemoSimulation = true;
      const savedReport = await persistReport(report, session, effectiveUserId);
      return NextResponse.json({ report: savedReport });
    }

    let averageScore = 80;
    if (totalAnswers > 0) {
      const sum = answers.reduce((acc, curr) => acc + curr.feedback.score, 0);
      averageScore = Math.round(sum / totalAnswers);
    }

    const transcript = answers
      .map(
        (a, idx) =>
          `[Question ${idx + 1}] (${a.category} - ${a.difficulty}): "${a.questionText}"\n[Candidate Answer]: "${a.answerText}"\n[Turn Score]: ${a.feedback.score}/100\n[Strengths]: ${a.feedback.strengths.join("; ")}\n[Gaps]: ${a.feedback.gaps.join("; ")}`
      )
      .join("\n\n");

    const resumeSkills = session.setup?.skills?.join(", ") || "General Engineering";

    const prompt = `You are a calibrated senior engineering hiring manager synthesizing an evidence-backed interview report.
Role: ${session.setup?.targetRole || "fullstack"} | Level: ${session.setup?.experienceLevel || "intermediate"}
Focus: ${(session.setup?.interviewFocus || "mixed").replace("-", " ")}
Candidate: ${session.setup?.candidateName || "Candidate"}
Claimed Skills / Focus Areas: ${resumeSkills}
Duration: ${Math.max(1, Math.round((session.durationSeconds || 0) / 60))} min
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

Respond ONLY with valid JSON (no markdown formatting, no code fences):
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

    console.log(`[🤖 Gemini AI] Synthesizing Day 2 evidence-backed report for ${session.setup?.candidateName}...`);
    let aiReport: any;

    try {
      const raw = await callGemini(prompt);
      aiReport = parseGeminiJson<any>(raw);
      console.log(`[🤖 Gemini AI] Day 2 Report synthesis received from Gemini.`);
    } catch (aiErr) {
      console.warn("[🤖 Gemini AI] AI call failed or timed out. Falling back to deterministic rubric:", aiErr);
      const fallback = generateEvaluationReport(session);
      fallback.userId = effectiveUserId;
      fallback.isDemoSimulation = true;
      const savedFallback = await persistReport(fallback, session, effectiveUserId);
      return NextResponse.json({ report: savedFallback });
    }

    const validVerdicts = [
      "Strong Hire Recommendation",
      "Hire Recommendation",
      "Additional Review Recommended",
    ] as const;
    let verdict: EvaluationReport["verdict"] = "Hire Recommendation";
    if (aiReport.verdict && (validVerdicts as readonly string[]).includes(aiReport.verdict)) {
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

    // ─── VERBATIM QUOTE INTEGRITY VALIDATION ───
    // Check every quote against real answers to prevent AI hallucinations
    const verifiedCitations: EvaluationReport["evidenceCitations"] = [];
    const rawCitations = aiReport.evidenceCitations || [];

    for (const item of rawCitations) {
      const trimmedQuote = (item.quote || "").trim();
      const targetAns = answers.find(
        (a) => trimmedQuote.length >= 6 && a.answerText.toLowerCase().includes(trimmedQuote.toLowerCase())
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

    // Process and sanitize metrics
    const metrics: SkillMetric[] = (aiReport.metrics || []).map((m: any, idx: number) => {
      const qRef = m.questionReference || `Q${(idx % totalAnswers) + 1}`;
      let evidenceQuote = (m.evidenceQuote || "").trim();
      const quoteMatches = answers.some(
        (a) => evidenceQuote.length >= 6 && a.answerText.toLowerCase().includes(evidenceQuote.toLowerCase())
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
        level: (m.level as SkillMetric["level"]) || "Proficient",
        totalEvaluated: m.totalEvaluated || 1,
        status,
        confidence: m.confidence || (evidenceQuote ? "high" : "medium"),
        explanation: m.explanation || `Evaluated with score ${m.score}% based on candidate responses.`,
        rubricCriteria: m.rubricCriteria || ["Technical Accuracy", "Implementation Trade-offs"],
        evidenceQuote,
        questionReference: qRef,
      };
    });

    if (metrics.length === 0) {
      metrics.push({
        category: "Core Technical Skills",
        score: averageScore,
        level: "Proficient",
        totalEvaluated: totalAnswers,
        status: averageScore >= 75 ? "demonstrated" : "claimed_unvalidated",
        confidence: "medium",
        explanation: "Holistic evaluation across all submitted answer turns.",
      });
    }

    const skillStatusCounts = {
      demonstrated: metrics.filter((m) => m.status === "demonstrated").length,
      claimedUnvalidated: metrics.filter((m) => m.status === "claimed_unvalidated").length,
      notAssessed: metrics.filter((m) => m.status === "not_assessed").length,
    };

    const recruiterFollowUps: EvaluationReport["recruiterFollowUps"] = (
      aiReport.recruiterFollowUps || []
    ).map((rf: any, idx: number) => ({
      id: `rf-${Date.now()}-${idx}`,
      question: rf.question,
      targetSkill: rf.targetSkill,
      rationale: rf.rationale,
      verificationContext: rf.verificationContext,
      uncertaintyLevel: rf.uncertaintyLevel || "medium",
    }));

    const report: EvaluationReport = {
      sessionId: session.id,
      candidateName: session.setup?.candidateName || "Anonymous Candidate",
      targetRole: ROLE_LABELS[session.setup?.targetRole || "fullstack"] || "Software Engineer",
      experienceLevel: (session.setup?.experienceLevel || "intermediate").charAt(0).toUpperCase() + (session.setup?.experienceLevel || "intermediate").slice(1),
      interviewFocus: (session.setup?.interviewFocus || "mixed").replace("-", " ").toUpperCase(),
      completedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      durationMinutes: Math.max(1, Math.round((session.durationSeconds || 0) / 60)),
      overallScore: averageScore,
      verdict,
      metrics,
      strengths: (aiReport.strengths || []).slice(0, 3),
      areasToImprove: (aiReport.areasToImprove || []).slice(0, 3),
      actionableRoadmap: (aiReport.actionableRoadmap || []).slice(0, 4),
      answerRecords: session.answers,
      isDemoSimulation: false,
      userId: effectiveUserId,
      evidenceCitations: verifiedCitations,
      recruiterFollowUps,
      skillStatusCounts,
    };

    // Persist completed report to SQLite with idempotency
    const savedDomainReport = await persistReport(report, session, effectiveUserId);
    return NextResponse.json({ report: savedDomainReport });
  } catch (err: any) {
    if (err?.message?.includes("Forbidden") || err?.message?.includes("Cannot save report to another candidate")) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[generate-report] Unexpected error, trying deterministic fallback:", err);

    if (session) {
      try {
        const fallback = generateEvaluationReport(session);
        fallback.userId = effectiveUserId;
        fallback.isDemoSimulation = true;
        const savedFallback = await persistReport(fallback, session, effectiveUserId);
        return NextResponse.json({ report: savedFallback });
      } catch (fallbackErr) {
        console.error("[generate-report] Fatal persistence fallback error:", fallbackErr);
      }
    }

    return NextResponse.json(
      { error: "Failed to generate and persist interview report." },
      { status: 500 }
    );
  }
}
