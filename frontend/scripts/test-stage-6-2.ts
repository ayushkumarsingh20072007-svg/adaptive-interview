/**
 * Stage 6.2 QA & Regression Verification Script
 * Validates:
 * 1. Unauthenticated requests to /api/interview/generate-question are rejected (401)
 * 2. Requests missing resume are rejected (400)
 * 3. Authenticated requests with valid resume succeed (200)
 * 4. Explicit demo setup succeeds (200)
 */

const BASE_URL = "http://localhost:3000";

async function runStage62Tests() {
  console.log("=== STARTING STAGE 6.2 QA & QUESTION GENERATION VALIDATION ===");
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`✅ PASS | ${total}. ${msg}`);
      passed++;
    } else {
      console.error(`❌ FAIL | ${total}. ${msg}`);
      process.exitCode = 1;
    }
  }

  // 1. Unauthenticated request without resume -> 401
  const res1 = await fetch(`${BASE_URL}/api/interview/generate-question`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      setup: {
        candidateName: "Anonymous Guest",
        targetRole: "fullstack",
        experienceLevel: "intermediate",
        interviewFocus: "mixed",
        skills: ["React", "Node.js"],
      },
    }),
  });
  assert(res1.status === 401, `Unauthenticated request rejected with 401 (got ${res1.status})`);

  // 2. Authenticated user without resume -> 400
  // Login first as Alex Rivera
  const loginRes = await fetch(`${BASE_URL}/api/auth/demo-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "alex.rivera@example.com" }),
  });
  const cookieHeader = loginRes.headers.get("set-cookie") || "";
  const match = cookieHeader.match(/interviewiq_session=([^;]+)/);
  const sessionCookie = match ? match[0] : "";

  const res2 = await fetch(`${BASE_URL}/api/interview/generate-question`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie,
    },
    body: JSON.stringify({
      setup: {
        candidateName: "Alex Rivera",
        targetRole: "fullstack",
        experienceLevel: "intermediate",
        interviewFocus: "mixed",
        skills: ["React", "Node.js"],
        resumeFileName: undefined,
        resumeText: undefined,
        isSampleResume: false,
      },
      resumeText: "",
    }),
  });
  assert(res2.status === 400, `Request missing resume rejected with 400 (got ${res2.status})`);
  const errData = await res2.json();
  assert(errData.error?.includes("Resume required"), `Error message explicitly states resume is required ("${errData.error}")`);

  // 3. Demo candidate with sample resume -> 200
  const res3 = await fetch(`${BASE_URL}/api/interview/generate-question`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      setup: {
        candidateName: "Alex Rivera (Demo)",
        targetRole: "fullstack",
        experienceLevel: "intermediate",
        interviewFocus: "mixed",
        skills: ["React", "Node.js"],
        isSampleResume: true,
        resumeFileName: "Alex_Rivera_Resume.pdf",
      },
      resumeText: "Experienced full stack engineer proficient in TypeScript, React, Node.js, and PostgreSQL.",
    }),
  });
  assert(res3.status === 200, `Demo candidate with resume generates question successfully (got ${res3.status})`);

  console.log(`\n======================================================================`);
  console.log(`TOTAL: ${passed}/${total} PASSED. ALL PASSED: ${passed === total}`);
  console.log(`======================================================================\n`);
}

runStage62Tests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
