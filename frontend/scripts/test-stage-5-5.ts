process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./dev.db";

import { prisma } from "../src/lib/prisma";
import { persistReport } from "../src/lib/report-persistence";

const BASE_URL = "http://localhost:3000";

interface TestResult {
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

async function runTests() {
  console.log("=== STARTING STAGE 5.5 PERSISTENT RECRUITER REVIEWS TEST SUITE ===");

  let recruiter: any;
  let recruiterCookie = "";
  let candidateA: any;
  let candidateCookie = "";

  try {
    const recLogin = await loginUser("recruiter@interviewiq.ai");
    recruiter = recLogin.user;
    recruiterCookie = recLogin.cookie;

    const candLogin = await loginUser("alex.rivera@example.com");
    candidateA = candLogin.user;
    candidateCookie = candLogin.cookie;
  } catch (err: any) {
    console.error("Setup login failed:", err.message);
    process.exit(1);
  }

  const testSessionId = `test-review-session-${Date.now()}`;

  // Pre-seed a candidate session so foreign key constraints are directly satisfied
  try {
    const sessionPayload = {
      id: testSessionId,
      setup: {
        candidateName: candidateA.name,
        targetRole: "fullstack",
        experienceLevel: "senior",
        interviewFocus: "mixed",
        interviewLength: 15,
        skills: ["React", "TypeScript", "Node.js"],
        userId: candidateA.id,
      },
      status: "completed",
      startedAt: new Date().toISOString(),
      durationSeconds: 900,
      answers: [],
      currentQuestionIndex: 0,
      userId: candidateA.id,
    };

    await fetch(`${BASE_URL}/api/interview/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: candidateCookie,
      },
      body: JSON.stringify({ session: sessionPayload }),
    });

    // Also persist a mock report for this session via persistReport
    const reportPayload = {
      sessionId: testSessionId,
      userId: candidateA.id,
      candidateName: candidateA.name,
      targetRole: "Full Stack Engineer",
      experienceLevel: "senior",
      interviewFocus: "mixed",
      overallScore: 89,
      verdict: "Strong Hire Recommendation" as const,
      durationMinutes: 15,
      completedAt: new Date().toISOString(),
      strengths: ["Exceptional architectural depth"],
      weaknesses: ["None critical"],
      areasToImprove: ["Distributed transactions scaling"],
      actionableRoadmap: ["Study consensus algorithms"],
      isDemoSimulation: false,
      metrics: [],
      answerRecords: [],
    };

    await persistReport(reportPayload, candidateA.id);
  } catch (err: any) {
    console.warn("Pre-seeding candidate session warning:", err.message);
  }

  // 1. Authenticated recruiter can create a review
  try {
    const res = await fetch(`${BASE_URL}/api/interview/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: recruiterCookie,
      },
      body: JSON.stringify({
        sessionId: testSessionId,
        candidateName: candidateA.name,
        status: "shortlisted",
        notes: "Excellent technical depth in system architecture. Highly recommended for onsite.",
      }),
    });

    const data = await res.json();
    const dbReview = await prisma.recruiterReview.findUnique({
      where: { sessionId: testSessionId },
    });

    const passed =
      res.ok &&
      data.success === true &&
      dbReview !== null &&
      dbReview.status === "shortlisted" &&
      dbReview.notes?.includes("system architecture") === true &&
      dbReview.reviewerId === recruiter.id;

