import { NextRequest, NextResponse } from "next/server";
import { callGemini, parseGeminiJson } from "@/lib/gemini";
import { Question, AnswerRecord, CandidateSetup } from "@/lib/types";
import { resolveRequestUser } from "@/lib/resolve-user";
import { QUESTION_BANK } from "@/lib/mock-data";

export async function POST(req: NextRequest) {
  try {
    void resolveRequestUser(req);
    const body = await req.json();
    const setup: CandidateSetup = body.setup;
    const lastQuestion: Question = body.lastQuestion;
    const lastAnswer: string = body.lastAnswer;
    const lastScore: number = body.lastScore ?? 75;
    const answerHistory: AnswerRecord[] = body.answerHistory || [];
    const questionsAsked: string[] = body.questionsAsked || [];

    if (!setup || !lastQuestion || !lastAnswer) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const historyContext =
      answerHistory.length > 0
        ? `\n\nRecent Performance:\n${answerHistory.slice(-3).map((a) => `- ${a.category}: Score ${a.feedback.score}%`).join("\n")}`
        : "";

    const previousQList =
      questionsAsked.length > 0
        ? `\n\nAlready asked (DO NOT repeat):\n${questionsAsked.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
        : "";

    const prompt = `You are an adaptive technical interviewer. Generate the next question based on candidate performance.

Role: ${setup.targetRole} | Level: ${setup.experienceLevel} | Focus: ${setup.interviewFocus}${historyContext}

Last Question: "${lastQuestion.questionText}"
Last Answer: "${lastAnswer.slice(0, 500)}"
Score: ${lastScore}/100

Strategy:
- Score >= 85: harder/deeper topic
- Score 65-84: follow up on gaps
- Score < 65: simpler foundational concept${previousQList}

Respond ONLY with valid JSON (no markdown, no code fences):
{
  "id": "ai-q-${Date.now()}",
  "role": "${setup.targetRole}",
  "category": "<topic>",
  "difficulty": "<beginner|intermediate|advanced>",
  "questionText": "<the adaptive question>",
  "context": "<brief context or null>",
  "hint": "<subtle hint>",
  "expectedKeywords": ["<kw1>", "<kw2>", "<kw3>"]
}`;

    try {
      console.log(`[🤖 Gemini AI] Generating adaptive follow-up (previous score: ${lastScore}/100)...`);
      const raw = await callGemini(prompt);
      const question = parseGeminiJson<Question>(raw);
      console.log(`[🤖 Gemini AI] Adaptive question ready: "${question.questionText.slice(0, 90)}..."`);
      return NextResponse.json({ question });
    } catch (aiErr) {
      console.warn("[🤖 Gemini AI] Adaptive question AI call failed (quota/rate-limit/network). Using calibrated fallback question:", aiErr);
      const roleBank = QUESTION_BANK[setup.targetRole] || QUESTION_BANK.fullstack;
      const unusedQuestion = roleBank.find((q) => !questionsAsked.includes(q.questionText) && q.id !== lastQuestion.id) || roleBank[0];
      const fallbackQuestion: Question = {
        ...unusedQuestion,
        id: `fb-q-${Date.now()}`,
        difficulty: lastScore >= 85 ? "advanced" : lastScore < 65 ? "beginner" : "intermediate",
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
