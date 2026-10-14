import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUser } from "@/lib/resolve-user";
import { persistAnswer } from "@/lib/report-persistence";
import { AnswerRecord } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const auth = await resolveRequestUser(req);
    const body = await req.json();
    const { sessionId, answer } = body as { sessionId: string; answer: AnswerRecord };

    if (!sessionId || !answer || !answer.questionId || !answer.answerText || !answer.answerText.trim()) {
      return NextResponse.json({ error: "Missing required answer or session parameters" }, { status: 400 });
    }

    if (answer.answerText.trim().length < 15) {
      return NextResponse.json({ error: "Substantive answer required (at least 15 characters)" }, { status: 400 });
    }

    const effectiveUserId = auth.authenticated && auth.user ? auth.user.id : undefined;

    const savedAnswer = await persistAnswer(sessionId, answer, effectiveUserId);
    return NextResponse.json({ success: true, answer: savedAnswer });
  } catch (err: any) {
    if (err?.message?.includes("Unauthorized session access")) {
      return NextResponse.json({ error: "Forbidden: Cannot submit answers to another candidate's session" }, { status: 403 });
    }
    if (err?.message?.includes("terminated interview session")) {
      return NextResponse.json({ error: "Forbidden: Cannot submit answers to a terminated interview session" }, { status: 403 });
    }
    if (err?.message?.includes("already completed")) {
      return NextResponse.json({ error: "Forbidden: Cannot submit answers to an already completed interview session" }, { status: 403 });
    }
    console.error("[api/interview/answer] Error:", err);
    return NextResponse.json({ error: "Failed to persist answer record" }, { status: 500 });
  }
}
