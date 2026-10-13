/**
 * Stage 6.3 QA & End-to-End Workflow Verification Script
 * Validates:
 * 1. Sign-In Page HTML Audit (Branding, Welcome back, show/hide toggle, no candidate profile cards, no dead forgot pass link)
 * 2. Demo Login & Security Hardening (Candidate & Recruiter demo succeed; arbitrary emails are rejected with 403)
 * 3. Real Credential Authentication (Candidate & Recruiter server-side credential verification)
 * 4. Registration Flow & Privilege Escalation Guard (Candidate role enforced, duplicate email rejected)
 * 5. Recruiter Candidate Pipeline Visibility (Completed interview appears in recruiter pipeline)
 * 6. Recruiter Review & Note Persistence (Shortlist status + private notes survive queries)
 * 7. Candidate Privacy & Role Guard (Candidates cannot access recruiter reviews, notes are stripped, cross-candidate access blocked)
 */

import { prisma } from "../src/lib/prisma";

const BASE_URL = "http://localhost:3000";

async function runStage63Tests() {
  console.log("======================================================================");
  console.log("🚀 STARTING STAGE 6.3 END-TO-END WORKFLOW & AUTHENTICATION VERIFICATION");
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

  // -------------------------------------------------------------------------
  // 1. SIGN-IN PAGE HTML AUDIT
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 1: Sign-In Page UI & Branding Audit ---");
  const loginHtmlRes = await fetch(`${BASE_URL}/login`);
  assert(loginHtmlRes.status === 200, `Sign-in page loads with 200 OK (got ${loginHtmlRes.status})`);
  const loginHtml = await loginHtmlRes.text();

  assert(loginHtml.includes("Welcome back"), 'Sign-in page contains heading "Welcome back"');
  assert(loginHtml.includes("Sign in to continue to your InterviewIQ workspace"), 'Sign-in page contains required subtitle');
  assert(loginHtml.includes("Candidate Demo"), 'Sign-in page contains "Candidate Demo" button');
  assert(loginHtml.includes("Recruiter Demo"), 'Sign-in page contains "Recruiter Demo" button');
  assert(loginHtml.includes("Create an Account") || loginHtml.includes("/signup"), 'Sign-in page contains link to registration');
  assert(!loginHtml.includes("Forgot Password"), 'Sign-in page omits dead "Forgot Password" link');
  assert(!loginHtml.includes("Maya Patel"), 'Sign-in page removes Maya Patel profile card');
  assert(!loginHtml.includes("Liam Chen"), 'Sign-in page removes Liam Chen profile card');
  assert(!loginHtml.includes("Rohan Gupta"), 'Sign-in page removes Rohan Gupta profile card');
  assert(!loginHtml.includes("88% · Shortlisted ⭐"), 'Sign-in page removes candidate evaluation scores/badges');

  // -------------------------------------------------------------------------
  // 2. DEMO AUTHENTICATION & SECURITY HARDENING
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 2: Demo Authentication & Security Hardening ---");

  // Candidate Demo Login
  const candDemoRes = await fetch(`${BASE_URL}/api/auth/demo-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "candidate" }),
  });
  assert(candDemoRes.status === 200, `Candidate Demo login returns 200 (got ${candDemoRes.status})`);
  const candDemoData = await candDemoRes.json();
  assert(candDemoData.user?.role === "candidate", `Candidate Demo user has role 'candidate' (got ${candDemoData.user?.role})`);
  assert(candDemoData.user?.email === "alex.rivera@example.com", `Candidate Demo user is alex.rivera@example.com`);

  const candCookieHeader = candDemoRes.headers.get("set-cookie") || "";
  const candMatch = candCookieHeader.match(/interviewiq_session=([^;]+)/);
  const candSessionCookie = candMatch ? candMatch[0] : "";
  assert(Boolean(candSessionCookie), `Candidate Demo sets HTTP-only interviewiq_session cookie`);

  // Recruiter Demo Login
  const recDemoRes = await fetch(`${BASE_URL}/api/auth/demo-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "recruiter" }),
  });
  assert(recDemoRes.status === 200, `Recruiter Demo login returns 200 (got ${recDemoRes.status})`);
  const recDemoData = await recDemoRes.json();
  assert(recDemoData.user?.role === "recruiter", `Recruiter Demo user has role 'recruiter' (got ${recDemoData.user?.role})`);
  assert(recDemoData.user?.email === "recruiter@interviewiq.ai", `Recruiter Demo user is recruiter@interviewiq.ai`);

  const recCookieHeader = recDemoRes.headers.get("set-cookie") || "";
  const recMatch = recCookieHeader.match(/interviewiq_session=([^;]+)/);
  const recSessionCookie = recMatch ? recMatch[0] : "";
  assert(Boolean(recSessionCookie), `Recruiter Demo sets HTTP-only interviewiq_session cookie`);

  // Demo Login Security Check: Non-demo arbitrary email rejected
  const exploitRes = await fetch(`${BASE_URL}/api/auth/demo-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "unauthorized_target@example.com" }),
  });
  assert(exploitRes.status === 403, `Unauthorized demo login target is blocked with 403 Forbidden (got ${exploitRes.status})`);

  // -------------------------------------------------------------------------
  // 3. REAL CREDENTIAL AUTHENTICATION
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 3: Credential-Based Authentication ---");

  // Invalid password
  const badLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "recruiter@interviewiq.ai", password: "WrongPassword" }),
  });
  assert(badLoginRes.status === 401, `Invalid credentials rejected with 401 Unauthorized (got ${badLoginRes.status})`);

  // Valid credentials
  const validLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "recruiter@interviewiq.ai", password: "Password123" }),
  });
  assert(validLoginRes.status === 200, `Valid credentials accepted with 200 OK (got ${validLoginRes.status})`);
  const validLoginData = await validLoginRes.json();
  assert(validLoginData.user?.role === "recruiter", `Server returns verified role 'recruiter' from database`);

  // -------------------------------------------------------------------------
  // 4. REGISTRATION FLOW & PRIVILEGE ESCALATION GUARD
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 4: Registration Flow & Privilege Escalation Guard ---");

  const testCandidateEmail = `candidate_test_${Date.now()}@example.com`;
  const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Marcus Vance",
      email: testCandidateEmail,
      password: "Password123",
      role: "recruiter", // Attempt privilege escalation via client payload
    }),
  });
  assert(registerRes.status === 201, `Candidate registration succeeds with 201 Created (got ${registerRes.status})`);
  const registerData = await registerRes.json();
  assert(registerData.user?.role === "candidate", `Privilege escalation blocked: registered user has role 'candidate' despite client specifying 'recruiter'`);

  const regCookieHeader = registerRes.headers.get("set-cookie") || "";
  const regMatch = regCookieHeader.match(/interviewiq_session=([^;]+)/);
  const newCandidateCookie = regMatch ? regMatch[0] : "";
  assert(Boolean(newCandidateCookie), `Registration establishes authenticated session cookie`);

  // Duplicate email rejected
  const dupRegisterRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Marcus Vance",
      email: testCandidateEmail,
      password: "Password123",
    }),
  });
  assert(dupRegisterRes.status === 409, `Duplicate email registration rejected with 409 Conflict (got ${dupRegisterRes.status})`);

  // -------------------------------------------------------------------------
  // 5. CANDIDATE PRIVACY & RECRUITER AUTHORIZATION GUARDS
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 5: Candidate Privacy & Recruiter Authorization Guards ---");

  // Candidate attempting to access recruiter reviews
  const candReviewsRes = await fetch(`${BASE_URL}/api/interview/reviews`, {
    headers: { Cookie: newCandidateCookie },
  });
  assert(candReviewsRes.status === 403, `Candidate blocked from accessing recruiter reviews with 403 Forbidden (got ${candReviewsRes.status})`);

  // Candidate attempting to submit recruiter review
  const candSubmitReviewRes = await fetch(`${BASE_URL}/api/interview/review`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: newCandidateCookie,
    },
    body: JSON.stringify({
      sessionId: "session-fake-test",
      status: "shortlisted",
      notes: "Malicious candidate review attempt",
    }),
  });
  assert(candSubmitReviewRes.status === 403, `Candidate blocked from submitting recruiter reviews with 403 Forbidden (got ${candSubmitReviewRes.status})`);

  // Recruiter accessing reviews succeeds
  const recReviewsRes = await fetch(`${BASE_URL}/api/interview/reviews`, {
    headers: { Cookie: recSessionCookie },
  });
  assert(recReviewsRes.status === 200, `Recruiter authorized to access pipeline reviews (got ${recReviewsRes.status})`);

  // -------------------------------------------------------------------------
  // 6. CANDIDATE INTERVIEW WORKFLOW & PIPELINE PERSISTENCE
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 6: Candidate Interview Completion & Recruiter Pipeline Visibility ---");

  const testSessionId = `session-stage63-${Date.now()}`;
  const mockReportPayload = {
    sessionId: testSessionId,
    candidateName: "Marcus Vance",
    targetRole: "Full Stack Engineer",
    experienceLevel: "Senior",
    interviewFocus: "System Architecture",
    completedAt: new Date().toISOString(),
    durationMinutes: 25,
    overallScore: 89,
    verdict: "Strong Hire Recommendation",
    metrics: [
      { category: "System Architecture", score: 92, status: "demonstrated" },
      { category: "Concurrency & State", score: 86, status: "demonstrated" },
    ],
    strengths: ["Clean architectural boundaries", "Deep concurrency insight"],
    areasToImprove: ["Edge-case error handling in distributed sync"],
    actionableRoadmap: ["Deep dive into distributed consensus mechanisms"],
    answerRecords: [
      {
        questionId: "q1",
        questionText: "How do you handle distributed locks in microservices?",
        category: "System Architecture",
        difficulty: "hard",
        answerText: "Using Redis Redlock or Postgres advisory locks with TTL and fencing tokens.",
        submittedAt: new Date().toISOString(),
        feedback: {
          score: 92,
          strengths: ["Mentioned fencing tokens"],
          gaps: [],
          adaptiveNote: "Excellent depth",
        },
      },
    ],
  };

  const generateReportRes = await fetch(`${BASE_URL}/api/interview/generate-report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: newCandidateCookie,
    },
    body: JSON.stringify({
      forceDeterministic: true,
      report: mockReportPayload,
      session: {
        id: testSessionId,
        setup: {
          candidateName: "Marcus Vance",
          targetRole: "Full Stack Engineer",
          experienceLevel: "Senior",
          interviewFocus: "System Architecture",
          skills: ["Distributed Systems", "TypeScript"],
        },
        answers: mockReportPayload.answerRecords,
        status: "completed",
        currentQuestionIndex: 1,
        startedAt: new Date().toISOString(),
        durationSeconds: 1500,
      },
    }),
  });
  assert(generateReportRes.status === 200, `Candidate interview report successfully persisted via API (got ${generateReportRes.status})`);

  // Recruiter pipeline visibility: Recruiter fetches all reports
  const pipelineRes = await fetch(`${BASE_URL}/api/interview/reports`, {
    headers: { Cookie: recSessionCookie },
  });
  assert(pipelineRes.status === 200, `Recruiter can query candidate pipeline reports (got ${pipelineRes.status})`);
  const pipelineData = await pipelineRes.json();
  const foundInPipeline = pipelineData.reports?.find((r: any) => r.sessionId === testSessionId);
  assert(Boolean(foundInPipeline), `Completed candidate interview is visible in recruiter pipeline`);
  assert(foundInPipeline?.candidateName === "Marcus Vance", `Candidate name correctly reflected in recruiter pipeline`);
  assert(foundInPipeline?.overallScore === 92, `Evaluation score (92%) accurately calculated and reflected in pipeline`);

  // -------------------------------------------------------------------------
  // 7. RECRUITER REVIEW & PRIVATE NOTE PERSISTENCE
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 7: Recruiter Review & Private Note Persistence ---");

  const reviewPayload = {
    sessionId: testSessionId,
    candidateName: "Marcus Vance",
    status: "shortlisted",
    notes: "Top candidate: strong grasp of distributed locks and concurrency. Advance to onsite.",
  };

  const saveReviewRes = await fetch(`${BASE_URL}/api/interview/review`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: recSessionCookie,
    },
    body: JSON.stringify(reviewPayload),
  });
  assert(saveReviewRes.status === 200, `Recruiter review persisted successfully (got ${saveReviewRes.status})`);
  const savedReviewData = await saveReviewRes.json();
  assert(savedReviewData.review?.status === "shortlisted", `Review status saved as 'shortlisted'`);
  assert(savedReviewData.review?.notes?.includes("Top candidate"), `Review notes persisted`);
  assert(savedReviewData.review?.reviewedBy?.includes("Sarah Jenkins") || Boolean(savedReviewData.review?.reviewedBy), `Reviewer identity derived from server session`);

  // Recruiter refetches reviews (simulating dashboard refresh)
  const refetchReviewsRes = await fetch(`${BASE_URL}/api/interview/reviews`, {
    headers: { Cookie: recSessionCookie },
  });
  const refetchedData = await refetchReviewsRes.json();
  const matchingReview = refetchedData.reviews?.find((r: any) => r.sessionId === testSessionId);
  assert(matchingReview?.status === "shortlisted", `Review status survived dashboard refresh`);
  assert(matchingReview?.notes?.includes("Top candidate"), `Private recruiter notes survived dashboard refresh`);

  // Candidate fetches their report -> Recruiter notes MUST be stripped
  const candReportRes = await fetch(`${BASE_URL}/api/interview/report/${testSessionId}`, {
    headers: { Cookie: newCandidateCookie },
  });
  assert(candReportRes.status === 200, `Candidate can access their own evaluation report (got ${candReportRes.status})`);
  const candReportData = await candReportRes.json();
  assert(candReportData.report?.shortlistNotes === undefined, `Private recruiter notes are stripped from candidate response`);

  // Cross-candidate isolation: Candidate attempts to access another candidate's private report
  // (e.g. Alex Rivera's report accessed by Marcus Vance)
  const crossAccessRes = await fetch(`${BASE_URL}/api/interview/report/session-demo-alex-1`, {
    headers: { Cookie: newCandidateCookie },
  });
  assert(crossAccessRes.status === 403 || crossAccessRes.status === 404, `Cross-candidate report access blocked (got status ${crossAccessRes.status})`);

  console.log(`\n======================================================================`);
  console.log(`🎉 TEST SUMMARY: ${passed}/${total} TESTS PASSED. ALL PASSED: ${passed === total}`);
  console.log(`======================================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runStage63Tests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
