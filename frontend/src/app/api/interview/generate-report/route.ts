import { NextRequest, NextResponse } from "next/server";
import { callGemini, parseGeminiJson } from "@/lib/gemini";
import { InterviewSession, EvaluationReport, SkillMetric, SkillStatusCategory, AnswerRecord } from "@/lib/types";
import { resolveRequestUser } from "@/lib/resolve-user";
import { persistReport, mapDbReportToDomain } from "@/lib/report-persistence";
import { generateEvaluationReport } from "@/lib/interview-engine";
import { prisma } from "@/lib/prisma";

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function POST(req: NextRequest) {
  let session: InterviewSession | undefined;
  let effectiveUserId: string | undefined;

  try {
    const auth = await resolveRequestUser(req);
    const body = await req.json();
    session = body.session;
    const forceDeterministic = Boolean(body.forceDeterministic);
    const forceRegenerate = Boolean(body.forceRegenerate);

    if (!session || !session.id) {
      return NextResponse.json({ error: "Missing session data" }, { status: 400 });
    }

    // Never trust client-supplied userId: only authenticate via server session cookie
    effectiveUserId = auth.authenticated && auth.user ? auth.user.id : undefined;

    // 1. Fetch authoritative session record from SQLite first
    const existingDbSession = await prisma.interviewSession
      .findUnique({
        where: { id: session.id },
        include: {
          answers: true,
          integrityEvents: { orderBy: { createdAt: "asc" } },
        },
      })
      .catch(() => null);

    // Enforce authorization for private candidate sessions
    if (existingDbSession && existingDbSession.userId && existingDbSession.userId !== "guest") {
      const isAuthorized =
        auth.authenticated &&
        auth.user &&
        (auth.user.role === "recruiter" || auth.user.id === existingDbSession.userId);

      if (!isAuthorized) {
        return NextResponse.json(
          { error: "Forbidden: You cannot access, generate, or regenerate a report for another candidate's session." },
          { status: 403 }
        );
      }
    }

    // 2. Idempotency Policy: Check if a report already exists for this session
    const existingReport = await prisma.evaluationReport
      .findUnique({
        where: { sessionId: session.id },
        include: {
          session: {
            include: {
              answers: true,
              review: true,
              integrityEvents: { orderBy: { createdAt: "asc" } },
            },
          },
        },
      })
      .catch(() => null);

    if (existingReport && !forceRegenerate) {
      // Safely return existing report without duplicate AI calls or overwrites
      const domainReport = mapDbReportToDomain(
        existingReport,
        existingReport.session?.answers,
        { isRecruiter: auth.user?.role === "recruiter" }
      );
      return NextResponse.json({ report: domainReport, existing: true });
    }

    // 3. Interview completion / termination requirement for report generation / forceRegenerate
    const isCompletedOrTerminated =
      existingDbSession?.status === "completed" ||
      existingDbSession?.status === "terminated_integrity" ||
      session.status === "completed" ||
      session.status === "terminated_integrity";

    if (!isCompletedOrTerminated) {
      return NextResponse.json(
        { error: "Cannot generate evaluation report: Interview session must be completed or terminated before generating a report." },
        { status: 400 }
      );
    }

    // If incoming session is completed but DB session is still in-progress, sync completion to DB
    if (existingDbSession && existingDbSession.status === "in-progress" && session.status === "completed") {
      await prisma.interviewSession
        .update({
          where: { id: session.id },
          data: {
            status: "completed",
            endedAt: session.endedAt || new Date().toISOString(),
            durationSeconds: session.durationSeconds || existingDbSession.durationSeconds,
          },
        })
        .catch(() => null);
      existingDbSession.status = "completed";
    }

    const isTerminated =
      existingDbSession?.status === "terminated_integrity" ||
      session.status === "terminated_integrity";

    // 3. Reconcile answers with server-persisted answers as authoritative source of truth
    const persistedDbAnswers: AnswerRecord[] = (existingDbSession?.answers || []).map((ans) => ({
      questionId: ans.questionId,
      questionText: ans.questionText,
      category: ans.category,
      difficulty: ans.difficulty,
      answerText: ans.answerText,
      submittedAt: ans.submittedAt,
      feedback: {
        score: ans.score,
        strengths: safeJsonParse<string[]>(ans.strengths, []),
        gaps: safeJsonParse<string[]>(ans.gaps, []),
        adaptiveNote: ans.adaptiveNote || "",
      },
    }));

    const answersMap = new Map<string, AnswerRecord>();
    persistedDbAnswers.forEach((a) => answersMap.set(a.questionId, a));
    (session.answers || []).forEach((a) => {
      if (!answersMap.has(a.questionId)) {
        answersMap.set(a.questionId, a);
      }
    });

    const answers = Array.from(answersMap.values());
    const totalAnswers = answers.length;

    // 4. Zero Eligible Answers Protection: Never fabricate reports from zero answers
    if (totalAnswers === 0) {
      return NextResponse.json(
        { error: "Cannot generate evaluation report: No eligible answers recorded for this interview session." },
        { status: 400 }
      );
    }

    const effectiveSetup: any = session.setup || {
      candidateName: existingDbSession?.candidateName || "Candidate",
      targetRole: existingDbSession?.targetRole || "fullstack",
      experienceLevel: existingDbSession?.experienceLevel || "intermediate",
      interviewFocus: existingDbSession?.interviewFocus || "mixed",
      interviewLength: existingDbSession?.interviewLength || 20,
      skills: safeJsonParse<string[]>(existingDbSession?.skills, []),
      resumeFileName: existingDbSession?.resumeFileName || undefined,
      isSampleResume: Boolean(existingDbSession?.isSampleResume),
      userId: existingDbSession?.userId || effectiveUserId,
    };
    const targetSession: InterviewSession = { ...session, setup: effectiveSetup, answers };

    // If deterministic mode forced, use deterministic generator directly
    if (forceDeterministic) {
      const report = generateEvaluationReport(targetSession);
      report.userId = effectiveUserId || effectiveSetup.userId;
      if (auth.user?.name) {
        report.candidateName = auth.user.name;
      }
      if (isTerminated) {
        report.verdict = "Terminated (Integrity Policy)";
        report.integrityStatus = "terminated_integrity";
      }
      report.isDemoSimulation = true;
      const savedReport = await persistReport(report, targetSession, effectiveUserId || effectiveSetup.userId);
      return NextResponse.json({ report: savedReport });
    }

    let averageScore = 0;
    if (totalAnswers > 0) {
      const sum = answers.reduce((acc, curr) => acc + Math.max(16, curr.feedback?.score || 16), 0);
      averageScore = Math.max(18, Math.round(sum / totalAnswers));
    }

    const transcript = answers
      .map(
        (a, idx) =>
          `[Question ${idx + 1}] (${a.category} - ${a.difficulty}): "${a.questionText}"\n[Candidate Answer]: "${a.answerText}"\n[Turn Score]: ${Math.max(16, a.feedback.score || 16)}/100\n[Strengths]: ${a.feedback.strengths.join("; ") || "None"}\n[Gaps]: ${a.feedback.gaps.join("; ") || "None"}`
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
1. Ground competency scores strictly in the candidate's actual answer performance:
   - If answers were incorrect, flawed, or evasive (scores < 50), the competency score MUST be calibrated between 18 and 42 (level 'Needs Focus' or 'Developing'). NEVER assign an absolute 0 or single-digit score to attempted turns.
   - Award realistic baseline credit (18-25%) for candidate participation and basic framing while rigorously documenting gaps under areasToImprove.
   - Do NOT inflate scores beyond 50 for wrong answers.
2. Evaluate 3 to 5 competencies tested in the interview.
3. For each competency, determine the skill status:
   - "demonstrated": sufficient answer evidence supports the skill with clear conceptual or practical execution (score >= 70).
   - "claimed_unvalidated": claimed in resume/skills or attempted, but answer was vague, weak, incorrect, or lacked depth (score 18-50).
   - "not_assessed": skill was not sufficiently tested or questioned in this session.
4. Ground every assessment in VERBATIM candidate quotes:
   - "evidenceQuote" and "quote" MUST be exact word-for-word substrings of the candidate's actual answer text from the transcript.
   - If no verbatim supporting quote exists, return an empty string "" for quote and state why evidence is insufficient.
   - Do NOT fabricate, rephrase, or hallucinate candidate statements.
5. Pinpoint exact mistakes, misconceptions, and shallow explanations in candidate responses under "areasToImprove" (explain specifically what was incorrect or missing in their answers).
6. Outline a prioritized, practical learning and practice roadmap under "actionableRoadmap" (what exact technical concepts, design trade-offs, and tools the candidate should focus on before real company interviews).
7. Generate 2 to 3 targeted "recruiterFollowUps" for human recruiters in round two to probe unvalidated claims or test depth.

Respond ONLY with valid JSON (no markdown formatting, no code fences):
{
  "verdict": "<Strong Hire Recommendation|Hire Recommendation|Additional Review Recommended>",
  "metrics": [
    {
      "category": "<competency name>",
      "score": <18-100 integer>,
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
      console.warn("[🤖 Gemini AI] AI report call failed or timed out. Falling back to calibrated deterministic synthesis:", aiErr);
      const fallbackReport = generateEvaluationReport(targetSession);
      fallbackReport.userId = effectiveUserId || effectiveSetup.userId;
      if (auth.user?.name) {
        fallbackReport.candidateName = auth.user.name;
      }
      if (isTerminated) {
        fallbackReport.verdict = "Terminated (Integrity Policy)";
        fallbackReport.integrityStatus = "terminated_integrity";
      }
      fallbackReport.isDemoSimulation = true;
      const savedReport = await persistReport(fallbackReport, targetSession, effectiveUserId || effectiveSetup.userId);
      return NextResponse.json({ report: savedReport, fallbackUsed: true });
    }

    const validVerdicts = [
      "Strong Hire Recommendation",
      "Hire Recommendation",
      "Additional Review Recommended",
    ] as const;
    let verdict: EvaluationReport["verdict"] = "Hire Recommendation";
    if (averageScore < 68) {
      verdict = "Additional Review Recommended";
    } else if (aiReport.verdict && (validVerdicts as readonly string[]).includes(aiReport.verdict)) {
      verdict = aiReport.verdict as EvaluationReport["verdict"];
    } else if (averageScore >= 85) {
      verdict = "Strong Hire Recommendation";
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

      const rawScore = Math.round(Number(m.score) || 0);
      const calibratedScore = Math.min(100, Math.max(18, rawScore));

      return {
        category: m.category,
        score: calibratedScore,
        level:
          (m.level as SkillMetric["level"]) ||
          (calibratedScore >= 75 ? "Proficient" : calibratedScore >= 50 ? "Developing" : "Needs Focus"),
        totalEvaluated: m.totalEvaluated || 1,
        status,
        confidence: m.confidence || (evidenceQuote ? "high" : "medium"),
        explanation: m.explanation || `Evaluated with score ${calibratedScore}% based on candidate responses.`,
        rubricCriteria: m.rubricCriteria || ["Technical Accuracy", "Implementation Trade-offs"],
        evidenceQuote,
        questionReference: qRef,
      };
    });

    if (metrics.length === 0) {
      metrics.push({
        category: "Core Technical Skills",
        score: Math.max(18, averageScore),
        level: averageScore >= 75 ? "Proficient" : averageScore >= 50 ? "Developing" : "Needs Focus",
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

    const finalVerdict = isTerminated ? "Terminated (Integrity Policy)" : verdict;

    const report: EvaluationReport = {
      sessionId: session.id,
      candidateName: auth.user?.name || session.setup?.candidateName || "Candidate",
      targetRole: ROLE_LABELS[session.setup?.targetRole || "fullstack"] || "Software Engineer",
      experienceLevel: (session.setup?.experienceLevel || "intermediate").charAt(0).toUpperCase() + (session.setup?.experienceLevel || "intermediate").slice(1),
      interviewFocus: (session.setup?.interviewFocus || "mixed").replace("-", " ").toUpperCase(),
      completedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      durationMinutes: Math.max(1, Math.round((session.durationSeconds || 0) / 60)),
      overallScore: Math.max(18, averageScore),
      verdict: finalVerdict,
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
      integrityStatus: isTerminated
        ? "terminated_integrity"
        : (existingDbSession?.violationCount || 0) > 0
        ? "warning_issued"
        : "verified_clean",
    };

    // Persist completed report to SQLite with idempotency
    const targetSessionToPersist: InterviewSession = { ...session, answers };
    const savedDomainReport = await persistReport(report, targetSessionToPersist, effectiveUserId);
    return NextResponse.json({ report: savedDomainReport });
  } catch (err: any) {
    if (err?.message?.includes("Forbidden") || err?.message?.includes("Cannot save report to another candidate")) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[generate-report] Unexpected error in report generation:", err);

    return NextResponse.json(
      { error: err?.message || "Failed to generate and persist interview report." },
      { status: 500 }
    );
  }
}
