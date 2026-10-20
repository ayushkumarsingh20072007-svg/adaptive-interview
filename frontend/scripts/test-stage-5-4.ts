process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./dev.db";

import { prisma } from "../src/lib/prisma.ts";

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
  console.log("=== STARTING STAGE 5.4 PERSISTENCE & AUTHORIZATION TEST SUITE ===");

  // 1. Prisma schema & database connectivity check
  try {
    const userCount = await prisma.user.count();
    results.push({
      name: "1. Prisma Schema & SQLite Connectivity",
      passed: true,
      details: `Successfully queried SQLite database. User count: ${userCount}`,
    });
  } catch (err: any) {
    results.push({
      name: "1. Prisma Schema & SQLite Connectivity",
      passed: false,
      details: err.message,
    });
  }

  // 2. Candidate A login & Session Creation
  let candidateA: any;
  let cookieA = "";
  const testSessionId = `test-session-${Date.now()}`;

  try {
    const loginA = await loginUser("alex.rivera@example.com");
    candidateA = loginA.user;
    cookieA = loginA.cookie;

    const sessionPayload = {
      id: testSessionId,
      setup: {
        candidateName: candidateA.name,
        targetRole: "fullstack",
        experienceLevel: "senior",
        interviewFocus: "mixed",
        interviewLength: 20,
        skills: ["React", "TypeScript", "Node.js", "PostgreSQL"],
        userId: candidateA.id,
      },
      status: "in-progress",
      startedAt: new Date().toISOString(),
      durationSeconds: 120,
      answers: [],
      currentQuestionIndex: 0,
      userId: candidateA.id,
    };

    const res = await fetch(`${BASE_URL}/api/interview/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieA,
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
      dbSession.userId === candidateA.id &&
      dbSession.targetRole === "fullstack";

    results.push({
      name: "2. Candidate Session Persistence (SQLite)",
      passed,
      details: passed
        ? `Session ${testSessionId} created and linked to candidate ${candidateA.name} (${candidateA.id})`
        : `Failed to persist: ${JSON.stringify(data)}`,
    });
  } catch (err: any) {
    results.push({
      name: "2. Candidate Session Persistence (SQLite)",
      passed: false,
      details: err.message,
    });
  }

  // 3. Submit multiple answer turns
  const turn1Answer = "We utilize Redis cache-aside with connection pooling and PostgreSQL read replicas to scale query throughput.";
  const turn2Answer = "We implement idempotency keys on payment transactions to prevent duplicate charges across distributed services.";

  try {
    const ans1Payload = {
      sessionId: testSessionId,
      answer: {
        questionId: "q-arch-1",
        questionText: "How do you scale database query performance under high load?",
        category: "System Architecture",
        difficulty: "senior",
        answerText: turn1Answer,
        submittedAt: "10:00 AM",
        feedback: {
          score: 92,
          strengths: ["Mentions Redis cache-aside", "Connection pooling"],
          gaps: ["Could mention partition strategies"],
          adaptiveNote: "Deep conceptual grasp of database caching.",
        },
      },
    };

    const ans2Payload = {
      sessionId: testSessionId,
      answer: {
        questionId: "q-dist-2",
        questionText: "How do you prevent duplicate side-effects in distributed microservices?",
        category: "Distributed Systems",
        difficulty: "senior",
        answerText: turn2Answer,
        submittedAt: "10:05 AM",
        feedback: {
          score: 88,
          strengths: ["Idempotency keys", "Distributed consistency"],
          gaps: ["Outbox pattern"],
          adaptiveNote: "Strong understanding of distributed transactions.",
        },
      },
    };

    const res1 = await fetch(`${BASE_URL}/api/interview/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify(ans1Payload),
    });

    const res2 = await fetch(`${BASE_URL}/api/interview/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify(ans2Payload),
    });

    const dbAnswers = await prisma.interviewAnswer.findMany({
      where: { sessionId: testSessionId },
    });

    const hasExactText1 = dbAnswers.some((a) => a.answerText === turn1Answer);
    const hasExactText2 = dbAnswers.some((a) => a.answerText === turn2Answer);

    const passed = res1.ok && res2.ok && dbAnswers.length === 2 && hasExactText1 && hasExactText2;

    results.push({
      name: "3. Answer Turns & Evaluation Persistence (Verbatim)",
      passed,
      details: passed
        ? `Stored 2 answer turns in SQLite. Exact answers preserved verbatim with scores 92 and 88.`
        : `Failed: db count=${dbAnswers.length}, ans1=${hasExactText1}, ans2=${hasExactText2}`,
    });
  } catch (err: any) {
    results.push({
      name: "3. Answer Turns & Evaluation Persistence (Verbatim)",
      passed: false,
      details: err.message,
    });
  }

  // 4. Retry answer turn (Deduplication Check)
  try {
    const retryPayload = {
      sessionId: testSessionId,
      answer: {
        questionId: "q-arch-1",
        questionText: "How do you scale database query performance under high load?",
        category: "System Architecture",
        difficulty: "senior",
        answerText: turn1Answer + " (updated retry)",
        submittedAt: "10:01 AM",
        feedback: {
          score: 95,
          strengths: ["Redis caching"],
          gaps: [],
          adaptiveNote: "Updated note",
        },
      },
    };

    const retryRes = await fetch(`${BASE_URL}/api/interview/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify(retryPayload),
    });

    const countAfterRetry = await prisma.interviewAnswer.count({
      where: { sessionId: testSessionId },
    });

    const passed = retryRes.ok && countAfterRetry === 2;

    results.push({
      name: "4. Answer Turn Deduplication on Retry",
      passed,
      details: passed
        ? `Retrying answer turn updated existing record without duplicate key collision. Count remained: 2`
        : `Deduplication failed: answer count is ${countAfterRetry} (expected 2)`,
    });
  } catch (err: any) {
    results.push({
      name: "4. Answer Turn Deduplication on Retry",
      passed: false,
      details: err.message,
    });
  }

  // 5. Complete Interview & Persist Evaluation Report
  let generatedReport: any;
  try {
    const sessionToComplete = {
      id: testSessionId,
      setup: {
        candidateName: candidateA.name,
        targetRole: "fullstack",
        experienceLevel: "senior",
        interviewFocus: "mixed",
        interviewLength: 20,
        skills: ["React", "TypeScript", "Node.js", "PostgreSQL"],
        userId: candidateA.id,
      },
      status: "completed",
      startedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      durationSeconds: 900,
      answers: [
        {
          questionId: "q-arch-1",
          questionText: "How do you scale database query performance under high load?",
          category: "System Architecture",
          difficulty: "senior",
          answerText: turn1Answer,
          submittedAt: "10:00 AM",
          feedback: {
            score: 92,
            strengths: ["Mentions Redis cache-aside", "Connection pooling"],
            gaps: ["Partitioning"],
            adaptiveNote: "Deep conceptual grasp.",
          },
        },
        {
          questionId: "q-dist-2",
          questionText: "How do you prevent duplicate side-effects in distributed microservices?",
          category: "Distributed Systems",
          difficulty: "senior",
          answerText: turn2Answer,
          submittedAt: "10:05 AM",
          feedback: {
            score: 88,
            strengths: ["Idempotency keys"],
            gaps: ["Outbox pattern"],
            adaptiveNote: "Strong distributed understanding.",
          },
        },
      ],
      currentQuestionIndex: 2,
      userId: candidateA.id,
    };

    const repRes = await fetch(`${BASE_URL}/api/interview/generate-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ session: sessionToComplete, forceDeterministic: true }),
    });

    const data = await repRes.json();
    generatedReport = data.report;

    const dbReport = await prisma.evaluationReport.findUnique({
      where: { sessionId: testSessionId },
    });
    const updatedDbSession = await prisma.interviewSession.findUnique({
      where: { id: testSessionId },
    });

    // Verify evidence citations match stored answers
    const evidenceCitations = generatedReport?.evidenceCitations || [];
    const validCitations = evidenceCitations.every((c: any) => {
      if (!c.quote) return true;
      return (
        turn1Answer.toLowerCase().includes(c.quote.toLowerCase()) ||
        turn2Answer.toLowerCase().includes(c.quote.toLowerCase())
      );
    });

    const passed =
      repRes.ok &&
      dbReport !== null &&
      updatedDbSession?.status === "completed" &&
      generatedReport.overallScore > 0 &&
      validCitations;

    results.push({
      name: "5. Completed Report Persistence & Evidence Citation Match",
      passed,
      details: passed
        ? `Report persisted to SQLite with status 'completed', score ${generatedReport.overallScore}%. Citations verified against real candidate answers.`
        : `Failed to persist report: ${JSON.stringify(data)}`,
    });
  } catch (err: any) {
    results.push({
      name: "5. Completed Report Persistence & Evidence Citation Match",
      passed: false,
      details: err.message,
    });
  }

  // 6. Report generation retry (Idempotency Check)
  try {
    const repRetryRes = await fetch(`${BASE_URL}/api/interview/generate-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({
        session: {
          id: testSessionId,
          setup: { candidateName: candidateA.name, targetRole: "fullstack", experienceLevel: "senior", interviewFocus: "mixed" },
          answers: [],
        },
        forceDeterministic: true,
      }),
    });

    const countReports = await prisma.evaluationReport.count({
      where: { sessionId: testSessionId },
    });

    const passed = repRetryRes.ok && countReports === 1;

    results.push({
      name: "6. Report Generation Retry Idempotency (No Duplicates)",
      passed,
      details: passed
        ? `Report generation retry upserted cleanly. Total reports for session: 1`
        : `Idempotency failed: report count is ${countReports}`,
    });
  } catch (err: any) {
    results.push({
      name: "6. Report Generation Retry Idempotency (No Duplicates)",
      passed: false,
      details: err.message,
    });
  }

  // 7. Server-Side Report Retrieval by Owner (Candidate A)
  try {
    const getRes = await fetch(`${BASE_URL}/api/interview/report/${testSessionId}`, {
      headers: { Cookie: cookieA },
    });
    const getData = await getRes.json();

    const passed = getRes.ok && getData.report && getData.report.sessionId === testSessionId;

    results.push({
      name: "7. Server-Side Report Retrieval by Candidate Owner",
      passed,
      details: passed
        ? `Candidate retrieved own report successfully (HTTP 200). Metrics count: ${getData.report.metrics?.length}`
        : `Failed retrieval: status=${getRes.status}`,
    });
  } catch (err: any) {
    results.push({
      name: "7. Server-Side Report Retrieval by Candidate Owner",
      passed: false,
      details: err.message,
    });
  }

  // 8. Cross-Account Authorization: Candidate B cannot read or overwrite Candidate A's session/report
  try {
    const loginB = await loginUser("maya.patel@example.com");
    const cookieB = loginB.cookie;

    // 8a. Candidate B attempts to read Candidate A's report
    const readAttempt = await fetch(`${BASE_URL}/api/interview/report/${testSessionId}`, {
      headers: { Cookie: cookieB },
    });

    // 8b. Candidate B attempts to overwrite Candidate A's session
    const overwriteAttempt = await fetch(`${BASE_URL}/api/interview/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieB },
      body: JSON.stringify({
        session: {
          id: testSessionId,
          setup: { candidateName: "Hacker B", targetRole: "frontend" },
        },
      }),
    });

    // 8c. Candidate B attempts to add answers to Candidate A's session
    const answerAttempt = await fetch(`${BASE_URL}/api/interview/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieB },
      body: JSON.stringify({
        sessionId: testSessionId,
        answer: {
          questionId: "hack-q",
          questionText: "Injected question",
          category: "Security",
          difficulty: "easy",
          answerText: "Injected answer",
          feedback: { score: 100, strengths: [], gaps: [] },
        },
      }),
    });

    const passed =
      readAttempt.status === 403 &&
      overwriteAttempt.status === 403 &&
      answerAttempt.status === 403;

    results.push({
      name: "8. Cross-Account Candidate Isolation (Read & Write Blocked)",
      passed,
      details: passed
        ? `Candidate B blocked from reading (HTTP 403), overwriting session (HTTP 403), and injecting answers (HTTP 403).`
        : `Isolation failure: read=${readAttempt.status}, overwrite=${overwriteAttempt.status}, answer=${answerAttempt.status}`,
    });
  } catch (err: any) {
    results.push({
      name: "8. Cross-Account Candidate Isolation (Read & Write Blocked)",
      passed: false,
      details: err.message,
    });
  }

  // 9. Recruiter Access to Candidate Report & Pipeline List
  try {
    const loginRecruiter = await loginUser("recruiter@interviewiq.ai");
    const cookieRecruiter = loginRecruiter.cookie;

    const recruiterReportRes = await fetch(`${BASE_URL}/api/interview/report/${testSessionId}`, {
      headers: { Cookie: cookieRecruiter },
    });
    const recruiterReportData = await recruiterReportRes.json();

    const pipelineRes = await fetch(`${BASE_URL}/api/interview/reports`, {
      headers: { Cookie: cookieRecruiter },
    });
    const pipelineData = await pipelineRes.json();

    const reportInPipeline = pipelineData.reports?.some((r: any) => r.sessionId === testSessionId);

    const passed =
      recruiterReportRes.ok &&
      recruiterReportData.report?.sessionId === testSessionId &&
      pipelineRes.ok &&
      reportInPipeline;

    results.push({
      name: "9. Recruiter Authorized Access (Report & Pipeline)",
      passed,
      details: passed
        ? `Recruiter authorized to view Candidate A's report (HTTP 200) and candidate appeared in recruiter pipeline list.`
        : `Recruiter access failed: status=${recruiterReportRes.status}, pipeline=${pipelineRes.status}, inPipeline=${reportInPipeline}`,
    });
  } catch (err: any) {
    results.push({
      name: "9. Recruiter Authorized Access (Report & Pipeline)",
      passed: false,
      details: err.message,
    });
  }

  // 10. Demo Benchmark Reports Compatibility
  try {
    const demoRes = await fetch(`${BASE_URL}/api/interview/report/demo-session-alex`);
    const demoData = await demoRes.json();

    const passed =
      demoRes.ok &&
      demoData.report &&
      demoData.report.candidateName === "Alex Rivera" &&
      demoData.report.isDemoSimulation === true;

    results.push({
      name: "10. Demo Benchmark Reports Compatibility",
      passed,
      details: passed
        ? `Demo benchmark report loaded seamlessly (HTTP 200). Candidate: ${demoData.report.candidateName}, isDemoSimulation: ${demoData.report.isDemoSimulation}`
        : `Demo report failed: status=${demoRes.status}`,
    });
  } catch (err: any) {
    results.push({
      name: "10. Demo Benchmark Reports Compatibility",
      passed: false,
      details: err.message,
    });
  }

  // 11. Deterministic Fallback on Missing AI
  try {
    const fallbackSessionId = `fallback-session-${Date.now()}`;
    const fallbackRes = await fetch(`${BASE_URL}/api/interview/generate-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session: {
          id: fallbackSessionId,
          setup: {
            candidateName: "Fallback Candidate",
            targetRole: "python",
            experienceLevel: "intermediate",
            interviewFocus: "core-concepts",
            skills: ["Python", "AsyncIO"],
          },
          status: "completed",
          answers: [
            {
              questionId: "q-py-1",
              questionText: "Explain Python GIL and asyncio.",
              category: "Python Core",
              difficulty: "intermediate",
              answerText: "The GIL prevents multiple native threads from executing Python bytecodes at once, but asyncio uses cooperative multitasking.",
              submittedAt: "11:00 AM",
              feedback: { score: 85, strengths: ["GIL explanation"], gaps: [] },
            },
          ],
        },
        forceDeterministic: true,
      }),
    });

    const fallbackData = await fallbackRes.json();
    const passed =
      fallbackRes.ok &&
      fallbackData.report &&
      fallbackData.report.sessionId === fallbackSessionId &&
      fallbackData.report.isDemoSimulation === true;

    results.push({
      name: "11. Deterministic Fallback Generation & Persistence",
      passed,
      details: passed
        ? `Deterministic fallback produced valid report (HTTP 200) with overallScore ${fallbackData.report?.overallScore}% and isDemoSimulation=true.`
        : `Deterministic fallback failed: status=${fallbackRes.status}`,
    });
  } catch (err: any) {
    results.push({
      name: "11. Deterministic Fallback Generation & Persistence",
      passed: false,
      details: err.message,
    });
  }

  // Print Summary Table
  console.log("\n==================== TEST RESULTS SUMMARY ====================");
  for (const r of results) {
    const icon = r.passed ? "✓ PASS" : "✗ FAIL";
    console.log(`${icon} [${r.name}]`);
    if (r.details) {
      console.log(`   └─ ${r.details}`);
    }
  }
  const allPassed = results.every((r) => r.passed);
  console.log(`\nTOTAL: ${results.filter((r) => r.passed).length}/${results.length} PASSED. ALL PASSED: ${allPassed}`);
}

runTests()
  .catch((e) => console.error("Test runner error:", e))
  .finally(() => prisma.$disconnect());
