import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUser } from "@/lib/resolve-user";
import { persistSession } from "@/lib/report-persistence";
import { prisma } from "@/lib/prisma";
import { InterviewSession } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const auth = await resolveRequestUser(req);
    const body = await req.json();
    const session: InterviewSession = body.session;

    if (!session || !session.id) {
      return NextResponse.json({ error: "Missing session data or ID" }, { status: 400 });
    }

    // Never trust client-supplied userId: use server-resolved user ID when authenticated
    const effectiveUserId = auth.authenticated && auth.user ? auth.user.id : undefined;

    const saved = await persistSession(session, effectiveUserId);
    return NextResponse.json({ success: true, session: saved });
  } catch (err: any) {
    if (err?.message?.includes("Cannot overwrite")) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[api/interview/session] POST Error:", err);
    return NextResponse.json({ error: "Failed to persist interview session" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await resolveRequestUser(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing session ID" }, { status: 400 });
    }

    const session = await prisma.interviewSession.findUnique({
      where: { id },
      include: {
        answers: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Authorization check
    if (session.userId && session.userId !== "guest") {
      const isRecruiter = auth.user?.role === "recruiter";
      if (!isRecruiter && (!auth.user || auth.user.id !== session.userId)) {
        return NextResponse.json({ error: "Forbidden: Cannot access another candidate's session" }, { status: 403 });
      }
    }

    return NextResponse.json({ session });
  } catch (err) {
    console.error("[api/interview/session] GET Error:", err);
    return NextResponse.json({ error: "Failed to retrieve session" }, { status: 500 });
  }
}
