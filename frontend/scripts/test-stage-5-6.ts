process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./dev.db";

import { prisma } from "../src/lib/prisma";

const BASE_URL = "http://localhost:3000";

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

async function loginUser(email: string) {
  const res = await fetch(`${BASE_URL}/api/auth/demo-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${res.status}`);
  }
  const setCookie = res.headers.get("set-cookie");
  const data = await res.json();
  const cookieMatch = setCookie?.match(/interviewiq_session=([^;]+)/);
  const cookie = cookieMatch ? `interviewiq_session=${cookieMatch[1]}` : "";
  return { user: data.user, cookie };
}

async function runStage56Audit() {
  console.log("======================================================================");
  console.log("=== STAGE 5.6: FULL APPLICATION AUDIT & END-TO-END VALIDATION ===");
  console.log("======================================================================\n");

  let candidateAlex: any;
  let cookieAlex = "";
  let candidateMaya: any;
  let cookieMaya = "";
  let recruiter: any;
  let cookieRecruiter = "";

  // ---------------------------------------------------------
  // 1. CANDIDATE WORKFLOW
  // ---------------------------------------------------------
  console.log("--- Executing Candidate Journey Tests ---");

  // 1.1 Candidate Alex Login
  try {
    const login = await loginUser("alex.rivera@example.com");
    candidateAlex = login.user;
    cookieAlex = login.cookie;

    // Verify /api/auth/me
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: cookieAlex },
    });
    const meData = await meRes.json();

    const passed =
      meRes.ok &&
      meData.authenticated === true &&
      meData.user?.email === "alex.rivera@example.com" &&
      meData.user?.role === "candidate";

    results.push({
      category: "Candidate Journey",
      name: "1. Candidate Authentication & Session Verification",
      passed,
      details: passed
        ? `Logged in as Alex Rivera (${meData.user.id}), session cookie validated by /api/auth/me`
        : `Failed auth verification: ${JSON.stringify(meData)}`,
    });
  } catch (err: any) {
    results.push({
      category: "Candidate Journey",
      name: "1. Candidate Authentication & Session Verification",
      passed: false,
      details: err.message,
    });
  }

  // 1.2 Candidate Maya Login (for cross-account isolation tests)
  try {
    const login = await loginUser("maya.patel@example.com");
    candidateMaya = login.user;
    cookieMaya = login.cookie;

    results.push({
      category: "Candidate Journey",
      name: "2. Second Candidate Account Verification (Maya Patel)",
      passed: Boolean(candidateMaya && cookieMaya),
      details: `Logged in as Maya Patel (${candidateMaya.id}) for cross-user isolation checks`,
    });
  } catch (err: any) {
    results.push({
      category: "Candidate Journey",
      name: "2. Second Candidate Account Verification (Maya Patel)",
      passed: false,
      details: err.message,
    });
  }

  const testSessionId = `audit-session-${Date.now()}`;
  const turn1Answer = "We deploy Redis Cache-Aside with connection pooling and TTL jitter to mitigate stampedes.";
  const turn2Answer = "We employ idempotent transaction IDs and distributed fencing tokens to prevent split-brain execution.";

  // 1.3 Candidate Interview Setup & Session Initialization
  try {
    const sessionPayload = {
      id: testSessionId,
      setup: {
        candidateName: candidateAlex.name,
        targetRole: "fullstack",
        experienceLevel: "senior",
        interviewFocus: "mixed",
        interviewLength: 20,
        skills: ["React", "TypeScript", "Node.js", "Redis", "PostgreSQL"],
        userId: candidateAlex.id,
      },
      status: "in-progress",
      startedAt: new Date().toISOString(),
      durationSeconds: 60,
      answers: [],
      currentQuestionIndex: 0,
      userId: candidateAlex.id,
    };

    const res = await fetch(`${BASE_URL}/api/interview/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAlex,
      },
      body: JSON.stringify({ session: sessionPayload }),
    });

    const data = await res.json();
    const dbSession = await prisma.interviewSession.findUnique({
      where: { id: testSessionId },
    });

    const passed =
      res.ok &&
      dbSession !== null &&
      dbSession.userId === candidateAlex.id &&
      dbSession.status === "in-progress";

    results.push({
      category: "Candidate Journey",
      name: "3. Candidate Session Setup & Persistence in SQLite",
      passed,
      details: passed
        ? `Session ${testSessionId} persisted in SQLite with status='in-progress' and userId='${dbSession?.userId}'`
        : `Failed to persist session: ${JSON.stringify(data)}`,
    });
  } catch (err: any) {
    results.push({
      category: "Candidate Journey",
      name: "3. Candidate Session Setup & Persistence in SQLite",
      passed: false,
      details: err.message,
    });
  }

  // 1.4 Submit Answer Turns (Verbatim Text Persistence)
  try {
    const ans1 = {
      questionId: "q-arch-101",
      questionText: "How do you scale query caching and prevent cache stampedes under high concurrency?",
      category: "System Architecture",
      difficulty: "senior",
      answerText: turn1Answer,
      submittedAt: "10:15 AM",
      feedback: {
        score: 94,
        strengths: ["Redis Cache-Aside pattern", "Connection pooling", "TTL jitter"],
        gaps: ["Could elaborate on stale-while-revalidate fallback"],
        adaptiveNote: "Demonstrated advanced caching mechanics.",
      },
    };

    const ans2 = {
      questionId: "q-dist-102",
      questionText: "How do you guarantee exactly-once side-effects in distributed payment systems?",
      category: "Distributed Systems",
      difficulty: "senior",
      answerText: turn2Answer,
      submittedAt: "10:22 AM",
      feedback: {
        score: 90,
        strengths: ["Idempotent transaction tokens", "Fencing tokens"],
        gaps: ["Two-phase commit trade-offs"],
        adaptiveNote: "Strong concurrency and consistency reasoning.",
      },
    };

    const res1 = await fetch(`${BASE_URL}/api/interview/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieAlex },
      body: JSON.stringify({ sessionId: testSessionId, answer: ans1 }),
    });

    const res2 = await fetch(`${BASE_URL}/api/interview/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieAlex },
      body: JSON.stringify({ sessionId: testSessionId, answer: ans2 }),
    });

    const dbAnswers = await prisma.interviewAnswer.findMany({
      where: { sessionId: testSessionId },
    });

    const passed =
      res1.ok &&
      res2.ok &&
      dbAnswers.length === 2 &&
      dbAnswers.some((a) => a.answerText === turn1Answer) &&
      dbAnswers.some((a) => a.answerText === turn2Answer);

    results.push({
      category: "Candidate Journey",
      name: "4. Exact Verbatim Answer Turns Persisted in SQLite",
      passed,
      details: passed
        ? `Stored 2 answer turns. Exact text verified verbatim in SQLite database.`
        : `Failed: dbAnswers count=${dbAnswers.length}`,
    });
  } catch (err: any) {
    results.push({
      category: "Candidate Journey",
      name: "4. Exact Verbatim Answer Turns Persisted in SQLite",
      passed: false,
      details: err.message,
    });
  }

  // 1.5 Answer Turn Retry Deduplication
  try {
    const updatedAns1 = {
      questionId: "q-arch-101",
      questionText: "How do you scale query caching and prevent cache stampedes under high concurrency?",
      category: "System Architecture",
      difficulty: "senior",
      answerText: turn1Answer + " Plus stale-while-revalidate background refresh.",
      submittedAt: "10:16 AM",
      feedback: {
        score: 97,
        strengths: ["Redis Cache-Aside", "Stale-while-revalidate"],
        gaps: [],
        adaptiveNote: "Mastery achieved.",
      },
    };

    const retryRes = await fetch(`${BASE_URL}/api/interview/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieAlex },
      body: JSON.stringify({ sessionId: testSessionId, answer: updatedAns1 }),
    });

    const dbAnswersAfterRetry = await prisma.interviewAnswer.findMany({
      where: { sessionId: testSessionId },
    });

    const passed =
      retryRes.ok &&
      dbAnswersAfterRetry.length === 2 &&
      dbAnswersAfterRetry.some((a) => a.score === 97);

    results.push({
      category: "Candidate Journey",
      name: "5. Answer Turn Idempotency (Retry Updates Without Duplication)",
      passed,
      details: passed
        ? `Retrying existing questionId updated record in place. Total count remained 2, score updated to 97.`
        : `Failed: count=${dbAnswersAfterRetry.length}`,
    });
  } catch (err: any) {
    results.push({
      category: "Candidate Journey",
      name: "5. Answer Turn Idempotency (Retry Updates Without Duplication)",
      passed: false,
      details: err.message,
    });
  }

  // 1.6 Generate Final Evaluation Report (with deterministic fallback guarantee)
  let generatedReport: any;
  try {
    const currentSession = await prisma.interviewSession.findUnique({
      where: { id: testSessionId },
      include: { answers: true },
    });

    // Mark session as 'completed' before report generation
    // (Security guard added in Stage 2B.1 requires this)
    const completeSessionRes = await fetch(`${BASE_URL}/api/interview/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieAlex },
      body: JSON.stringify({
        session: {
          id: testSessionId,
          setup: {
            candidateName: candidateAlex.name,
            targetRole: "fullstack",
            experienceLevel: "senior",
            interviewFocus: "mixed",
            interviewLength: 20,
            skills: ["React", "TypeScript", "Node.js", "Redis", "PostgreSQL"],
            userId: candidateAlex.id,
          },
          status: "completed",
          startedAt: new Date(Date.now() - 1200000).toISOString(),
          endedAt: new Date().toISOString(),
          durationSeconds: 1200,
          answers: [],
          currentQuestionIndex: 2,
          userId: candidateAlex.id,
        },
      }),
    });

    if (!completeSessionRes.ok) {
      const errData = await completeSessionRes.json();
      throw new Error(`Failed to complete session: ${JSON.stringify(errData)}`);
    }

    const reportRes = await fetch(`${BASE_URL}/api/interview/generate-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieAlex },
      body: JSON.stringify({
        session: {
          id: testSessionId,
          setup: {
            candidateName: candidateAlex.name,
            targetRole: "fullstack",
            experienceLevel: "senior",
            interviewFocus: "mixed",
            interviewLength: 20,
            skills: ["React", "TypeScript", "Node.js", "Redis", "PostgreSQL"],
          },
          answers: (currentSession?.answers || []).map((a) => ({
            questionId: a.questionId,
            questionText: a.questionText,
            category: a.category,
            difficulty: a.difficulty,
            answerText: a.answerText,
            submittedAt: a.submittedAt,
            feedback: {
              score: a.score,
              strengths: JSON.parse(a.strengths || "[]"),
              gaps: JSON.parse(a.gaps || "[]"),
              adaptiveNote: a.adaptiveNote || "",
            },
          })),
          durationSeconds: 1200,
        },
        forceDeterministic: true, // Guarantees instant reliable local evaluation
      }),
    });

    const reportData = await reportRes.json();
    generatedReport = reportData.report;

    const dbReport = await prisma.evaluationReport.findUnique({
      where: { sessionId: testSessionId },
    });
    const dbSessionAfter = await prisma.interviewSession.findUnique({
      where: { id: testSessionId },
    });

    const passed =
      reportRes.ok &&
      dbReport !== null &&
      dbSessionAfter?.status === "completed" &&
      generatedReport.verdict === "Strong Hire Recommendation" &&
      generatedReport.evidenceCitations.length > 0;

    results.push({
      category: "Candidate Journey",
      name: "6. Final Evaluation Report Generation & Status Completion",
      passed,
      details: passed
        ? `Report generated: score=${dbReport?.overallScore}%, verdict='${dbReport?.verdict}', session status marked 'completed'`
        : `Failed: ${JSON.stringify(reportData)}`,
    });
  } catch (err: any) {
    results.push({
      category: "Candidate Journey",
      name: "6. Final Evaluation Report Generation & Status Completion",
      passed: false,
      details: err.message,
    });
  }

  // 1.7 Candidate Reload & Re-fetch Own Report
  try {
    const getRes = await fetch(`${BASE_URL}/api/interview/report/${testSessionId}`, {
      headers: { Cookie: cookieAlex },
    });
    const getData = await getRes.json();

    const passed =
      getRes.ok &&
      getData.report?.sessionId === testSessionId &&
      getData.report?.candidateName === candidateAlex.name &&
      getData.report?.overallScore >= 80;

    results.push({
      category: "Candidate Journey",
      name: "7. Candidate Page Reload & Re-fetch Persisted Report",
      passed,
      details: passed
        ? `Successfully retrieved persisted report on simulated reload (HTTP 200). Metrics: ${getData.report?.metrics?.length}`
        : `Failed: res=${getRes.status}, data=${JSON.stringify(getData)}`,
    });
  } catch (err: any) {
    results.push({
      category: "Candidate Journey",
      name: "7. Candidate Page Reload & Re-fetch Persisted Report",
      passed: false,
      details: err.message,
    });
  }

  // 1.8 Cross-Account Candidate Isolation (Maya cannot view Alex's report)
  try {
    const mayaReportRes = await fetch(`${BASE_URL}/api/interview/report/${testSessionId}`, {
      headers: { Cookie: cookieMaya },
    });

    const mayaSessionRes = await fetch(`${BASE_URL}/api/interview/session?id=${testSessionId}`, {
      headers: { Cookie: cookieMaya },
    });

    const passed = mayaReportRes.status === 403 && mayaSessionRes.status === 403;

    results.push({
      category: "Candidate Journey",
      name: "8. Cross-Account Candidate Isolation (403 Forbidden)",
      passed,
      details: passed
        ? `Maya Patel rejected with 403 on Alex's report and 403 on Alex's session.`
        : `Failed: report status=${mayaReportRes.status}, session status=${mayaSessionRes.status}`,
    });
  } catch (err: any) {
    results.push({
      category: "Candidate Journey",
      name: "8. Cross-Account Candidate Isolation (403 Forbidden)",
      passed: false,
      details: err.message,
    });
  }

  // ---------------------------------------------------------
  // 2. RECRUITER WORKFLOW
  // ---------------------------------------------------------
  console.log("--- Executing Recruiter Journey Tests ---");

  // 2.1 Recruiter Login & Pipeline Loading
  try {
    const login = await loginUser("recruiter@interviewiq.ai");
    recruiter = login.user;
    cookieRecruiter = login.cookie;

    const pipelineRes = await fetch(`${BASE_URL}/api/interview/reports`, {
      headers: { Cookie: cookieRecruiter },
    });
    const pipelineData = await pipelineRes.json();

    const candidateSessionInPipeline = pipelineData.reports?.find(
      (r: any) => r.sessionId === testSessionId
    );

    const passed =
      pipelineRes.ok &&
      Array.isArray(pipelineData.reports) &&
      Boolean(candidateSessionInPipeline);

    results.push({
      category: "Recruiter Journey",
      name: "9. Recruiter Login & Candidate Pipeline Aggregation",
      passed,
      details: passed
        ? `Recruiter pipeline loaded ${pipelineData.reports.length} candidates. Live session ${testSessionId} present.`
        : `Failed: candidate not found in pipeline. Total: ${pipelineData.reports?.length}`,
    });
  } catch (err: any) {
    results.push({
      category: "Recruiter Journey",
      name: "9. Recruiter Login & Candidate Pipeline Aggregation",
      passed: false,
      details: err.message,
    });
  }

  // 2.2 Recruiter Inspects Candidate Report
  try {
    const recReportRes = await fetch(`${BASE_URL}/api/interview/report/${testSessionId}`, {
      headers: { Cookie: cookieRecruiter },
    });
    const recReportData = await recReportRes.json();

    const passed =
      recReportRes.ok &&
      recReportData.report?.sessionId === testSessionId &&
      recReportData.report?.evidenceCitations?.length > 0;

    results.push({
      category: "Recruiter Journey",
      name: "10. Recruiter Access to Candidate Dossier & Citations",
      passed,
      details: passed
        ? `Recruiter loaded dossier: verdict='${recReportData.report?.verdict}', citations=${recReportData.report?.evidenceCitations?.length}`
        : `Failed: res=${recReportRes.status}`,
    });
  } catch (err: any) {
    results.push({
      category: "Recruiter Journey",
      name: "10. Recruiter Access to Candidate Dossier & Citations",
      passed: false,
      details: err.message,
    });
  }

  // 2.3 Recruiter Creates & Updates Shortlist Review and Notes
  const secretRecruiterNote = "PRIVATE: Candidate demonstrated exemplary distributed caching. Fast-track to architectural onsite.";
  try {
    // Step A: Shortlist with notes
    const reviewRes1 = await fetch(`${BASE_URL}/api/interview/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieRecruiter },
      body: JSON.stringify({
        sessionId: testSessionId,
        candidateName: candidateAlex.name,
        status: "shortlisted",
        notes: secretRecruiterNote,
      }),
    });

    const dbReview1 = await prisma.recruiterReview.findUnique({
      where: { sessionId: testSessionId },
    });

    // Step B: Update review status to "under-review" (idempotent, no duplicates)
    const reviewRes2 = await fetch(`${BASE_URL}/api/interview/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieRecruiter },
      body: JSON.stringify({
        sessionId: testSessionId,
        status: "under-review",
        notes: secretRecruiterNote + " Waiting on hiring manager calibration.",
      }),
    });

    const totalReviewsForSession = await prisma.recruiterReview.count({
      where: { sessionId: testSessionId },
    });

    const dbReview2 = await prisma.recruiterReview.findUnique({
      where: { sessionId: testSessionId },
    });

    const passed =
      reviewRes1.ok &&
      reviewRes2.ok &&
      totalReviewsForSession === 1 &&
      dbReview1?.status === "shortlisted" &&
      dbReview2?.status === "under-review" &&
      dbReview2?.notes?.includes("calibration") === true;

    results.push({
      category: "Recruiter Journey",
      name: "11. Recruiter Review & Note Persistence (Idempotent Upsert)",
      passed,
      details: passed
        ? `Created and updated review without duplicate records (count=1). Status transitioned shortlisted -> under-review.`
        : `Failed: count=${totalReviewsForSession}, dbReview2=${JSON.stringify(dbReview2)}`,
    });
  } catch (err: any) {
    results.push({
      category: "Recruiter Journey",
      name: "11. Recruiter Review & Note Persistence (Idempotent Upsert)",
      passed: false,
      details: err.message,
    });
  }

  // 2.4 Recruiter Unshortlist Candidate (Transition to pending)
  try {
    const unshortlistRes = await fetch(`${BASE_URL}/api/interview/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieRecruiter },
      body: JSON.stringify({
        sessionId: testSessionId,
        status: "pending",
        notes: "Unshortlisted back to pending pool.",
      }),
    });

    const dbReviewUnshortlist = await prisma.recruiterReview.findUnique({
      where: { sessionId: testSessionId },
    });

    const passed =
      unshortlistRes.ok &&
      dbReviewUnshortlist?.status === "pending";

    results.push({
      category: "Recruiter Journey",
      name: "12. Unshortlist Candidate State Transition Persists",
      passed,
      details: passed
        ? `Candidate status successfully reverted to 'pending' in SQLite.`
        : `Failed: status=${dbReviewUnshortlist?.status}`,
    });
  } catch (err: any) {
    results.push({
      category: "Recruiter Journey",
      name: "12. Unshortlist Candidate State Transition Persists",
      passed: false,
      details: err.message,
    });
  }

  // 2.5 Recruiter Reload & Re-fetch All Reviews
  try {
    const reviewsRes = await fetch(`${BASE_URL}/api/interview/reviews`, {
      headers: { Cookie: cookieRecruiter },
    });
    const reviewsData = await reviewsRes.json();
    const sessionReview = reviewsData.reviews?.find((r: any) => r.sessionId === testSessionId);

    const passed =
      reviewsRes.ok &&
      Array.isArray(reviewsData.reviews) &&
      sessionReview !== undefined;

    results.push({
      category: "Recruiter Journey",
      name: "13. Recruiter Bulk Reviews Retrieval (/api/interview/reviews)",
      passed,
      details: passed
        ? `Bulk reviews retrieved (${reviewsData.reviews.length} total). Target session present with status='${sessionReview?.status}'`
        : `Failed: res=${reviewsRes.status}`,
    });
  } catch (err: any) {
    results.push({
      category: "Recruiter Journey",
      name: "13. Recruiter Bulk Reviews Retrieval (/api/interview/reviews)",
      passed: false,
      details: err.message,
    });
  }

  // ---------------------------------------------------------
  // 3. SECURITY & PRIVACY AUDIT
  // ---------------------------------------------------------
  console.log("--- Executing Security & Privacy Audit Tests ---");

  // 3.1 Candidate CANNOT Access Recruiter Private Notes
  try {
    // Add confidential note
    await fetch(`${BASE_URL}/api/interview/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieRecruiter },
      body: JSON.stringify({
        sessionId: testSessionId,
        status: "shortlisted",
        notes: secretRecruiterNote,
      }),
    });

    // Candidate Alex retrieves own report
    const candReportRes = await fetch(`${BASE_URL}/api/interview/report/${testSessionId}`, {
      headers: { Cookie: cookieAlex },
    });
    const candReportData = await candReportRes.json();

    // Recruiter retrieves report
    const recReportRes = await fetch(`${BASE_URL}/api/interview/report/${testSessionId}`, {
      headers: { Cookie: cookieRecruiter },
    });
    const recReportData = await recReportRes.json();

    const candidateLeakedNotes =
      candReportData.report?.shortlistNotes !== undefined &&
      candReportData.report?.shortlistNotes !== null;

    const recruiterHasNotes =
      recReportData.report?.shortlistNotes === secretRecruiterNote;

    const passed = !candidateLeakedNotes && recruiterHasNotes;

    results.push({
      category: "Security & Privacy",
      name: "14. Private Recruiter Notes Strictly Filtered for Candidates",
      passed,
      details: passed
        ? `Candidate received shortlistStatus='${candReportData.report?.shortlistStatus}' with shortlistNotes=undefined. Recruiter received full internal note.`
        : `Failed: candNotes=${candReportData.report?.shortlistNotes}, recNotes=${recReportData.report?.shortlistNotes}`,
    });
  } catch (err: any) {
    results.push({
      category: "Security & Privacy",
      name: "14. Private Recruiter Notes Strictly Filtered for Candidates",
      passed: false,
      details: err.message,
    });
  }

  // 3.2 Candidate CANNOT Call Recruiter Review Endpoints (403)
  try {
    const candPostReview = await fetch(`${BASE_URL}/api/interview/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieAlex },
      body: JSON.stringify({ sessionId: testSessionId, status: "shortlisted" }),
    });

    const candGetReviews = await fetch(`${BASE_URL}/api/interview/reviews`, {
      headers: { Cookie: cookieAlex },
    });

    const passed = candPostReview.status === 403 && candGetReviews.status === 403;

    results.push({
      category: "Security & Privacy",
      name: "15. Candidate Forbidden from Recruiter Review APIs (403)",
      passed,
      details: passed
        ? `POST /api/interview/review -> 403, GET /api/interview/reviews -> 403 when called by candidate.`
        : `Failed: POST status=${candPostReview.status}, GET status=${candGetReviews.status}`,
    });
  } catch (err: any) {
    results.push({
      category: "Security & Privacy",
      name: "15. Candidate Forbidden from Recruiter Review APIs (403)",
      passed: false,
      details: err.message,
    });
  }

  // 3.3 Unauthenticated Requests Rejected (401)
  try {
    const unauthReviewPost = await fetch(`${BASE_URL}/api/interview/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: testSessionId, status: "shortlisted" }),
    });

    const unauthReviewsGet = await fetch(`${BASE_URL}/api/interview/reviews`);

    const passed = unauthReviewPost.status === 401 && unauthReviewsGet.status === 401;

    results.push({
      category: "Security & Privacy",
      name: "16. Unauthenticated Requests Rejected (401 Unauthorized)",
      passed,
      details: passed
        ? `POST /api/interview/review -> 401, GET /api/interview/reviews -> 401 without session cookie.`
        : `Failed: POST status=${unauthReviewPost.status}, GET status=${unauthReviewsGet.status}`,
    });
  } catch (err: any) {
    results.push({
      category: "Security & Privacy",
      name: "16. Unauthenticated Requests Rejected (401 Unauthorized)",
      passed: false,
      details: err.message,
    });
  }

  // 3.4 Identity Spoofing Blocked (Derived Exclusively From Server Session)
  try {
    const spoofedId = "attacker-spoofed-user-id";
    const spoofedName = "Attacker CEO";

    await fetch(`${BASE_URL}/api/interview/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieRecruiter },
      body: JSON.stringify({
        sessionId: testSessionId,
        status: "shortlisted",
        notes: "Checking spoofing resistance.",
        reviewerId: spoofedId,
        reviewedBy: spoofedName,
      }),
    });

    const dbRow = await prisma.recruiterReview.findUnique({
      where: { sessionId: testSessionId },
    });

    const passed =
      dbRow?.reviewerId === recruiter.id &&
      dbRow?.reviewerId !== spoofedId &&
      dbRow?.reviewedBy === recruiter.name;

    results.push({
      category: "Security & Privacy",
      name: "17. Recruiter Anti-Spoofing (Server Derives Identity)",
      passed,
      details: passed
        ? `Server ignored spoofed payload. DB reviewerId is authenticated user ${recruiter.id} (${recruiter.name}).`
        : `Failed: reviewerId=${dbRow?.reviewerId}`,
    });
  } catch (err: any) {
    results.push({
      category: "Security & Privacy",
      name: "17. Recruiter Anti-Spoofing (Server Derives Identity)",
      passed: false,
      details: err.message,
    });
  }

  // 3.5 Cross-Candidate Write Protection (Session Overwrite & Injection Blocked)
  try {
    // Maya tries to overwrite Alex's session
    const overwriteRes = await fetch(`${BASE_URL}/api/interview/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieMaya },
      body: JSON.stringify({
        session: {
          id: testSessionId,
          setup: { candidateName: "Attacker Maya", targetRole: "frontend" },
        },
      }),
    });

    // Maya tries to inject an answer into Alex's session
    const injectAnsRes = await fetch(`${BASE_URL}/api/interview/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieMaya },
      body: JSON.stringify({
        sessionId: testSessionId,
        answer: {
          questionId: "injected-q",
          questionText: "Injected question",
          category: "Security",
          difficulty: "intermediate",
          answerText: "Injected answer payload",
          submittedAt: "11:00 AM",
        },
      }),
    });

    const passed = overwriteRes.status === 403 && injectAnsRes.status === 403;

    results.push({
      category: "Security & Privacy",
      name: "18. Cross-Candidate Session Overwrite & Answer Injection Blocked",
      passed,
      details: passed
        ? `Session overwrite rejected (403), Answer injection rejected (403).`
        : `Failed: overwrite=${overwriteRes.status}, inject=${injectAnsRes.status}`,
    });
  } catch (err: any) {
    results.push({
      category: "Security & Privacy",
      name: "18. Cross-Candidate Session Overwrite & Answer Injection Blocked",
      passed: false,
      details: err.message,
    });
  }

  // 3.6 Session Logout & Revocation Verification
  try {
    // Create temporary session for testing logout
    const tempLogin = await loginUser("alex.rivera@example.com");
    const tempCookie = tempLogin.cookie;

    // Verify session works
    const check1 = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: tempCookie },
    });
    const data1 = await check1.json();

    // Perform logout
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: tempCookie },
    });

    // Verify session revoked in DB and rejected
    const check2 = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: tempCookie },
    });
    const data2 = await check2.json();

    const passed =
      data1.authenticated === true &&
      logoutRes.ok &&
      data2.authenticated === false;

    results.push({
      category: "Security & Privacy",
      name: "19. Session Expiration & Revocation on Logout",
      passed,
      details: passed
        ? `Session successfully revoked in SQLite on POST /api/auth/logout. Subsequent /api/auth/me returned authenticated=false.`
        : `Failed: authenticated before=${data1.authenticated}, after=${data2.authenticated}`,
    });
  } catch (err: any) {
    results.push({
      category: "Security & Privacy",
      name: "19. Session Expiration & Revocation on Logout",
      passed: false,
      details: err.message,
    });
  }

  // 3.7 Demo Benchmark Reports Integrity
  try {
    const demoAlexRes = await fetch(`${BASE_URL}/api/interview/report/demo-session-alex`, {
      headers: { Cookie: cookieRecruiter },
    });
    const demoAlexData = await demoAlexRes.json();

    const passed =
      demoAlexRes.ok &&
      demoAlexData.report?.sessionId === "demo-session-alex" &&
      demoAlexData.report?.candidateName === "Alex Rivera" &&
      demoAlexData.report?.metrics?.length > 0 &&
      demoAlexData.report?.evidenceCitations?.length > 0;

    results.push({
      category: "Security & Privacy",
      name: "20. Demo Benchmark Candidates Integrity & Dossier Quality",
      passed,
      details: passed
        ? `Demo candidate Alex Rivera loaded with ${demoAlexData.report?.metrics?.length} metrics and ${demoAlexData.report?.evidenceCitations?.length} evidence citations.`
        : `Failed: res=${demoAlexRes.status}`,
    });
  } catch (err: any) {
    results.push({
      category: "Security & Privacy",
      name: "20. Demo Benchmark Candidates Integrity & Dossier Quality",
      passed: false,
      details: err.message,
    });
  }

  // ---------------------------------------------------------
  // SUMMARY PRINTING
  // ---------------------------------------------------------
  console.log("\n======================================================================");
  console.log("=== AUDIT RESULTS SUMMARY ===");
  console.log("======================================================================");

  let allPassed = true;
  let categoryCurrent = "";

  for (const r of results) {
    if (r.category !== categoryCurrent) {
      categoryCurrent = r.category;
      console.log(`\n[${categoryCurrent}]`);
    }
    const badge = r.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${badge} | ${r.name}`);
    if (r.details) {
      console.log(`       └─ ${r.details}`);
    }
    if (!r.passed) allPassed = false;
  }

  const passCount = results.filter((r) => r.passed).length;
  console.log("\n======================================================================");
  console.log(`TOTAL: ${passCount}/${results.length} PASSED. ALL PASSED: ${allPassed}`);
  console.log("======================================================================\n");

  if (!allPassed) {
    process.exit(1);
  }
}

runStage56Audit().catch((err) => {
  console.error("Stage 5.6 audit execution failed:", err);
  process.exit(1);
});
