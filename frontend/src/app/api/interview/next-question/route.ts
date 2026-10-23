import { NextRequest, NextResponse } from "next/server";
import { callGemini, parseGeminiJson } from "@/lib/gemini";
import { Question, AnswerRecord, CandidateSetup, AnswerFeedback } from "@/lib/types";
import { resolveRequestUser } from "@/lib/resolve-user";
import { QUESTION_BANK } from "@/lib/mock-data";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const auth = await resolveRequestUser(req);
    const body = await req.json();
    const sessionId: string | undefined = body.sessionId;
    const setup: CandidateSetup = body.setup;
    const lastQuestion: Question = body.lastQuestion;
    const lastAnswer: string = body.lastAnswer || "";
    const lastScore: number = body.lastScore ?? 75;
    const lastFeedback: Partial<AnswerFeedback> | undefined = body.lastFeedback;
    const answerHistory: AnswerRecord[] = Array.isArray(body.answerHistory) ? body.answerHistory : [];
    const questionsAsked: string[] = Array.isArray(body.questionsAsked) ? body.questionsAsked : [];

    // 1. Authoritative session validation & ownership check
    if (sessionId) {
      const session = await prisma.interviewSession
        .findUnique({
          where: { id: sessionId },
          include: { answers: true },
        })
        .catch(() => null);
      if (session) {
        if (session.userId && auth.authenticated && auth.user && auth.user.id !== session.userId) {
          return NextResponse.json(
            { error: "Forbidden: Cannot request questions for another candidate's session" },
            { status: 403 }
          );
        }
        if (session.status === "terminated_integrity") {
          return NextResponse.json(
            { error: "Forbidden: Cannot generate questions for a terminated interview session" },
            { status: 403 }
          );
        }
        if (session.status === "completed") {
          return NextResponse.json(
            { error: "Forbidden: Cannot generate questions for an already completed interview session" },
            { status: 403 }
          );
        }
        // Incorporate existing answers into questionsAsked list
        for (const ans of session.answers) {
          if (ans.questionText && !questionsAsked.includes(ans.questionText)) {
            questionsAsked.push(ans.questionText);
          }
        }
      }
    }

    if (!setup || !lastQuestion || typeof lastAnswer !== "string") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Include lastQuestion in questionsAsked to ensure it is never repeated
    if (!questionsAsked.includes(lastQuestion.questionText)) {
      questionsAsked.push(lastQuestion.questionText);
    }

    // 2. Build performance context
    const recentHistory = answerHistory.slice(-3);
    const historyContext =
      recentHistory.length > 0
        ? `\nRecent Turn History:\n${recentHistory
            .map(
              (a) =>
                `- ${a.category}: Score ${a.feedback.score}%. Strengths: [${(a.feedback.strengths || []).join(", ")}]. Gaps: [${(a.feedback.gaps || []).join(", ")}]`
            )
            .join("\n")}`
        : "";

    const previousQList =
      questionsAsked.length > 0
        ? `\n\nQuestions Already Asked in This Session (DO NOT REPEAT OR CLOSELY DUPLICATE ANY OF THESE):\n${questionsAsked
            .map((q, i) => `${i + 1}. ${q}`)
            .join("\n")}`
        : "";

    const missingGaps = lastFeedback?.missingConcepts?.length
      ? `Identified Gaps/Missing Concepts: ${lastFeedback.missingConcepts.join(", ")}`
      : lastFeedback?.gaps?.length
      ? `Gaps Noted: ${lastFeedback.gaps.join(", ")}`
      : "";

    const isCandidateBeginner = setup.experienceLevel === "beginner";
    const isCandidateAdvanced = setup.experienceLevel === "advanced";

    let adaptiveBranchingInstructions = "";
    let calculatedDifficulty: "beginner" | "intermediate" | "advanced" = "intermediate";

    if (isCandidateBeginner) {
      calculatedDifficulty = "beginner";
      adaptiveBranchingInstructions = `ADAPTIVE BRANCHING STRATEGY (CALIBRATED FOR BEGINNER):
1. If Score >= 80: The candidate demonstrated good foundational understanding. Keep the follow-up strictly at BEGINNER level: probe a related practical aspect, simple input validation, basic error handling (try/catch), or common syntax usage. NEVER advance a beginner to distributed systems, microservices, concurrency locks, or complex system architecture!
2. If Score 50 - 79: The candidate showed partial understanding. Ask a clarifying beginner question on the missed basic concept or ask for a simple concrete code/logic example.
3. If Score < 50: The candidate struggled with this topic. Pivot to a simpler fundamental building block or common terminology.
4. STRICT FORBIDDEN FOR BEGINNER: No microservices, no distributed consensus, no cache stampedes, no Kafka/RabbitMQ dead-letter queues, no multi-region replication lag, no deep heap dumps. Keep it junior/entry-level.`;
    } else if (isCandidateAdvanced) {
      calculatedDifficulty = lastScore >= 80 ? "advanced" : "intermediate";
      adaptiveBranchingInstructions = `ADAPTIVE BRANCHING STRATEGY (CALIBRATED FOR ADVANCED):
1. If Score >= 80: The candidate demonstrated strong competence. Advance difficulty into edge cases, performance bottlenecks, high concurrency, failure modes, or distributed architectural trade-offs.
2. If Score 50 - 79: The candidate missed key nuances. Generate a focused, probing follow-up targeting the specific architectural trade-off or failure mode.
3. If Score < 50: Pivot to core fundamental architectural mechanics of this domain.`;
    } else {
      // Intermediate
      calculatedDifficulty = lastScore < 50 ? "beginner" : "intermediate";
      adaptiveBranchingInstructions = `ADAPTIVE BRANCHING STRATEGY (CALIBRATED FOR INTERMEDIATE):
1. If Score >= 80: The candidate showed solid understanding. Probe a realistic production edge case, performance optimization, or API design consideration within mid-level scope.
2. If Score 50 - 79: Target the specific missing concept or operational trade-off.
3. If Score < 50: Pivot back to foundational conceptual building blocks.`;
    }

    // 3. Prompt Construction with Adaptive Strategy
    const prompt = `You are an expert adaptive technical interviewer conducting an ongoing interview.
Role: ${setup.targetRole} | Seniority: ${setup.experienceLevel} | Track: ${setup.interviewFocus}
${historyContext}

Previous Question: "${lastQuestion.questionText}"
Previous Category: ${lastQuestion.category}
Candidate Answer: "${lastAnswer.slice(0, 1000)}"
Evaluated Score: ${lastScore}/100
${missingGaps}

${adaptiveBranchingInstructions}
5. DO NOT repeat, rephrase, or duplicate any previously asked question.
6. DO NOT provide the solution, hint heavily, or make the question leading.

Respond ONLY with valid JSON (no markdown fences, no surrounding text):
{
  "id": "ai-q-${Date.now()}",
  "role": "${setup.targetRole}",
  "category": "<target category>",
  "difficulty": "${calculatedDifficulty}",
  "questionText": "<the adaptive follow-up question>",
  "context": "<1-2 sentence real-world scenario appropriate for ${setup.experienceLevel} level>",
  "hint": "<subtle guiding hint>",
  "expectedKeywords": ["<concept1>", "<concept2>", "<concept3>"]
}
${previousQList}`;

    try {
      console.log(
        `[🤖 Gemini AI] Generating adaptive follow-up (previous score: ${lastScore}/100 on ${lastQuestion.category}, seniority: ${setup.experienceLevel})...`
      );
      const raw = await callGemini(prompt);
      const question = parseGeminiJson<Question>(raw);

      // Validate structure
      if (
        !question ||
        typeof question.questionText !== "string" ||
        question.questionText.trim().length < 15 ||
        !Array.isArray(question.expectedKeywords)
      ) {
        throw new Error("AI returned incomplete or malformed adaptive question");
      }

      // Check deduplication against questionsAsked
      const isDuplicate = questionsAsked.some(
        (asked) =>
          asked.toLowerCase().trim() === question.questionText.toLowerCase().trim() ||
          (asked.length > 30 && question.questionText.toLowerCase().includes(asked.toLowerCase().slice(0, 30)))
      );

      if (isDuplicate) {
        console.warn("[🤖 Gemini AI] Model suggested previously asked question; falling back to bank.");
        throw new Error("Model generated duplicate question");
      }

      // Enforce calculated difficulty
      question.difficulty = calculatedDifficulty;

      console.log(`[🤖 Gemini AI] Adaptive question ready: "${question.questionText.slice(0, 90)}..." (difficulty: ${question.difficulty})`);
      return NextResponse.json({ question, fallbackUsed: false });
    } catch (aiErr) {
      console.warn(
        "[🤖 Gemini AI] Adaptive question AI call failed (quota/rate-limit/network/duplicate). Using calibrated fallback question:",
        aiErr
      );
      const roleBank = QUESTION_BANK[setup.targetRole] || QUESTION_BANK.fullstack;
      const targetLevel = setup.experienceLevel || "intermediate";

      // Prefer unused questions matching candidate's level
      const levelMatches = roleBank.filter((q) => q.difficulty === targetLevel);
      const unusedQuestion =
        levelMatches.find(
          (q) => !questionsAsked.includes(q.questionText) && q.id !== lastQuestion.id
        ) ||
        levelMatches[0] ||
        roleBank.find(
          (q) => !questionsAsked.includes(q.questionText) && q.id !== lastQuestion.id
        ) ||
        roleBank[0];

      const fallbackQuestion: Question = {
        ...unusedQuestion,
        id: `fb-q-${Date.now()}`,
        difficulty: unusedQuestion.difficulty,
      };
      return NextResponse.json({ question: fallbackQuestion, fallbackUsed: true });
    }
  } catch (err) {
    console.error("[next-question] Internal Route Error:", err);
    return NextResponse.json(
      { error: "Failed to generate next question." },
      { status: 500 }
    );
  }
}
