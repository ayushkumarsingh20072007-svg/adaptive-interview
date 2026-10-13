import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUser } from "@/lib/resolve-user";
import { acknowledgeIntegrityPolicy } from "@/lib/report-persistence";

export async function POST(req: NextRequest) {
  try {
    const auth = await resolveRequestUser(req);
    const body = await req.json().catch(() => ({}));
    const { sessionId, policyVersion = "v1.0" } = body as {
      sessionId?: string;
      policyVersion?: string;
    };

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid sessionId parameter" },
        { status: 400 }
      );
    }

    const effectiveUserId = auth.authenticated && auth.user ? auth.user.id : undefined;

    const session = await acknowledgeIntegrityPolicy(sessionId, effectiveUserId, policyVersion);

    return NextResponse.json(
      {
        success: true,
        acknowledged: true,
        sessionId: session.id,
        policyVersion: session.integrityPolicyVersion,
        acknowledgedAt: session.integrityPolicyAcknowledgedAt,
      },
      { status: 200 }
    );
  } catch (err: any) {
    if (err?.message?.includes("Unauthorized session access")) {
      return NextResponse.json(
        { error: "Forbidden: Cannot acknowledge policy for another candidate's session" },
        { status: 403 }
      );
    }
    if (err?.message?.includes("terminated interview session")) {
      return NextResponse.json(
        { error: "Forbidden: Cannot acknowledge policy for a terminated session" },
        { status: 403 }
      );
    }
    console.error("[api/interview/integrity/ack-policy] Error:", err);
    return NextResponse.json(
      { error: "Failed to record integrity policy acknowledgement" },
      { status: 500 }
    );
  }
}
