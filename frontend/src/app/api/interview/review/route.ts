import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUser } from "@/lib/resolve-user";
import {
  persistRecruiterReview,
  getRecruiterReview,
} from "@/lib/report-persistence";
import { ShortlistStatus } from "@/lib/types";

const VALID_STATUSES: ShortlistStatus[] = [
  "pending",
  "shortlisted",
  "under-review",
  "rejected",
];

export async function POST(req: NextRequest) {
  try {
    const auth = await resolveRequestUser(req);

    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { error: "Unauthorized: Sign in required to submit recruiter reviews" },
        { status: 401 }
      );
    }

    if (auth.user.role !== "recruiter") {
      return NextResponse.json(
        { error: "Forbidden: Only recruiters are authorized to submit shortlist decisions or notes" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { sessionId, candidateName, status, notes } = body;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "Invalid request: Missing or invalid sessionId parameter" },
        { status: 400 }
      );
    }

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status '${status}'. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    // Always derive reviewer identity and role from the authenticated server session
    const reviewerId = auth.user.id;
    const reviewedBy = auth.user.name || "Sarah Jenkins (Head of Talent)";

    const review = await persistRecruiterReview({
      sessionId,
      candidateName,
      status,
      notes,
      reviewerId,
      reviewedBy,
    });

    return NextResponse.json({ success: true, review }, { status: 200 });
  } catch (err: any) {
    console.error("[api/interview/review] POST Error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred while saving recruiter review" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await resolveRequestUser(req);

    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { error: "Unauthorized: Sign in required to access recruiter reviews" },
        { status: 401 }
      );
    }

    if (auth.user.role !== "recruiter") {
      return NextResponse.json(
        { error: "Forbidden: Only recruiters can access internal review decisions" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId parameter" },
        { status: 400 }
      );
    }

    const review = await getRecruiterReview(sessionId);
    return NextResponse.json({ review }, { status: 200 });
  } catch (err: any) {
    console.error("[api/interview/review] GET Error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred while retrieving recruiter review" },
      { status: 500 }
    );
  }
}
