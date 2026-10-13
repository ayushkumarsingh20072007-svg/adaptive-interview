/**
 * Stage 2B.1 Guest Isolation, Report Authorization & Concurrency Audit Test Suite
 *
 * Tests all 10 audit vectors:
 *  1.  Anonymous access to private candidate session → 403
 *  2.  Anonymous access to private candidate report → 403
 *  3.  Anonymous report generation → 403
 *  4.  Anonymous question generation for private session → 403
 *  5.  Cross-candidate session read (Maya reads Alex) → 403
 *  6.  Cross-candidate report read (Maya reads Alex) → 403
 *  7.  Cross-candidate answer injection (Maya → Alex session) → 403
 *  8.  Cross-candidate generate-report (Maya → Alex session) → 403
 *  9.  Cross-candidate generate-question (Maya → Alex session) → 403
 * 10.  forceRegenerate authorization (anon + cross-candidate → 403)
 * 11.  Report generation for in-progress session → 400
 * 12.  Terminal status immutability (completed cannot revert to in-progress)
 * 13.  Candidate cannot see recruiter shortlistNotes
 * 14.  Candidate CAN see shortlistStatus
 * 15.  Recruiter CAN see shortlistNotes
 * 16.  Concurrent duplicate answer submissions → exactly 1 DB row
 * 17.  Legitimate demo question generation works for anonymous user
 * 18.  Public demo report (demo-session-alex) accessible anonymously
 * 19.  Guest session answers persist without auth
 * 20.  Recruiter can read any candidate's completed report
 */

import { prisma } from "../src/lib/prisma.ts";

const BASE_URL = "http://localhost:3000";

