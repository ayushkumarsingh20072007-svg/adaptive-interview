import { NextRequest, NextResponse } from "next/server";
import { callGemini, parseGeminiJson } from "@/lib/gemini";
import { CandidateSetup, Question } from "@/lib/types";
import { resolveRequestUser } from "@/lib/resolve-user";

export async function POST(req: NextRequest) {
  try {
    void resolveRequestUser(req);
    const body = await req.json();
    const setup: CandidateSetup = body.setup;
    const previousQuestions: string[] = body.previousQuestions || [];
    const resumeText: string = body.resumeText || "";

    if (!setup) {
      return NextResponse.json({ error: "Missing candidate setup" }, { status: 400 });
    }

    const previousQList =
      previousQuestions.length > 0
        ? `\n\nAlready asked (do NOT repeat):\n${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
        : "";

    const resumeContext = resumeText
      ? `\n\nCandidate's Resume / Skills:\n${resumeText.slice(0, 1500)}`
      : "";

    const prompt = `You are an expert technical interviewer conducting a live ${setup.interviewFocus.replace("-", " ")} interview for a ${setup.targetRole} role.
Experience level: ${setup.experienceLevel}.
Candidate name: ${setup.candidateName || "the candidate"}.
Skills to probe: ${setup.skills.join(", ") || "general software engineering"}.${resumeContext}

Generate ONE highly specific, probing technical interview question.
Requirements:
- Directly relevant to the ${setup.targetRole} role and ${setup.interviewFocus} focus.
- Match difficulty to ${setup.experienceLevel} level.
- Open-ended, requiring architectural thinking or trade-offs.
- No trivial, multiple-choice, or yes/no questions.${previousQList}

Respond ONLY with valid JSON (no markdown, no code fences):
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

    console.log(`[🤖 Gemini AI] Generating question for ${setup.candidateName} (${setup.targetRole} - ${setup.experienceLevel})...`);
    const raw = await callGemini(prompt);
    const question = parseGeminiJson<Question>(raw);
    console.log(`[🤖 Gemini AI] Question generated: "${question.questionText.slice(0, 90)}..."`);

    return NextResponse.json({ question });
  } catch (err) {
    console.error("[generate-question] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate question. Please try again." },
      { status: 500 }
    );
  }
}
