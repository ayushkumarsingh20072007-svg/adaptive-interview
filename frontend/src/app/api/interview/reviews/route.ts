import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUser } from "@/lib/resolve-user";
import { getAllRecruiterReviews } from "@/lib/report-persistence";

export async function GET(req: NextRequest) {
  try {
    const auth = await resolveRequestUser(req);

    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { error: "Unauthorized: Sign in required to access recruiter pipeline reviews" },
        { status: 401 }
      );
    }

    if (auth.user.role !== "recruiter") {
      return NextResponse.json(
        { error: "Forbidden: Only recruiters can access recruiter review records" },
        { status: 403 }
      );
    }

    const reviews = await getAllRecruiterReviews();
    return NextResponse.json({ reviews }, { status: 200 });
  } catch (err: any) {
    console.error("[api/interview/reviews] GET Error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred while retrieving recruiter reviews" },
      { status: 500 }
    );
  }
}
