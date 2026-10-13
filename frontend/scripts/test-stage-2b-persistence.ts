/**
 * Stage 2B Persistence & Data Consistency Verification Test Suite
 * 
 * Verifies:
 * 1. An interview session and its answers survive a refresh / fresh API read.
 * 2. Repeated answer submissions do not create unintended duplicates (idempotent deduplication).
 * 3. Completing an interview persists its final status and endedAt timestamp.
 * 4. A report cannot be generated from zero eligible answers (rejected with 400).
 * 5. A report is based on server-persisted answers.
 * 6. Repeated report-generation requests do not create uncontrolled duplicates (idempotency policy).
 * 7. Candidate A cannot access Candidate B's interview or report (403 Forbidden).
 * 8. A candidate cannot access recruiter-only private notes.
 * 9. An unauthorized user cannot update shortlist status (401/403).
 * 10. An authorized recruiter can persist and retrieve a review and shortlist decision in SQLite.
 * 11. Demo mode does not overwrite real candidate data.
 */

import { prisma } from "../src/lib/prisma.ts";

const BASE_URL = "http://localhost:3000";

async function runStage2BPersistenceTests() {
  console.log("======================================================================");
  console.log("💾 STARTING STAGE 2B PERSISTENCE & DATA CONSISTENCY TEST SUITE");
  console.log("======================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`✅ PASS | [${total}] ${msg}`);
      passed++;
    } else {
      console.error(`❌ FAIL | [${total}] ${msg}`);
      process.exitCode = 1;
    }
  }

  // Helper: Get Session Cookie for user
  async function getSessionCookie(email: string, password = "Password123"): Promise<string> {
    let res = await fetch(`${BASE_URL}/api/auth/demo-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    }

    const cookieHeader = res.headers.get("set-cookie") || "";
    const match = cookieHeader.match(/interviewiq_session=([^;]+)/);
    return match ? match[0] : "";
  }

  const alexCookie = await getSessionCookie("alex.rivera@example.com");
  const mayaCookie = await getSessionCookie("maya.patel@example.com");
  const recruiterCookie = await getSessionCookie("recruiter@interviewiq.ai");

  assert(Boolean(alexCookie), "Obtained authenticated session cookie for Candidate Alex Rivera");
  assert(Boolean(mayaCookie), "Obtained authenticated session cookie for Candidate Maya Patel");
  assert(Boolean(recruiterCookie), "Obtained authenticated session cookie for Recruiter Sarah Jenkins");

  // Fetch Alex's user ID from DB
  const alexUser = await prisma.user.findUnique({ where: { email: "alex.rivera@example.com" } });
  const mayaUser = await prisma.user.findUnique({ where: { email: "maya.patel@example.com" } });

  const testSessionId = `test-sess-${Date.now()}`;
  const emptySessionId = `test-empty-${Date.now()}`;

  try {
    // --- GROUP 1: Interview Session Creation & Refresh Survival ---
    console.log("\n--- GROUP 1: Interview Session & Answers Persistence Across Refreshes ---");

    const sessionPayload = {
      id: testSessionId,
      setup: {
        candidateName: "Alex Rivera",
        targetRole: "fullstack",
        experienceLevel: "senior",
        interviewFocus: "mixed",
        interviewLength: 20,
        skills: ["React", "Node.js", "PostgreSQL"],
        resumeFileName: "alex_resume.pdf",
        isSampleResume: false,
      },
      status: "in-progress",
      durationSeconds: 120,
      answers: [],
      currentQuestionIndex: 0,
    };

    const createRes = await fetch(`${BASE_URL}/api/interview/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: alexCookie },
      body: JSON.stringify({ session: sessionPayload }),
    });

    assert(createRes.status === 200, `Candidate session created via API (status: ${createRes.status})`);

    // Submit Answer 1
    const ans1 = {
      questionId: "q-101",
      questionText: "How do you handle database connection pooling in high-concurrency Node.js services?",
      category: "Backend Architecture",
      difficulty: "senior",
      answerText: "We configure a bounded connection pool with pg-pool, manage idle connection timeouts, and implement health check pinging before querying.",
      submittedAt: new Date().toISOString(),
      feedback: {
        score: 88,
        strengths: ["Proper connection pool management", "Idle timeout configuration"],
        gaps: [],
        adaptiveNote: "Advancing to distributed caching.",
      },
    };

    const ans1Res = await fetch(`${BASE_URL}/api/interview/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: alexCookie },
      body: JSON.stringify({ sessionId: testSessionId, answer: ans1 }),
    });
    assert(ans1Res.status === 200, `Answer 1 submitted successfully (status: ${ans1Res.status})`);

    // Submit Answer 2
    const ans2 = {
      questionId: "q-102",
      questionText: "Describe your strategy for cache invalidation across distributed instances.",
      category: "System Design",
      difficulty: "senior",
      answerText: "We employ write-through caching with Redis, utilize TTLs as a fail-safe, and broadcast pub/sub cache purge events.",
      submittedAt: new Date().toISOString(),
      feedback: {
        score: 90,
        strengths: ["Pub/Sub invalidation", "TTL safety margin"],
        gaps: [],
        adaptiveNote: "Candidate demonstrates strong caching fundamentals.",
      },
    };

    const ans2Res = await fetch(`${BASE_URL}/api/interview/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: alexCookie },
      body: JSON.stringify({ sessionId: testSessionId, answer: ans2 }),
    });
    assert(ans2Res.status === 200, `Answer 2 submitted successfully (status: ${ans2Res.status})`);

    // Fresh API Read / Simulated Page Refresh
    const refreshRes = await fetch(`${BASE_URL}/api/interview/session?id=${testSessionId}`, {
      headers: { Cookie: alexCookie },
    });
    const refreshData = await refreshRes.json();

    assert(refreshRes.status === 200, `Fresh session read succeeded (simulated page refresh)`);
    assert(refreshData.session?.answers?.length === 2, `Both answers survive fresh read (count: ${refreshData.session?.answers?.length})`);
    assert(refreshData.session?.answers[0]?.questionId === "q-101", `Answer 1 questionId matches persisted record`);
    assert(refreshData.session?.answers[1]?.score === 90, `Answer 2 score persists accurately`);

    // --- GROUP 2: Answer Deduplication on Retried Submissions ---
    console.log("\n--- GROUP 2: Answer Deduplication & Retried Submissions ---");

    // Re-submit Answer 1 with revised score / text (e.g. network retry)
    const retriedAns1 = {
      ...ans1,
      answerText: "Updated: We configure a bounded connection pool with pg-pool, manage idle connection timeouts, and implement health check pinging before querying.",
      feedback: {
        ...ans1.feedback,
        score: 92,
      },
    };

    const retryRes = await fetch(`${BASE_URL}/api/interview/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: alexCookie },
      body: JSON.stringify({ sessionId: testSessionId, answer: retriedAns1 }),
    });
    assert(retryRes.status === 200, `Retried answer submission succeeds`);

    // Verify deduplication: answer count must still be 2, not 3
    const dedupCheckRes = await fetch(`${BASE_URL}/api/interview/session?id=${testSessionId}`, {
      headers: { Cookie: alexCookie },
    });
    const dedupData = await dedupCheckRes.json();
    assert(dedupData.session?.answers?.length === 2, `Retried submission updated existing turn; no duplicate answer created (count: 2)`);
    assert(dedupData.session?.answers?.find((a: any) => a.questionId === "q-101")?.score === 92, `Existing answer turn successfully updated`);

    // --- GROUP 3: Completing an Interview & Final Status Invariants ---
    console.log("\n--- GROUP 3: Interview Completion & Terminal Invariants ---");

    const completedSessionPayload = {
      ...sessionPayload,
      status: "completed",
      endedAt: new Date().toISOString(),
      durationSeconds: 300,
    };

    const completeRes = await fetch(`${BASE_URL}/api/interview/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: alexCookie },
      body: JSON.stringify({ session: completedSessionPayload }),
    });
    assert(completeRes.status === 200, `Completing interview persists via session API`);

    const verifiedComplete = await prisma.interviewSession.findUnique({
      where: { id: testSessionId },
    });
    assert(verifiedComplete?.status === "completed", `SQLite record status is 'completed'`);
    assert(Boolean(verifiedComplete?.endedAt), `SQLite record has non-null completion timestamp (endedAt: ${verifiedComplete?.endedAt})`);

    // Attempt to submit an answer to a completed session -> must be rejected with 403
    const lateAnswerRes = await fetch(`${BASE_URL}/api/interview/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: alexCookie },
      body: JSON.stringify({
        sessionId: testSessionId,
        answer: {
          questionId: "q-103",
          questionText: "Late question",
          category: "Security",
          difficulty: "senior",
          answerText: "Late answer text that should be rejected because session is completed.",
          submittedAt: new Date().toISOString(),
          feedback: { score: 50, strengths: [], gaps: [] },
        },
      }),
    });
    assert(lateAnswerRes.status === 403, `Submitting answers to completed session is rejected with 403 Forbidden (got ${lateAnswerRes.status})`);

    // --- GROUP 4: Report Generation & Zero-Answer Protection ---
    console.log("\n--- GROUP 4: Report Generation & Zero-Answer Guard ---");

    // Create session with zero answers
    await fetch(`${BASE_URL}/api/interview/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: alexCookie },
      body: JSON.stringify({
        session: {
          id: emptySessionId,
          setup: sessionPayload.setup,
          status: "in-progress",
          answers: [],
        },
      }),
    });

    // Attempting to generate a report with 0 answers -> must return 400 Bad Request
    const zeroAnsReportRes = await fetch(`${BASE_URL}/api/interview/generate-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: alexCookie },
      body: JSON.stringify({
        session: { id: emptySessionId, answers: [] },
        forceDeterministic: true,
      }),
    });
    assert(zeroAnsReportRes.status === 400, `Report generation rejected with 400 when session has zero eligible answers (got ${zeroAnsReportRes.status})`);

    // Generate report for session with real answers
    const reportGenRes = await fetch(`${BASE_URL}/api/interview/generate-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: alexCookie },
      body: JSON.stringify({
        session: { id: testSessionId, answers: [] }, // Client sends empty answers to verify server loads from SQLite
        forceDeterministic: true,
      }),
    });
    assert(reportGenRes.status === 200, `Report generated successfully based on server-persisted answers (got ${reportGenRes.status})`);
    const reportData = await reportGenRes.json();
    assert(reportData.report?.answerRecords?.length === 2, `Generated report includes both server-persisted answers`);
    assert(reportData.report?.overallScore >= 80, `Generated report reflects accurate answers score (overallScore: ${reportData.report?.overallScore})`);

    // Idempotency: Repeated report generation returns existing report
    const reportIdempotencyRes = await fetch(`${BASE_URL}/api/interview/generate-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: alexCookie },
      body: JSON.stringify({
        session: { id: testSessionId },
        forceDeterministic: true,
      }),
    });
    const idempData = await reportIdempotencyRes.json();
    assert(reportIdempotencyRes.status === 200, `Repeated report generation request returns 200 OK`);
    assert(Boolean(idempData.existing), `Repeated request safely returns existing report without creating duplicates`);

    const reportCountInDb = await prisma.evaluationReport.count({
      where: { sessionId: testSessionId },
    });
    assert(reportCountInDb === 1, `Exactly 1 report record exists in SQLite (no duplicate reports)`);

    // --- GROUP 5: Authorization & Cross-Candidate Privacy ---
    console.log("\n--- GROUP 5: Authorization & Cross-Candidate Privacy ---");

    // Candidate B (Maya) attempting to read Candidate A's session -> 403 Forbidden
    const crossSessionRes = await fetch(`${BASE_URL}/api/interview/session?id=${testSessionId}`, {
      headers: { Cookie: mayaCookie },
    });
    assert(crossSessionRes.status === 403, `Candidate B blocked from reading Candidate A's session (got ${crossSessionRes.status})`);

    // Candidate B attempting to read Candidate A's report -> 403 Forbidden
    const crossReportRes = await fetch(`${BASE_URL}/api/interview/report/${testSessionId}`, {
      headers: { Cookie: mayaCookie },
    });
    assert(crossReportRes.status === 403, `Candidate B blocked from reading Candidate A's report (got ${crossReportRes.status})`);

    // Unauthenticated caller attempting to overwrite Candidate A's session -> 403
    const unauthSessionRes = await fetch(`${BASE_URL}/api/interview/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session: { id: testSessionId, status: "in-progress" },
      }),
    });
    assert(unauthSessionRes.status === 403, `Unauthenticated caller blocked from overwriting Candidate A's session (got ${unauthSessionRes.status})`);

    // Candidate A attempting to update shortlist status -> 403 Forbidden
    const candidateShortlistRes = await fetch(`${BASE_URL}/api/interview/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: alexCookie },
      body: JSON.stringify({
        sessionId: testSessionId,
        status: "shortlisted",
      }),
    });
    assert(candidateShortlistRes.status === 403, `Candidate blocked from updating recruiter shortlist status (got ${candidateShortlistRes.status})`);

    // --- GROUP 6: Recruiter Review & Shortlist Persistence in SQLite ---
    console.log("\n--- GROUP 6: Recruiter Review & Shortlist Persistence ---");

    // Authorized recruiter sets shortlist status and private note
    const reviewPayload = {
      sessionId: testSessionId,
      candidateName: "Alex Rivera",
      status: "shortlisted",
      notes: "CONFIDENTIAL: Excellent architectural answers on connection pooling and caching. Approved for final round.",
    };

    const recruiterReviewRes = await fetch(`${BASE_URL}/api/interview/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: recruiterCookie },
      body: JSON.stringify(reviewPayload),
    });
    assert(recruiterReviewRes.status === 200, `Recruiter can submit shortlist status and private notes (got ${recruiterReviewRes.status})`);

    // Recruiter queries review record
    const recruiterGetReviewRes = await fetch(`${BASE_URL}/api/interview/review?sessionId=${testSessionId}`, {
      headers: { Cookie: recruiterCookie },
    });
    const reviewData = await recruiterGetReviewRes.json();
    assert(recruiterGetReviewRes.status === 200, `Recruiter retrieves persisted review`);
    assert(reviewData.review?.status === "shortlisted", `Shortlist status persists as 'shortlisted' in SQLite`);
    assert(reviewData.review?.notes?.includes("CONFIDENTIAL"), `Private notes persist accurately in SQLite`);

    // Candidate A reads their own report -> verify private notes are stripped
    const candidateOwnReportRes = await fetch(`${BASE_URL}/api/interview/report/${testSessionId}`, {
      headers: { Cookie: alexCookie },
    });
    const candidateReportData = await candidateOwnReportRes.json();
    assert(candidateOwnReportRes.status === 200, `Candidate A can read their own report`);
    assert(candidateReportData.report?.shortlistNotes === undefined, `Private recruiter notes are strictly omitted from Candidate response`);

    // Recruiter reads the same report -> notes are present
    const recruiterReportRes = await fetch(`${BASE_URL}/api/interview/report/${testSessionId}`, {
      headers: { Cookie: recruiterCookie },
    });
    const recruiterReportData = await recruiterReportRes.json();
    assert(recruiterReportRes.status === 200, `Recruiter can view candidate report`);
    assert(recruiterReportData.report?.shortlistNotes?.includes("CONFIDENTIAL"), `Recruiter view retains private review notes`);

    // --- GROUP 7: Demo Mode Data Isolation ---
    console.log("\n--- GROUP 7: Demo Mode Isolation ---");

    const demoReportRes = await fetch(`${BASE_URL}/api/interview/report/demo-session-alex`, {
      headers: { Cookie: recruiterCookie },
    });
    assert(demoReportRes.status === 200, `Demo report retrieval functions cleanly`);

    // Verify testSessionId remains unchanged in SQLite
    const realSessionRecord = await prisma.interviewSession.findUnique({
      where: { id: testSessionId },
    });
    assert(realSessionRecord?.status === "completed", `Real candidate session remains intact and unmodified by demo access`);

  } finally {
    // Non-destructive cleanup of temporary test session fixtures
    await prisma.evaluationReport.deleteMany({ where: { sessionId: testSessionId } }).catch(() => {});
    await prisma.recruiterReview.deleteMany({ where: { sessionId: testSessionId } }).catch(() => {});
    await prisma.interviewAnswer.deleteMany({ where: { sessionId: testSessionId } }).catch(() => {});
    await prisma.interviewSession.deleteMany({ where: { id: testSessionId } }).catch(() => {});
    await prisma.interviewSession.deleteMany({ where: { id: emptySessionId } }).catch(() => {});
  }

  console.log("\n======================================================================");
  console.log(`🎯 STAGE 2B TOTAL: ${passed}/${total} PASSED. ALL PASSED: ${passed === total}`);
  console.log("======================================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
}

runStage2BPersistenceTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
