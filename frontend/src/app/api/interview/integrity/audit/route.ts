import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUser } from "@/lib/resolve-user";
import { getIntegrityAudit } from "@/lib/report-persistence";

export async function GET(req: NextRequest) {
  try {
    const auth = await resolveRequestUser(req);
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId parameter" },
        { status: 400 }
      );
    }

    const audit = await getIntegrityAudit(sessionId);
    if (!audit) {
      return NextResponse.json(
        { error: "Session or audit record not found" },
        { status: 404 }
      );
    }

    const isRecruiter = auth.user?.role === "recruiter";

    // Data-isolation check: candidate can only view their own audit
    if (audit.userId && audit.userId !== "guest" && !isRecruiter) {
      if (!auth.authenticated || !auth.user || auth.user.id !== audit.userId) {
        return NextResponse.json(
          { error: "Forbidden: Cannot access another candidate's integrity audit" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ success: true, audit }, { status: 200 });
  } catch (err: any) {
    console.error("[api/interview/integrity/audit] Error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve integrity audit" },
      { status: 500 }
    );
  }
}