async function run() {
  console.log("======================================================================");
  console.log("🔒 STAGE 2B.1 — GUEST ISOLATION, AUTHORIZATION & CONCURRENCY AUDIT");
  console.log("======================================================================\n");

  let passed = 0;
  let failed = 0;
  let total = 0;
  const failures: string[] = [];

  function assert(condition: boolean, msg: string, extra?: string) {
    total++;
    if (condition) {
      console.log(`✅ PASS | [${total}] ${msg}`);
      passed++;
    } else {
      const detail = extra ? ` — ${extra}` : "";
      console.error(`❌ FAIL | [${total}] ${msg}${detail}`);
      failures.push(`[${total}] ${msg}${detail}`);
      failed++;
      process.exitCode = 1;
    }
  }

  async function parseJson(r: Response) {
    try { return await r.json(); } catch { return null; }
  }

  // ── Auth helpers ─────────────────────────────────────────────────────────
  async function getCookie(email: string): Promise<string> {
    let res = await fetch(`${BASE_URL}/api/auth/demo-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "Password123" }),
      });
    }
    const raw = res.headers.get("set-cookie") || "";
    const m = raw.match(/interviewiq_session=([^;]+)/);
    return m ? m[0] : "";
  }

  const alexCookie = await getCookie("alex.rivera@example.com");
  const mayaCookie = await getCookie("maya.patel@example.com");
  const recruiterCookie = await getCookie("recruiter@interviewiq.ai");

  assert(Boolean(alexCookie), "Cookie obtained for Alex Rivera (Candidate A)");
  assert(Boolean(mayaCookie), "Cookie obtained for Maya Patel (Candidate B)");
  assert(Boolean(recruiterCookie), "Cookie obtained for recruiter Sarah Jenkins");

  const alexUser = await prisma.user.findUnique({ where: { email: "alex.rivera@example.com" } });
  const mayaUser = await prisma.user.findUnique({ where: { email: "maya.patel@example.com" } });

  if (!alexUser || !mayaUser) {
    console.error("FATAL: Cannot find seed users in DB. Run seed first.");
    process.exit(1);
  }

  // ── Seed: shared test sessions ───────────────────────────────────────────
  const privateSessionId = `audit-priv-${Date.now()}`;
  const completedSessionId = `audit-done-${Date.now()}`;
  const guestSessionId = `audit-guest-${Date.now()}`;
  const concurrencySessionId = `audit-conc-${Date.now()}`;

  const sessionBase = (id: string, status: string, extra = {}) => ({
    id,
    setup: {
      candidateName: "Alex Rivera",
      targetRole: "fullstack",
      experienceLevel: "senior",
      interviewFocus: "mixed",
      interviewLength: 20,
      skills: ["React"],
      isSampleResume: false,
      ...extra,
    },
    status,
    durationSeconds: status === "completed" ? 600 : 0,
    answers: [],
  });

  const makeAnswer = (questionId: string, text: string) => ({
    questionId,
    questionText: `Question for ${questionId}`,
    category: "Frontend",
    difficulty: "intermediate",
    answerText: text,
    submittedAt: new Date().toISOString(),
    feedback: { score: 80, strengths: ["Good"], gaps: [], adaptiveNote: "" },
  });

  const postSession = (session: any, cookie?: string) =>
    fetch(`${BASE_URL}/api/interview/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify({ session }),
    });

  const postAnswer = (sessionId: string, answer: any, cookie?: string) =>
    fetch(`${BASE_URL}/api/interview/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify({ sessionId, answer }),
    });

  // Create private in-progress session owned by Alex
  await postSession(sessionBase(privateSessionId, "in-progress"), alexCookie);
  await postAnswer(privateSessionId, makeAnswer("audit-q1", "React uses virtual DOM diffing."), alexCookie);

  // Create completed session owned by Alex + persist its answer + persist its report row
  await postSession(sessionBase(completedSessionId, "completed"), alexCookie);
  await postAnswer(completedSessionId, makeAnswer("done-q1", "Hoisting moves declarations to the top."), alexCookie);

  // Persist an EvaluationReport row so report-read tests have real data to return
  await prisma.evaluationReport.upsert({
    where: { sessionId: completedSessionId },
    create: {
      session: { connect: { id: completedSessionId } },
      candidateName: "Alex Rivera",
      targetRole: "fullstack",
      experienceLevel: "senior",
      interviewFocus: "mixed",
      completedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      durationMinutes: 10,
      overallScore: 80,
      verdict: "Hire Recommendation",
      metrics: "[]",
      strengths: "[]",
      areasToImprove: "[]",
      actionableRoadmap: "[]",
      isDemoSimulation: false,
      integrityStatus: "verified_clean",
    },
    update: {},
  });

  // Create guest session (no cookie)
  await postSession({
    ...sessionBase(guestSessionId, "in-progress"),
    setup: { ...sessionBase(guestSessionId, "in-progress").setup, isSampleResume: true },
  });

  // Create concurrency test session owned by Alex
  await postSession(sessionBase(concurrencySessionId, "in-progress"), alexCookie);

  // ── GROUP 1: Anonymous access to private resources ───────────────────────
  console.log("\n--- GROUP 1: Anonymous access to private resources ---");

  const anonSessionGet = await fetch(`${BASE_URL}/api/interview/session?id=${privateSessionId}`);
  assert(anonSessionGet.status === 403, "1.  Anonymous GET of private session → 403", `got ${anonSessionGet.status}`);

  const anonReportGet = await fetch(`${BASE_URL}/api/interview/report/${completedSessionId}`);
  assert(anonReportGet.status === 403, "2.  Anonymous GET of private report → 403", `got ${anonReportGet.status}`);

  const anonGenReport = await fetch(`${BASE_URL}/api/interview/generate-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session: sessionBase(completedSessionId, "completed"),
    }),
  });
  assert(anonGenReport.status === 403, "3.  Anonymous POST generate-report for private session → 403", `got ${anonGenReport.status}`);

  const anonGenQ = await fetch(`${BASE_URL}/api/interview/generate-question`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: privateSessionId,
      setup: sessionBase(privateSessionId, "in-progress").setup,
      previousQuestions: [],
    }),
  });
  assert(anonGenQ.status === 403, "4.  Anonymous POST generate-question for private session → 403", `got ${anonGenQ.status}`);

  // ── GROUP 2: Cross-candidate isolation ────────────────────────────────────
  console.log("\n--- GROUP 2: Cross-candidate isolation (Candidate B → Candidate A) ---");

  const mayaSessionGet = await fetch(`${BASE_URL}/api/interview/session?id=${privateSessionId}`, {
    headers: { Cookie: mayaCookie },
  });
  assert(mayaSessionGet.status === 403, "5.  Candidate B reads Candidate A session → 403", `got ${mayaSessionGet.status}`);

  const mayaReportGet = await fetch(`${BASE_URL}/api/interview/report/${completedSessionId}`, {
    headers: { Cookie: mayaCookie },
  });
  assert(mayaReportGet.status === 403, "6.  Candidate B reads Candidate A report → 403", `got ${mayaReportGet.status}`);

  const mayaAnswerInject = await postAnswer(privateSessionId, makeAnswer("inject-q99", "Injected by Maya"), mayaCookie);
  assert(mayaAnswerInject.status === 403, "7.  Candidate B injects answer into Candidate A session → 403", `got ${mayaAnswerInject.status}`);

  const mayaGenReport = await fetch(`${BASE_URL}/api/interview/generate-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: mayaCookie },
    body: JSON.stringify({ session: sessionBase(completedSessionId, "completed") }),
  });
  assert(mayaGenReport.status === 403, "8.  Candidate B POST generate-report for Candidate A → 403", `got ${mayaGenReport.status}`);

  const mayaGenQuestion = await fetch(`${BASE_URL}/api/interview/generate-question`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: mayaCookie },
    body: JSON.stringify({
      sessionId: privateSessionId,
      setup: sessionBase(privateSessionId, "in-progress").setup,
      previousQuestions: [],
    }),
  });
  assert(mayaGenQuestion.status === 403, "9.  Candidate B POST generate-question for Candidate A → 403", `got ${mayaGenQuestion.status}`);

  // ── GROUP 3: forceRegenerate authorization ────────────────────────────────
  console.log("\n--- GROUP 3: forceRegenerate authorization ---");

  const anonForceRegen = await fetch(`${BASE_URL}/api/interview/generate-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ forceRegenerate: true, session: sessionBase(completedSessionId, "completed") }),
  });
  assert(anonForceRegen.status === 403, "10a. Anonymous forceRegenerate for private session → 403", `got ${anonForceRegen.status}`);

  const mayaForceRegen = await fetch(`${BASE_URL}/api/interview/generate-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: mayaCookie },
    body: JSON.stringify({ forceRegenerate: true, session: sessionBase(completedSessionId, "completed") }),
  });
  assert(mayaForceRegen.status === 403, "10b. Candidate B forceRegenerate for Candidate A → 403", `got ${mayaForceRegen.status}`);

  // ── GROUP 4: In-progress session blocks report generation ─────────────────
  console.log("\n--- GROUP 4: In-progress session cannot generate report ---");

  const inProgressReport = await fetch(`${BASE_URL}/api/interview/generate-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: alexCookie },
    body: JSON.stringify({ session: sessionBase(privateSessionId, "in-progress") }),
  });
  const inProgressBody = await parseJson(inProgressReport);
  assert(
    inProgressReport.status === 400,
    "11.  Generate report for in-progress session → 400",
    `got ${inProgressReport.status}: ${inProgressBody?.error}`
  );

  // ── GROUP 5: Terminal status immutability ─────────────────────────────────
  console.log("\n--- GROUP 5: Terminal status immutability ---");

  await postSession(sessionBase(completedSessionId, "in-progress"), alexCookie);
  const dbCompleted = await prisma.interviewSession.findUnique({ where: { id: completedSessionId } });
  assert(
    dbCompleted?.status === "completed",
    "12.  Completed session remains 'completed' after re-POST with 'in-progress'",
    `DB status: ${dbCompleted?.status}`
  );

  // ── GROUP 6: Recruiter note privacy ───────────────────────────────────────
  console.log("\n--- GROUP 6: Recruiter note privacy ---");

  const recruiterReview = await fetch(`${BASE_URL}/api/interview/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: recruiterCookie },
    body: JSON.stringify({
      sessionId: completedSessionId,
      candidateName: "Alex Rivera",
      status: "shortlisted",
      notes: "RECRUITER_PRIVATE_NOTE: Do not expose this.",
    }),
  });
  assert(recruiterReview.status === 200, "13.  Recruiter can POST review with private notes (200)", `got ${recruiterReview.status}`);

  const alexReport = await fetch(`${BASE_URL}/api/interview/report/${completedSessionId}`, {
    headers: { Cookie: alexCookie },
  });
  const alexReportData = (await parseJson(alexReport))?.report;
  assert(
    alexReport.status === 200,
    "14.  Candidate reads own report → 200",
    `got ${alexReport.status}`
  );
  assert(
    !alexReportData?.shortlistNotes,
    "14b. Candidate report does NOT expose shortlistNotes",
    `shortlistNotes = ${JSON.stringify(alexReportData?.shortlistNotes)}`
  );
  assert(
    alexReportData?.shortlistStatus === "shortlisted",
    "14c. Candidate CAN see shortlistStatus = 'shortlisted'",
    `shortlistStatus = ${alexReportData?.shortlistStatus}`
  );

  const recruiterReport = await fetch(`${BASE_URL}/api/interview/report/${completedSessionId}`, {
    headers: { Cookie: recruiterCookie },
  });
  const recruiterReportData = (await parseJson(recruiterReport))?.report;
  assert(
    recruiterReport.status === 200,
    "15.  Recruiter reads completed report → 200",
    `got ${recruiterReport.status}`
  );
  assert(
    typeof recruiterReportData?.shortlistNotes === "string" &&
      recruiterReportData.shortlistNotes.includes("RECRUITER_PRIVATE_NOTE"),
    "15b. Recruiter CAN see shortlistNotes",
    `shortlistNotes = ${JSON.stringify(recruiterReportData?.shortlistNotes)}`
  );

  // ── GROUP 7: Concurrent duplicate answer deduplication ────────────────────
  console.log("\n--- GROUP 7: Concurrent duplicate answer deduplication ---");

  const duplicateAnswer = makeAnswer("conc-q1", "It is syntactic sugar over Promises.");
  const concurrentReqs = Array.from({ length: 5 }, () =>
    postAnswer(concurrencySessionId, duplicateAnswer, alexCookie)
  );
  const concResults = await Promise.allSettled(concurrentReqs);
  const successCount = concResults.filter((r) => r.status === "fulfilled" && (r.value as Response).status === 200).length;

  await new Promise((r) => setTimeout(r, 300));

  const dbAnswerRows = await prisma.interviewAnswer.findMany({
    where: { sessionId: concurrencySessionId, questionId: "conc-q1" },
  });
  assert(successCount >= 1, `16.  At least 1 of 5 concurrent POSTs succeeded (${successCount}/5)`, `${successCount}/5`);
  assert(dbAnswerRows.length === 1, `16b. Concurrent duplicates produce exactly 1 DB row (got ${dbAnswerRows.length})`, `rows: ${dbAnswerRows.length}`);

  // ── GROUP 8: Legitimate demo workflow ─────────────────────────────────────
  console.log("\n--- GROUP 8: Legitimate demo workflow ---");

  const demoQ = await fetch(`${BASE_URL}/api/interview/generate-question`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      setup: { candidateName: "Demo Candidate", targetRole: "fullstack", experienceLevel: "intermediate", interviewFocus: "mixed", interviewLength: 10, skills: ["React"], isSampleResume: true },
      previousQuestions: [],
    }),
  });
  assert(demoQ.status === 200, "17.  Anonymous user generates questions for demo session → 200", `got ${demoQ.status}`);

  const publicDemoReport = await fetch(`${BASE_URL}/api/interview/report/demo-session-alex`);
  assert(publicDemoReport.status === 200, "18.  Public demo-session-alex report accessible anonymously → 200", `got ${publicDemoReport.status}`);

  await postAnswer(guestSessionId, makeAnswer("guest-q1", "A closure retains access to its outer scope."));
  const guestDbAnswer = await prisma.interviewAnswer.findFirst({ where: { sessionId: guestSessionId, questionId: "guest-q1" } });
  assert(Boolean(guestDbAnswer), "19.  Guest session answer persisted without auth", `row id: ${guestDbAnswer?.id}`);

  // ── GROUP 9: Recruiter authorized access ──────────────────────────────────
  console.log("\n--- GROUP 9: Recruiter authorized access ---");

  const recruiterReadAlex = await fetch(`${BASE_URL}/api/interview/report/${completedSessionId}`, {
    headers: { Cookie: recruiterCookie },
  });
  assert(recruiterReadAlex.status === 200, "20.  Recruiter can read any candidate's report → 200", `got ${recruiterReadAlex.status}`);

  // ── Cleanup ──────────────────────────────────────────────────────────────
  const testIds = [privateSessionId, completedSessionId, guestSessionId, concurrencySessionId];
  await prisma.evaluationReport.deleteMany({ where: { sessionId: { in: testIds } } });
  await prisma.interviewAnswer.deleteMany({ where: { sessionId: { in: testIds } } });
  await prisma.recruiterReview.deleteMany({ where: { sessionId: { in: testIds } } });
  await prisma.interviewSession.deleteMany({ where: { id: { in: testIds } } });

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n======================================================================");
  console.log(`🔒 STAGE 2B.1 AUDIT COMPLETE`);
  console.log(`   PASSED:  ${passed}/${total}`);
  console.log(`   FAILED:  ${failed}/${total}`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(`   • ${f}`));
  }
  console.log("======================================================================\n");
}

run()
  .catch((err) => { console.error("FATAL:", err); process.exit(1); })
  .finally(() => prisma.$disconnect());
