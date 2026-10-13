import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUser } from "@/lib/resolve-user";
import { recordIntegrityViolation } from "@/lib/report-persistence";

export async function POST(req: NextRequest) {
  try {
    const auth = await resolveRequestUser(req);
    const body = await req.json().catch(() => ({}));
    const {
      sessionId,
      eventType = "focus_loss",
      idempotencyKey,
      stageQuestionId,
      stageQuestionIndex,
      clientTimestamp,
      policyVersion = "v1.0",
    } = body as {
      sessionId?: string;
      eventType?: string;
      idempotencyKey?: string;
      stageQuestionId?: string;
      stageQuestionIndex?: number;
      clientTimestamp?: string;
      policyVersion?: string;
    };

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid sessionId parameter" },
        { status: 400 }
      );
    }

    // Guard: Prevent client from attempting to forge authoritative violation count
    if ("violationCount" in body || "actionTaken" in body || "status" in body) {
      // Ignore or reject client attempts to set authoritative counters
      console.warn(`[api/interview/integrity/event] Ignored client-supplied counter/status fields for session ${sessionId}`);
    }

    // Never trust client-supplied userId: derive strictly from authenticated server session
    const effectiveUserId = auth.authenticated && auth.user ? auth.user.id : undefined;

    const result = await recordIntegrityViolation({
      sessionId,
      userId: effectiveUserId,
      eventType,
      idempotencyKey,
      stageQuestionId,
      stageQuestionIndex,
      clientTimestamp,
      policyVersion,
    });

    const isDuplicate = Boolean(result.idempotent);
    const action = result.actionTaken === "interview_terminated" ? "terminated" : "warning";

    return NextResponse.json(
      {
        success: true,
        accepted: !isDuplicate,
        duplicate: isDuplicate,
        sessionId,
        violationCount: result.violationCount,
        action,
        actionTaken: result.actionTaken,
        status: result.status,
        idempotent: result.idempotent,
        eventId: result.event?.id,
        serverTimestamp: result.event?.serverTimestamp?.toISOString() || new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (err: any) {
    if (err?.requiresPolicyAcknowledgement || err?.message?.includes("Integrity policy must be acknowledged")) {
      return NextResponse.json(
        {
          error: "Integrity policy must be acknowledged before recording monitoring events",
          requiresPolicyAcknowledgement: true,
        },
        { status: 400 }
      );
    }
    if (err?.terminated || err?.message?.includes("already terminated")) {
      return NextResponse.json(
        {
          error: "Interview session is already terminated by integrity policy",
          accepted: false,
          terminated: true,
          violationCount: 2,
        },
        { status: 400 }
      );
    }
    if (err?.statusCode === 400 || err?.message?.includes("no longer active")) {
      return NextResponse.json(
        { error: err.message },
        { status: 400 }
      );
    }
    if (err?.message?.includes("Unauthorized session access")) {
      return NextResponse.json(
        { error: "Forbidden: Cannot record integrity events for another candidate's session" },
        { status: 403 }
      );
    }
    if (err?.message?.includes("Interview session not found")) {
      return NextResponse.json(
        { error: "Interview session not found" },
        { status: 404 }
      );
    }
    console.error("[api/interview/integrity/event] Error:", err);
    return NextResponse.json(
      { error: "Failed to process interview integrity event" },
      { status: 500 }
    );
  }
}
