import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUser } from "@/lib/resolve-user";
import { getReportById, getRecruiterReview } from "@/lib/report-persistence";
import { ALL_DEMO_REPORTS, SAMPLE_REPORT } from "@/lib/mock-data";

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const auth = await resolveRequestUser(req);
    const isRecruiter = auth.user?.role === "recruiter";

    if (!id) {
      return NextResponse.json({ error: "Missing report/session ID" }, { status: 400 });
    }

    // 1. Check demo benchmarks first
    if (id === "demo-session" || id.startsWith("demo-session-")) {
      const demo = ALL_DEMO_REPORTS.find(
        (r) => r.sessionId === id || (id === "demo-session" && r.sessionId === "demo-session-alex")
      );
      const baseDemo = demo ? { ...demo } : { ...SAMPLE_REPORT };

      // Enforce candidate ownership on demo reports if tied to a specific candidate
      if (baseDemo.userId && baseDemo.userId !== "guest" && !isRecruiter) {
        if (auth.authenticated && auth.user && auth.user.id !== baseDemo.userId) {
          return NextResponse.json(
            { error: "Forbidden: You are not authorized to view this candidate's report" },
            { status: 403 }
          );
        }
      }

      // Check if recruiter saved review in SQLite for this demo session
      const dbReview = await getRecruiterReview(id);
      if (dbReview) {
        baseDemo.shortlistStatus = dbReview.status;
        baseDemo.shortlistNotes = isRecruiter ? dbReview.notes : undefined;
      } else if (!isRecruiter) {
        baseDemo.shortlistNotes = undefined;
      }

      return NextResponse.json({ report: baseDemo });
    }

    // 2. Query SQLite for persisted report
    const { report, status } = await getReportById(id, auth.user);

    // Explicitly check 403 Forbidden before checking for missing report
    if (status === 403) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to view this candidate's report" },
        { status: 403 }
      );
    }

    if (status === 404 || !report) {
      return NextResponse.json({ error: "Evaluation report not found" }, { status: 404 });
    }

    return NextResponse.json({ report });
  } catch (err) {
    console.error("[api/interview/report/[id]] Error:", err);
    return NextResponse.json({ error: "Failed to retrieve evaluation report" }, { status: 500 });
  }
}
