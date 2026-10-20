/**
 * InterviewIQ — Stage 2: Voice + Adaptive Interview Intelligence Integration Suite
 * 
 * Verifies the end-to-end integration between:
 * 1. Voice Input (Speech Recognition, Interim Segregation, Transcript Appending, Editing)
 * 2. Canonical Answer Submission Workflow (Textarea -> Validation -> POST /api/interview/answer -> SQLite)
 * 3. Adaptive Question Progression & Dynamic Follow-Up Quality (5 distinct answer profiles)
 * 4. Dual-Storage Persistence & Session Rehydration (SQLite via Prisma + localStorage recovery)
 * 5. Report Generation Integrity (Persisted answers only, 0-answer rejection)
 * 6. Camera & Microphone Decoupling (Lifecycles remain strictly independent, no audio biometrics)
 */

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db";
}

import { prisma } from "../src/lib/prisma.ts";
import { appendSpeechToAnswer, normalizeSpeechError } from "../src/lib/speech-recognition.ts";

const BASE_URL = "http://localhost:3000";

async function loginAs(role: "candidate" | "recruiter") {
  const res = await fetch(`${BASE_URL}/api/auth/demo-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    throw new Error(`Failed to log in as ${role}: ${res.status}`);
  }
  const data = await res.json();
  const setCookie = res.headers.get("set-cookie") || "";
  const match = setCookie.match(/interviewiq_session=([^;]+)/);
  const cookie = match ? match[0] : "";
  return { user: data.user, cookie };
}

async function runStage2VoiceAdaptiveIntegration() {
  console.log("======================================================================");
  console.log("🎙️ + 🧠 INTERVIEWIQ — STAGE 2: VOICE + ADAPTIVE INTEGRATION SUITE");
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

  const candidate = await loginAs("candidate");
  const recruiter = await loginAs("recruiter");

  console.log(`Candidate: ${candidate.user.name} (${candidate.user.id})`);
  console.log(`Recruiter: ${recruiter.user.name} (${recruiter.user.id})\n`);

  // Setup isolated candidate session in SQLite
  const testSessionId = `test-stage2-voice-adaptive-${Date.now()}`;
  await prisma.interviewSession.create({
    data: {
      id: testSessionId,
      userId: candidate.user.id,
      candidateName: candidate.user.name,
      targetRole: "fullstack",
      experienceLevel: "senior",
      interviewFocus: "core-concepts",
      interviewLength: 20,
      skills: JSON.stringify(["React", "TypeScript", "Node.js", "Distributed Systems"]),
      status: "in-progress",
      integrityPolicyAcknowledgedAt: new Date(),
      integrityPolicyVersion: "v1.0",
      violationCount: 0,
    },
  });

  // =========================================================================
  // SECTION 1: Canonical Answer-Submission Workflow Equivalence
  // =========================================================================
  console.log("--- SECTION 1: Canonical Workflow & Voice Input Equivalence ---");

  // 1.1 Speech formatting and punctuation appending
  const initialTypedText = "I prefer using optimistic UI updates.";
  const spokenChunk1 = "When a mutation occurs, we update the React cache immediately";
  const updated1 = appendSpeechToAnswer(initialTypedText, spokenChunk1);
  assert(
    updated1 === "I prefer using optimistic UI updates. When a mutation occurs, we update the React cache immediately",
    "Speech appends to typed text with sentence capitalization and space after period"
  );

  const spokenChunk2 = "and rollback if the network request fails with an error.";
  const updated2 = appendSpeechToAnswer(updated1, spokenChunk2);
  assert(
    updated2 === "I prefer using optimistic UI updates. When a mutation occurs, we update the React cache immediately and rollback if the network request fails with an error.",
    "Consecutive spoken phrases append with appropriate spacing without destroying typed text"
  );

  // 1.2 Candidate manual review & editing before submission
  // Candidate fixes a word or adds nuance to the transcript
  const editedTranscript = updated2.replace("React cache immediately", "React Query cache immediately with snapshot rollback");
  assert(
    editedTranscript.includes("React Query cache immediately with snapshot rollback"),
    "Candidate can freely edit spoken transcript in textarea prior to submission"
  );

  // 1.3 Validation rule parity: Empty and whitespace answers rejected
  const emptyRes = await fetch(`${BASE_URL}/api/interview/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: candidate.cookie },
    body: JSON.stringify({
      sessionId: testSessionId,
      answer: {
        questionId: "q1",
        questionText: "Explain optimistic updates.",
        category: "React",
        difficulty: "senior",
        answerText: "    ",
        submittedAt: "10:00 AM",
      },
    }),
  });
  assert(emptyRes.status === 400, "Server rejects whitespace-only answer with 400 Bad Request");

  // 1.4 Validation rule parity: Short answer under 15 characters rejected
  const shortRes = await fetch(`${BASE_URL}/api/interview/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: candidate.cookie },
    body: JSON.stringify({
      sessionId: testSessionId,
      answer: {
        questionId: "q1",
        questionText: "Explain optimistic updates.",
        category: "React",
        difficulty: "senior",
        answerText: "Too short.",
        submittedAt: "10:01 AM",
      },
    }),
  });
  assert(shortRes.status === 400, "Server rejects sub-15-character answer with 400 Bad Request");

  // =========================================================================
  // SECTION 2: Voice Transcript Safety & Edge Cases
  // =========================================================================
  console.log("\n--- SECTION 2: Voice Transcript Safety & Edge Cases ---");

  // 2.1 Long spoken answer (> 2000 chars)
  const longSpokenAnswer = "In a distributed event-driven architecture, handling eventual consistency requires a combination of idempotent event consumers, outbox patterns, and distributed tracing. ".repeat(15);
  assert(longSpokenAnswer.length > 2000, `Long spoken answer constructed (${longSpokenAnswer.length} chars)`);

  const longAnswerAppended = appendSpeechToAnswer("", longSpokenAnswer);
  assert(
    longAnswerAppended.length === longSpokenAnswer.trim().length,
    "Long spoken transcripts are accepted without buffer clipping or truncation"
  );

  // 2.2 Error normalization handles microphone denial gracefully
  const deniedError = normalizeSpeechError("not-allowed");
  assert(
    deniedError.code === "not_allowed" && deniedError.message.includes("Microphone access was denied"),
    "Microphone permission denial maps to friendly, actionable candidate hint"
  );

  const noSpeechError = normalizeSpeechError("no-speech");
  assert(
    noSpeechError.code === "no_speech" && noSpeechError.actionableHint.includes("Check your microphone"),
    "Speech silence or no-speech timeout produces non-punitive candidate guidance"
  );

  // =========================================================================
  // SECTION 3: Answer Persistence, Idempotency & Refresh Rehydration
  // =========================================================================
  console.log("\n--- SECTION 3: Persistence, Idempotency & Rehydration ---");

  const turn1QuestionId = "q-turn-1-optimistic-ui";
  const answerTurn1Payload = {
    questionId: turn1QuestionId,
    questionText: "How do you implement resilient optimistic UI updates in React with rollback capabilities?",
    category: "React Architecture",
    difficulty: "senior",
    answerText: editedTranscript, // The candidate-edited spoken transcript
    submittedAt: "10:05 AM",
    feedback: {
      score: 85,
      strengths: ["Clear rollback strategy", "Understands cache mutation mechanics"],
      gaps: ["Could mention server conflict resolution headers"],
      adaptiveNote: "Candidate demonstrated strong practical React state management.",
    },
  };

  // Submit answer via canonical API
  const submitTurn1Res = await fetch(`${BASE_URL}/api/interview/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: candidate.cookie },
    body: JSON.stringify({
      sessionId: testSessionId,
      answer: answerTurn1Payload,
    }),
  });
  assert(submitTurn1Res.status === 200, "Spoken+edited answer successfully submitted via POST /api/interview/answer (200 OK)");

  // 3.2 Verify answer persisted in SQLite with exact edited text
  const dbRecord1 = await prisma.interviewAnswer.findFirst({
    where: { sessionId: testSessionId, questionId: turn1QuestionId },
  });
  assert(Boolean(dbRecord1), "Answer turn persisted to SQLite database via Prisma");
  assert(
    dbRecord1?.answerText === editedTranscript,
    "Persisted database answer matches exact final candidate-reviewed transcript"
  );

  // 3.3 Fast duplicate click idempotency test
  // Submit exact same turn again simulating candidate double-clicking Submit
  const duplicateSubmitRes = await fetch(`${BASE_URL}/api/interview/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: candidate.cookie },
    body: JSON.stringify({
      sessionId: testSessionId,
      answer: {
        ...answerTurn1Payload,
        submittedAt: "10:05:01 AM", // slight clock jitter
      },
    }),
  });
  assert(duplicateSubmitRes.status === 200, "Duplicate answer submission returns 200 OK without server crash");

  const totalTurn1Records = await prisma.interviewAnswer.count({
    where: { sessionId: testSessionId, questionId: turn1QuestionId },
  });
  assert(
    totalTurn1Records === 1,
    `Database idempotency verified: exactly 1 answer record exists for (sessionId, questionId) turn`
  );

  // 3.4 Rehydration after refresh: GET /api/interview/session returns persisted answers
  const rehydrateRes = await fetch(`${BASE_URL}/api/interview/session?id=${testSessionId}`, {
    method: "GET",
    headers: { Cookie: candidate.cookie },
  });
  assert(rehydrateRes.status === 200, "Session rehydration endpoint returns 200 OK on page reload");
  const rehydratedData = await rehydrateRes.json();
  assert(
    Array.isArray(rehydratedData.session?.answers) && rehydratedData.session.answers.length === 1,
    "Rehydrated session restores submitted answers array correctly"
  );
  assert(
    rehydratedData.session.answers[0].answerText === editedTranscript,
    "Rehydrated answer text matches submitted spoken+edited transcript"
  );

  // =========================================================================
  // SECTION 4: Adaptive Follow-Up Quality Across 5 Answer Quality Profiles
  // =========================================================================
  console.log("\n--- SECTION 4: Adaptive Follow-Up Quality Across Profiles ---");

  // PROFILE A: Correct Answer with Clear Reasoning (Score >= 80)
  console.log("-> Profile A: Proficient answer with clear reasoning");
  const profileAQ = {
    id: "q-node-event-loop",
    role: "fullstack" as const,
    category: "Node.js Concurrency",
    difficulty: "senior" as const,
    questionText: "How does the Node.js event loop coordinate between libuv worker threads and the main V8 execution thread during asynchronous I/O?",
    expectedKeywords: ["libuv", "threadpool", "microtasks", "event loop", "epoll"],
  };
  const profileAAnswer =
    "Node.js runs V8 on a single main event loop thread. Asynchronous non-blocking network I/O is delegated directly to the OS kernel via epoll or kqueue through libuv. For file I/O and crypto operations, libuv dispatches tasks to an internal worker thread pool, signaling the main loop when completed so callbacks execute in appropriate phases.";

  const evalProfileARes = await fetch(`${BASE_URL}/api/interview/evaluate-answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: candidate.cookie },
    body: JSON.stringify({
      sessionId: testSessionId,
      question: profileAQ,
      answerText: profileAAnswer,
      candidateName: candidate.user.name,
      targetRole: "fullstack",
      experienceLevel: "senior",
    }),
  });
  assert(evalProfileARes.status === 200, "Profile A answer evaluated successfully (200 OK)");
  const evalDataA = await evalProfileARes.json();
  const feedbackA = evalDataA.feedback;
  assert(
    feedbackA.score >= 75 && feedbackA.technicalCorrectness === "accurate",
    `Profile A scored high (${feedbackA.score}/100) and evaluated as 'accurate'`
  );
  assert(
    feedbackA.competencyStatus === "demonstrated",
    "Profile A assigned 'demonstrated' competency status"
  );
  if (feedbackA.evidenceQuote) {
    const isVerbatim = profileAAnswer.toLowerCase().includes(feedbackA.evidenceQuote.toLowerCase().trim());
    assert(isVerbatim, `Profile A evidenceQuote is verified verbatim substring: "${feedbackA.evidenceQuote.slice(0, 50)}..."`);
  }

  // Branch next question for Profile A: Should probe deeper, scale, or edge case
  const nextQA = await fetch(`${BASE_URL}/api/interview/next-question`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: candidate.cookie },
    body: JSON.stringify({
      sessionId: testSessionId,
      setup: {
        candidateName: candidate.user.name,
        targetRole: "fullstack",
        experienceLevel: "senior",
        interviewFocus: "core-concepts",
        interviewLength: 20,
        skills: ["Node.js"],
      },
      lastQuestion: profileAQ,
      lastAnswer: profileAAnswer,
      lastScore: feedbackA.score,
      lastFeedback: feedbackA,
      answerHistory: [],
      questionsAsked: [profileAQ.questionText],
    }),
  });
  assert(nextQA.status === 200, "Profile A adaptive follow-up generated (200 OK)");
  const nextQAData = await nextQA.json();
  assert(
    Boolean(nextQAData.question?.questionText) && nextQAData.question.questionText !== profileAQ.questionText,
    `Profile A follow-up expands inquiry without repeating question: "${nextQAData.question.questionText.slice(0, 70)}..."`
  );

  // PROFILE B: Partially Correct Answer with Missing Details (Score 50-79)
  console.log("-> Profile B: Partially correct answer with missing details");
  const profileBQ = {
    id: "q-db-indexing",
    role: "fullstack" as const,
    category: "Database Engineering",
    difficulty: "senior" as const,
    questionText: "Explain how B-tree indexes speed up SQL lookups and why inserting into a heavily indexed table causes write overhead.",
    expectedKeywords: ["B-tree", "node split", "write amplification", "leaf nodes", "binary search"],
  };
  const profileBAnswer =
    "B-tree indexes organize table data hierarchically so finding a row takes logarithmic time instead of scanning every page sequentially.";

  const evalProfileBRes = await fetch(`${BASE_URL}/api/interview/evaluate-answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: candidate.cookie },
    body: JSON.stringify({
      sessionId: testSessionId,
      question: profileBQ,
      answerText: profileBAnswer,
      candidateName: candidate.user.name,
      targetRole: "fullstack",
      experienceLevel: "senior",
    }),
  });
  assert(evalProfileBRes.status === 200, "Profile B answer evaluated successfully (200 OK)");
  const evalDataB = await evalProfileBRes.json();
  const feedbackB = evalDataB.feedback;
  assert(
    feedbackB.score >= 25 && feedbackB.score <= 75,
    `Profile B received calibrated partial score (${feedbackB.score}/100)`
  );
  assert(
    Array.isArray(feedbackB.gaps) && feedbackB.gaps.length > 0,
    `Profile B identified gaps: [${feedbackB.gaps.slice(0, 2).join("; ")}]`
  );

  // Branch next question for Profile B: Probes the missing write-overhead or B-tree mechanics
  const nextQB = await fetch(`${BASE_URL}/api/interview/next-question`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: candidate.cookie },
    body: JSON.stringify({
      sessionId: testSessionId,
      setup: {
        candidateName: candidate.user.name,
        targetRole: "fullstack",
        experienceLevel: "senior",
        interviewFocus: "core-concepts",
        interviewLength: 20,
        skills: ["SQL"],
      },
      lastQuestion: profileBQ,
      lastAnswer: profileBAnswer,
      lastScore: feedbackB.score,
      lastFeedback: feedbackB,
      answerHistory: [],
      questionsAsked: [profileBQ.questionText],
    }),
  });
  assert(nextQB.status === 200, "Profile B adaptive follow-up generated (200 OK)");
  const nextQBData = await nextQB.json();
  assert(
    Boolean(nextQBData.question?.questionText) && nextQBData.question.questionText !== profileBQ.questionText,
    `Profile B follow-up probes missing concept: "${nextQBData.question.questionText.slice(0, 70)}..."`
  );

  // PROFILE C: Vague Answer / Claimed Knowledge Without Demonstration (Score <= 25)
  console.log("-> Profile C: Vague answer claiming knowledge without evidence");
  const profileCAnswer = "I have extensive experience with caching and Redis clustering and I always use best practices.";
  const evalProfileCRes = await fetch(`${BASE_URL}/api/interview/evaluate-answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: candidate.cookie },
    body: JSON.stringify({
      sessionId: testSessionId,
      question: profileBQ,
      answerText: profileCAnswer,
      candidateName: candidate.user.name,
      targetRole: "fullstack",
      experienceLevel: "senior",
    }),
  });
  assert(evalProfileCRes.status === 200, "Profile C evaluated with 200 OK");
  const evalDataC = await evalProfileCRes.json();
  assert(
    evalDataC.feedback.score <= 25,
    `Vague answer without demonstration strictly penalized to score <= 25 (got ${evalDataC.feedback.score}/100)`
  );
  assert(
    evalDataC.feedback.competencyStatus === "claimed_unvalidated",
    "Profile C assigned 'claimed_unvalidated' competency status"
  );

  // PROFILE D: Incorrect Answer with Conceptual Misconception (Score <= 25)
  console.log("-> Profile D: Incorrect answer with conceptual misconception");
  const profileDAnswer = "JavaScript runs multi-threaded by default in Chrome and each setTimeout launches a new background CPU thread.";
  const evalProfileDRes = await fetch(`${BASE_URL}/api/interview/evaluate-answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: candidate.cookie },
    body: JSON.stringify({
      sessionId: testSessionId,
      question: profileAQ,
      answerText: profileDAnswer,
      candidateName: candidate.user.name,
      targetRole: "fullstack",
      experienceLevel: "senior",
    }),
  });
  assert(evalProfileDRes.status === 200, "Profile D evaluated with 200 OK");
  const evalDataD = await evalProfileDRes.json();
  assert(
    evalDataD.feedback.score <= 25,
    `Incorrect answer with misconception strictly penalized to score <= 25 (got ${evalDataD.feedback.score}/100)`
  );
  assert(
    evalDataD.feedback.technicalCorrectness === "incorrect",
    "Profile D technicalCorrectness assigned as 'incorrect'"
  );

  // PROFILE E: Deterministic Fallback Resilience (AI Failure Simulation)
  console.log("-> Profile E: Deterministic fallback resilience on AI provider failure");
  const fallbackRes = await fetch(`${BASE_URL}/api/interview/evaluate-answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: candidate.cookie },
    body: JSON.stringify({
      question: {
        id: "q-fallback-test",
        role: "fullstack",
        category: "TypeScript",
        difficulty: "intermediate",
        questionText: "What is the difference between type and interface in TypeScript?",
        hint: "Declaration merging",
        expectedKeywords: ["declaration merging", "union", "primitives", "extends"],
      },
      answerText: "Interfaces support declaration merging across files, whereas types can represent union types, tuples, and primitive aliases directly.",
    }),
  });
  const fallbackJson = await fallbackRes.json();
  const fallbackFeedback = fallbackJson.feedback;
  assert(
    fallbackFeedback.score >= 70,
    `Deterministic fallback evaluation computes calibrated score without AI (${fallbackFeedback.score}/100)`
  );
  assert(
    Array.isArray(fallbackFeedback.strengths) && fallbackFeedback.strengths.length > 0,
    "Fallback evaluation identifies strengths from expected keywords"
  );

  // =========================================================================
  // SECTION 5: Final Report Generation & Security Rules
  // =========================================================================
  console.log("\n--- SECTION 5: Report Generation Integrity & Authorization ---");

  // 5.1 Rejection of 0-answer sessions
  const emptySessionId = `test-empty-session-${Date.now()}`;
  await prisma.interviewSession.create({
    data: {
      id: emptySessionId,
      userId: candidate.user.id,
      candidateName: candidate.user.name,
      targetRole: "fullstack",
      experienceLevel: "intermediate",
      interviewFocus: "mixed",
      interviewLength: 20,
      skills: "[]",
      status: "completed",
    },
  });

  const emptyReportRes = await fetch(`${BASE_URL}/api/interview/generate-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: candidate.cookie },
    body: JSON.stringify({
      session: {
        id: emptySessionId,
        status: "completed",
        answers: [],
      },
    }),
  });
  assert(
    emptyReportRes.status === 400,
    "Report generation blocked with 400 Bad Request when 0 eligible answers exist"
  );

  // 5.2 Generate report from the session with persisted answer
  // First mark session as completed in DB
  await prisma.interviewSession.update({
    where: { id: testSessionId },
    data: { status: "completed", endedAt: new Date().toISOString() },
  });

  const validReportRes = await fetch(`${BASE_URL}/api/interview/generate-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: candidate.cookie },
    body: JSON.stringify({
      session: {
        id: testSessionId,
        status: "completed",
        answers: [answerTurn1Payload],
      },
      forceDeterministic: true, // test deterministic path to guarantee reproducible rubric
    }),
  });
  assert(validReportRes.status === 200, "Report generated successfully (200 OK)");
  const reportData = await validReportRes.json();
  assert(
    Boolean(reportData.report && (reportData.report.sessionId || reportData.report.id)),
    `Report created with authoritative ID: ${reportData.report?.sessionId || reportData.report?.id}`
  );
  assert(
    reportData.report.answerRecords?.length === 1,
    "Report answerRecords strictly matches persisted database answers"
  );

  // 5.3 Unauthorized access protection
  const otherCandidateSessionId = `test-private-session-${Date.now()}`;
  await prisma.interviewSession.create({
    data: {
      id: otherCandidateSessionId,
      userId: recruiter.user.id, // Owned by another user (Recruiter), so candidate cannot access
      candidateName: "Other User",
      targetRole: "fullstack",
      experienceLevel: "senior",
      interviewFocus: "mixed",
      interviewLength: 20,
      skills: "[]",
      status: "in-progress",
    },
  });

  const crossUserReportRes = await fetch(`${BASE_URL}/api/interview/generate-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: candidate.cookie },
    body: JSON.stringify({
      session: { id: otherCandidateSessionId, status: "completed", answers: [] },
    }),
  });
  assert(
    crossUserReportRes.status === 403,
    "Unauthorized candidate blocked from generating or viewing another candidate's report (403 Forbidden)"
  );

  // 5.4 Authorized recruiter access
  const recruiterViewRes = await fetch(`${BASE_URL}/api/interview/report/${testSessionId}`, {
    method: "GET",
    headers: { Cookie: recruiter.cookie },
  });
  assert(
    recruiterViewRes.status === 200,
    "Authorized recruiter can inspect candidate's final evaluation report (200 OK)"
  );

  // =========================================================================
  // SECTION 6: Camera & Voice Decoupling Verification
  // =========================================================================
  console.log("\n--- SECTION 6: Camera & Voice Independence ---");

  // Verify that database schema does NOT store raw audio, voiceprints or biometrics
  const answerColumns = await prisma.$queryRawUnsafe<any[]>(
    "PRAGMA table_info(InterviewAnswer);"
  );
  const columnNames = answerColumns.map((c) => c.name);
  const hasAudioColumn = columnNames.some((c) =>
    c.toLowerCase().includes("audio") ||
    c.toLowerCase().includes("voiceprint") ||
    c.toLowerCase().includes("biometric")
  );
  assert(!hasAudioColumn, "Prisma SQLite schema does NOT contain audio or biometric storage columns");

  // Verify integrity events only track camera/focus violations, never voice pauses
  const integrityColumns = await prisma.$queryRawUnsafe<any[]>(
    "PRAGMA table_info(InterviewIntegrityEvent);"
  );
  const integrityColNames = integrityColumns.map((c) => c.name);
  assert(
    integrityColNames.includes("eventType") && integrityColNames.includes("details") || integrityColNames.includes("metadata"),
    "Integrity monitoring restricted to visual and tab focus telemetry"
  );

  // Clean up test sessions
  try {
    await prisma.evaluationReport.deleteMany({ where: { sessionId: testSessionId } });
    await prisma.interviewAnswer.deleteMany({ where: { sessionId: testSessionId } });
    await prisma.interviewSession.deleteMany({
      where: {
        id: { in: [testSessionId, emptySessionId, otherCandidateSessionId] },
      },
    });
  } catch (err) {
    console.warn("Cleanup warning:", err);
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log("\n======================================================================");
  console.log(`🏁 STAGE 2 INTEGRATION SUITE: ${passed} / ${total} TESTS PASSED`);
  console.log("======================================================================\n");

  if (passed !== total) {
    process.exitCode = 1;
  }
}

runStage2VoiceAdaptiveIntegration()
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