    results.push({
      name: "1. Authenticated Recruiter Creates Review",
      passed,
      details: passed
        ? `Review created in SQLite: status='${dbReview?.status}', reviewerId='${dbReview?.reviewerId}'`
        : `Failed: res status ${res.status}, body: ${JSON.stringify(data)}`,
    });
  } catch (err: any) {
    results.push({
      name: "1. Authenticated Recruiter Creates Review",
      passed: false,
      details: err.message,
    });
  }

  // 2. Recruiter can update a review without creating duplicates
  try {
    const res = await fetch(`${BASE_URL}/api/interview/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: recruiterCookie,
      },
      body: JSON.stringify({
        sessionId: testSessionId,
        candidateName: candidateA.name,
        status: "under-review",
        notes: "Updated note: hold for team sync on Thursday.",
      }),
    });

    const data = await res.json();
    const reviewCount = await prisma.recruiterReview.count({
      where: { sessionId: testSessionId },
    });
    const dbReview = await prisma.recruiterReview.findUnique({
      where: { sessionId: testSessionId },
    });

    const passed =
      res.ok &&
      reviewCount === 1 &&
      dbReview?.status === "under-review" &&
      dbReview?.notes?.includes("Thursday") === true;

    results.push({
      name: "2. Recruiter Updates Review (Idempotent / No Duplicates)",
      passed,
      details: passed
        ? `Exactly 1 record exists in DB. Updated status='${dbReview?.status}', notes='${dbReview?.notes}'`
        : `Failed: reviewCount=${reviewCount}, dbReview=${JSON.stringify(dbReview)}`,
    });
  } catch (err: any) {
    results.push({
      name: "2. Recruiter Updates Review (Idempotent / No Duplicates)",
      passed: false,
      details: err.message,
    });
  }

  // 3. Shortlist and unshortlist changes persist
  try {
    // Shortlist
    await fetch(`${BASE_URL}/api/interview/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: recruiterCookie },
      body: JSON.stringify({
        sessionId: testSessionId,
        status: "shortlisted",
        notes: "Shortlisted for next round.",
      }),
    });
    const dbShortlisted = await prisma.recruiterReview.findUnique({
      where: { sessionId: testSessionId },
    });

    // Unshortlist (back to pending)
    await fetch(`${BASE_URL}/api/interview/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: recruiterCookie },
      body: JSON.stringify({
        sessionId: testSessionId,
        status: "pending",
        notes: "Removed from shortlist, back to pending review pool.",
      }),
    });
    const dbUnshortlisted = await prisma.recruiterReview.findUnique({
      where: { sessionId: testSessionId },
    });

    const passed =
      dbShortlisted?.status === "shortlisted" &&
      dbUnshortlisted?.status === "pending";

    results.push({
      name: "3. Shortlist and Unshortlist State Transitions Persist",
      passed,
      details: passed
        ? `Successfully transitioned shortlisted -> pending in SQLite`
        : `Failed: first='${dbShortlisted?.status}', second='${dbUnshortlisted?.status}'`,
    });
  } catch (err: any) {
    results.push({
      name: "3. Shortlist and Unshortlist State Transitions Persist",
      passed: false,
      details: err.message,
    });
  }

  // 4. Review notes persist after retrieval
  try {
    const testNote = "Deep understanding of React concurrent mode and distributed transactions.";
    await fetch(`${BASE_URL}/api/interview/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: recruiterCookie },
      body: JSON.stringify({
        sessionId: testSessionId,
        status: "shortlisted",
        notes: testNote,
      }),
    });

    // Retrieve via single review endpoint
    const getRes = await fetch(`${BASE_URL}/api/interview/review?sessionId=${testSessionId}`, {
      headers: { Cookie: recruiterCookie },
    });
    const getData = await getRes.json();

    // Retrieve via all reviews endpoint
    const listRes = await fetch(`${BASE_URL}/api/interview/reviews`, {
      headers: { Cookie: recruiterCookie },
    });
    const listData = await listRes.json();
    const foundInList = listData.reviews?.find((r: any) => r.sessionId === testSessionId);

    const passed =
      getRes.ok &&
      getData.review?.notes === testNote &&
      listRes.ok &&
      foundInList?.notes === testNote;

    results.push({
      name: "4. Review Notes Persist After API Retrieval",
      passed,
      details: passed
        ? `Single review and bulk reviews both returned exact notes: "${testNote}"`
        : `Failed: single notes='${getData.review?.notes}', list notes='${foundInList?.notes}'`,
    });
  } catch (err: any) {
    results.push({
      name: "4. Review Notes Persist After API Retrieval",
      passed: false,
      details: err.message,
    });
  }

  // 5. Review status persists across valid statuses
  try {
    const statuses = ["shortlisted", "under-review", "rejected", "pending"];
    let allMatched = true;

    for (const st of statuses) {
      await fetch(`${BASE_URL}/api/interview/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: recruiterCookie },
        body: JSON.stringify({
          sessionId: testSessionId,
          status: st,
        }),
      });

      const dbRow = await prisma.recruiterReview.findUnique({
        where: { sessionId: testSessionId },
      });

      if (dbRow?.status !== st) {
        allMatched = false;
        break;
      }
    }

    results.push({
      name: "5. All Valid Review Statuses Persist Correctly",
      passed: allMatched,
      details: allMatched
        ? `Verified round-trip persistence for [shortlisted, under-review, rejected, pending]`
        : `Failed to persist all valid statuses`,
    });
  } catch (err: any) {
    results.push({
      name: "5. All Valid Review Statuses Persist Correctly",
      passed: false,
      details: err.message,
    });
  }

  // 6. Unauthenticated request is rejected (401)
  try {
    const postRes = await fetch(`${BASE_URL}/api/interview/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: testSessionId,
        status: "shortlisted",
      }),
    });

    const getRes = await fetch(`${BASE_URL}/api/interview/reviews`);

    const passed = postRes.status === 401 && getRes.status === 401;

    results.push({
      name: "6. Unauthenticated Requests Rejected (401)",
      passed,
      details: passed
        ? `POST returned 401, GET returned 401 as expected`
        : `Failed: POST status ${postRes.status}, GET status ${getRes.status}`,
    });
  } catch (err: any) {
    results.push({
      name: "6. Unauthenticated Requests Rejected (401)",
      passed: false,
      details: err.message,
    });
  }

  // 7. Candidate cannot create or modify recruiter reviews (403)
  try {
    const postRes = await fetch(`${BASE_URL}/api/interview/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: candidateCookie,
      },
      body: JSON.stringify({
        sessionId: testSessionId,
        status: "shortlisted",
        notes: "Candidate trying to shortlist self.",
      }),
    });

    const getRes = await fetch(`${BASE_URL}/api/interview/reviews`, {
      headers: { Cookie: candidateCookie },
    });

    const passed = postRes.status === 403 && getRes.status === 403;

    results.push({
      name: "7. Candidate Requests Rejected with Forbidden (403)",
      passed,
      details: passed
        ? `POST returned 403, GET returned 403 when executed by candidate`
        : `Failed: POST status ${postRes.status}, GET status ${getRes.status}`,
    });
  } catch (err: any) {
    results.push({
      name: "7. Candidate Requests Rejected with Forbidden (403)",
      passed: false,
      details: err.message,
    });
  }

  // 8. Candidate cannot read recruiter's private notes in evaluation report
  try {
    const privateNote = "CONFIDENTIAL: Strong candidate, but compensation expectations are above band.";
    await fetch(`${BASE_URL}/api/interview/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: recruiterCookie },
      body: JSON.stringify({
        sessionId: testSessionId,
        status: "shortlisted",
        notes: privateNote,
      }),
    });

    // Candidate fetches report
    const candReportRes = await fetch(`${BASE_URL}/api/interview/report/${testSessionId}`, {
      headers: { Cookie: candidateCookie },
    });
    const candReportData = await candReportRes.json();

    // Recruiter fetches report
    const recReportRes = await fetch(`${BASE_URL}/api/interview/report/${testSessionId}`, {
      headers: { Cookie: recruiterCookie },
    });
    const recReportData = await recReportRes.json();

    const candidateLeaked =
      candReportData.report?.shortlistNotes !== undefined &&
      candReportData.report?.shortlistNotes !== null &&
      candReportData.report?.shortlistNotes.length > 0;

    const recruiterReceived =
      recReportData.report?.shortlistNotes === privateNote;

    const passed = !candidateLeaked && recruiterReceived;

    results.push({
      name: "8. Private Notes Never Leaked to Candidates",
      passed,
      details: passed
        ? `Candidate received shortlistStatus='${candReportData.report?.shortlistStatus}' but shortlistNotes=undefined. Recruiter received full confidential note.`
        : `Failed: candidate received notes='${candReportData.report?.shortlistNotes}', recruiter received='${recReportData.report?.shortlistNotes}'`,
    });
  } catch (err: any) {
    results.push({
      name: "8. Private Notes Never Leaked to Candidates",
      passed: false,
      details: err.message,
    });
  }

  // 9. Client-supplied recruiter IDs cannot impersonate another recruiter
  try {
    const spoofedReviewerId = "fake-ceo-impersonation-id";
    const spoofedReviewedBy = "Fake CEO Executive";

    const res = await fetch(`${BASE_URL}/api/interview/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: recruiterCookie,
      },
      body: JSON.stringify({
        sessionId: testSessionId,
        status: "shortlisted",
        notes: "Testing spoofed credentials.",
        reviewerId: spoofedReviewerId,
        reviewedBy: spoofedReviewedBy,
      }),
    });

    const dbReview = await prisma.recruiterReview.findUnique({
      where: { sessionId: testSessionId },
    });

    const passed =
      res.ok &&
      dbReview?.reviewerId === recruiter.id &&
      dbReview?.reviewerId !== spoofedReviewerId &&
      dbReview?.reviewedBy === recruiter.name;

    results.push({
      name: "9. Impersonation Blocked (Identity Derived From Server Session)",
      passed,
      details: passed
        ? `Ignored client spoofing: DB reviewerId is authenticated user ${recruiter.id} (${recruiter.name}), not '${spoofedReviewerId}'`
        : `Failed: DB reviewerId=${dbReview?.reviewerId}`,
    });
  } catch (err: any) {
    results.push({
      name: "9. Impersonation Blocked (Identity Derived From Server Session)",
      passed: false,
      details: err.message,
    });
  }

  // 10. Missing or invalid candidate/report IDs handled safely
  try {
    // Missing sessionId
    const resNoId = await fetch(`${BASE_URL}/api/interview/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: recruiterCookie },
      body: JSON.stringify({ status: "shortlisted" }),
    });

    // Invalid status string
    const resBadStatus = await fetch(`${BASE_URL}/api/interview/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: recruiterCookie },
      body: JSON.stringify({ sessionId: testSessionId, status: "super-hire-unsupported" }),
    });

    // GET review with missing sessionId parameter
    const resGetNoId = await fetch(`${BASE_URL}/api/interview/review`, {
      headers: { Cookie: recruiterCookie },
    });

    const passed =
      resNoId.status === 400 &&
      resBadStatus.status === 400 &&
      resGetNoId.status === 400;

    results.push({
      name: "10. Input Validation & Error Handling (400 Bad Request)",
      passed,
      details: passed
        ? `Missing sessionId -> 400, Invalid status -> 400, Missing GET param -> 400`
        : `Failed: resNoId=${resNoId.status}, resBadStatus=${resBadStatus.status}, resGetNoId=${resGetNoId.status}`,
    });
  } catch (err: any) {
    results.push({
      name: "10. Input Validation & Error Handling (400 Bad Request)",
      passed: false,
      details: err.message,
    });
  }

  // 11. Demo benchmark candidates persist reviews & continue rendering
  try {
    const demoSessionId = "demo-session-alex";
    const demoNote = "Verified benchmark candidate: outstanding full-stack depth.";

    const reviewRes = await fetch(`${BASE_URL}/api/interview/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: recruiterCookie },
      body: JSON.stringify({
        sessionId: demoSessionId,
        candidateName: "Alex Rivera",
        status: "shortlisted",
        notes: demoNote,
      }),
    });

    const reportRes = await fetch(`${BASE_URL}/api/interview/report/${demoSessionId}`, {
      headers: { Cookie: recruiterCookie },
    });
    const reportData = await reportRes.json();

    const passed =
      reviewRes.ok &&
      reportRes.ok &&
      reportData.report?.sessionId === demoSessionId &&
      reportData.report?.candidateName === "Alex Rivera" &&
      reportData.report?.shortlistStatus === "shortlisted" &&
      reportData.report?.shortlistNotes === demoNote &&
      reportData.report?.overallScore === 88;

    results.push({
      name: "11. Demo Benchmark Candidates Support Persistent Reviews",
      passed,
      details: passed
        ? `Demo candidate Alex Rivera review persisted and correctly overlayed on benchmark dossier`
        : `Failed: reviewRes=${reviewRes.status}, reportRes=${reportRes.status}, data=${JSON.stringify(reportData)}`,
    });
  } catch (err: any) {
    results.push({
      name: "11. Demo Benchmark Candidates Support Persistent Reviews",
      passed: false,
      details: err.message,
    });
  }

  // 12. Existing Stage 5.3 authentication and Stage 5.4 reports intact
  try {
    const userCount = await prisma.user.count();
    const sessionCount = await prisma.interviewSession.count();
    const answerCount = await prisma.interviewAnswer.count();
    const reportCount = await prisma.evaluationReport.count();

    const passed =
      userCount >= 3 &&
      sessionCount >= 1 &&
      answerCount >= 1 &&
      reportCount >= 1;

    results.push({
      name: "12. Stage 5.3 Auth & Stage 5.4 Report/Session Behavior Intact",
      passed,
      details: passed
        ? `SQLite verified intact: ${userCount} users, ${sessionCount} sessions, ${answerCount} answers, ${reportCount} reports`
        : `Counts below expectation: users=${userCount}, sessions=${sessionCount}`,
    });
  } catch (err: any) {
    results.push({
      name: "12. Stage 5.3 Auth & Stage 5.4 Report/Session Behavior Intact",
      passed: false,
      details: err.message,
    });
  }

  // Print results
  console.log("\n=================== TEST RESULTS ===================");
  let allPass = true;
  for (const r of results) {
    const badge = r.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${badge} | ${r.name}`);
    if (r.details) {
      console.log(`       ${r.details}`);
    }
    if (!r.passed) allPass = false;
  }
  console.log("====================================================\n");

  if (!allPass) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
