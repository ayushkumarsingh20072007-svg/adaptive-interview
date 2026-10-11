import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUser } from "@/lib/resolve-user";
import { getAllPersistedReports, getAllRecruiterReviews } from "@/lib/report-persistence";
import { ALL_DEMO_REPORTS } from "@/lib/mock-data";

export async function GET(req: NextRequest) {
  try {
    const auth = await resolveRequestUser(req);
    const userRole = auth.user?.role;
    const isRecruiter = userRole === "recruiter";

    // Retrieve SQLite persisted reports (notes already filtered based on isRecruiter)
    const persistedReports = await getAllPersistedReports(auth.user);

    // Merge with demo reports according to existing role conventions:
    // Recruiters see demo candidates along with live persisted candidates
    // Candidates see their own demo report if they are a demo persona
    const reportsMap = new Map<string, any>();

    if (isRecruiter) {
      ALL_DEMO_REPORTS.forEach((demo) => {
        reportsMap.set(demo.sessionId, { ...demo });
      });
    } else if (auth.user?.id) {
      const matchingDemo = ALL_DEMO_REPORTS.find((d) => d.userId === auth.user?.id);
      if (matchingDemo) {
        // Strip private recruiter notes if candidate
        const safeDemo = { ...matchingDemo, shortlistNotes: undefined };
        reportsMap.set(safeDemo.sessionId, safeDemo);
      }
    }

    // Overlay persisted reports from SQLite
    persistedReports.forEach((rep) => {
      reportsMap.set(rep.sessionId, rep);
    });

    // If recruiter, overlay persisted reviews from SQLite (including on demo records)
    if (isRecruiter) {
      const allReviews = await getAllRecruiterReviews();
      allReviews.forEach((rev) => {
        const existing = reportsMap.get(rev.sessionId);
        if (existing) {
          existing.shortlistStatus = rev.status;
          existing.shortlistNotes = rev.notes;
        }
      });
    }

    const reports = Array.from(reportsMap.values());
    return NextResponse.json({ reports });
  } catch (err) {
    console.error("[api/interview/reports] Error:", err);
    return NextResponse.json({ error: "Failed to retrieve reports" }, { status: 500 });
  }
}
