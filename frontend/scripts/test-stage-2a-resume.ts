/**
 * Stage 2A Resume Parser & Personalized Question Verification Script
 * Validates:
 * 1. Valid PDF text extraction (FlateDecode streams + Tj/TJ operators)
 * 2. Valid DOCX text extraction (ZIP container + word/document.xml)
 * 3. Valid TXT text extraction
 * 4. Empty and malformed files rejected with 400
 * 5. Scanned PDF (0 text) rejected with 422
 * 6. Structured profile extraction (Skills, Projects, Experience years)
 * 7. Candidate setup with extracted resume generates personalized interview question
 * 8. Sample resume fallback remains functional
 */

import zlib from "node:zlib";

const BASE_URL = "http://localhost:3000";

async function runStage2ATests() {
  console.log("======================================================================");
  console.log("📄 STARTING STAGE 2A GENUINE RESUME PARSER & QUESTION TESTS");
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

  // 1. Get valid candidate session cookie
  const loginRes = await fetch(`${BASE_URL}/api/auth/demo-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "alex.rivera@example.com" }),
  });
  const cookieHeader = loginRes.headers.get("set-cookie") || "";
  const match = cookieHeader.match(/interviewiq_session=([^;]+)/);
  const sessionCookie = match ? match[0] : "";
  assert(Boolean(sessionCookie), "Authenticated candidate session cookie obtained");

  // --- Fixture Generators ---
  function createTestPdf(textContent: string): Buffer {
    const streamContent = `BT /F1 12 Tf 72 712 Td (${textContent}) Tj ET`;
    const compressed = zlib.deflateSync(Buffer.from(streamContent));
    const pdfRaw = `%PDF-1.4\n1 0 obj\n<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n${compressed.toString("binary")}\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`;
    return Buffer.from(pdfRaw, "binary");
  }

  function createTestDocx(textContent: string): Buffer {
    const header = Buffer.alloc(30);
    const fileName = "word/document.xml";
    const contentXml = `<w:document><w:body><w:p><w:r><w:t>${textContent}</w:t></w:r></w:p></w:body></w:document>`;
    const deflated = zlib.deflateRawSync(Buffer.from(contentXml));

    header.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(8, 8); // Deflate
    header.writeUInt32LE(0, 10);
    header.writeUInt32LE(0, 14);
    header.writeUInt32LE(deflated.length, 18);
    header.writeUInt32LE(Buffer.byteLength(contentXml), 22);
    header.writeUInt16LE(Buffer.byteLength(fileName), 26);
    header.writeUInt16LE(0, 28);

    return Buffer.concat([header, Buffer.from(fileName), deflated]);
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 1: PDF EXTRACTION
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 1: PDF Resume Extraction ---");
  const pdfBuffer = createTestPdf("Alex Rivera Senior Full Stack Engineer. Skills: React, Node.js, GraphQL, PostgreSQL. Project: Distributed Cache with Redis.");
  const pdfBlob = new Blob([pdfBuffer], { type: "application/pdf" });
  const pdfFormData = new FormData();
  pdfFormData.append("file", pdfBlob, "Alex_Rivera_Resume.pdf");

  const pdfRes = await fetch(`${BASE_URL}/api/resume/parse`, {
    method: "POST",
    headers: { Cookie: sessionCookie },
    body: pdfFormData,
  });
  assert(pdfRes.status === 200, `Valid PDF parse endpoint returns 200 OK (got ${pdfRes.status})`);
  const pdfData = await pdfRes.json();
  const pdfProfile = pdfData.profile;
  assert(pdfProfile.text.includes("Alex Rivera"), `Extracted text contains candidate name ("Alex Rivera")`);
  assert(pdfProfile.extractedSkills.includes("React") && pdfProfile.extractedSkills.includes("Node.js"), `Profile detects declared skills (React, Node.js)`);
  assert(pdfProfile.detectedName === "Alex Rivera", `Filename correctly heuristic-maps to candidate name`);

  // -------------------------------------------------------------------------
  // TEST GROUP 2: DOCX EXTRACTION
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 2: DOCX Resume Extraction ---");
  const docxBuffer = createTestDocx("Maya Patel Frontend Specialist. 4 years of experience. Skills: React, TypeScript, Tailwind CSS. Project: Realtime Collaboration Whiteboard.");
  const docxBlob = new Blob([docxBuffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const docxFormData = new FormData();
  docxFormData.append("file", docxBlob, "Maya_Patel_CV.docx");

  const docxRes = await fetch(`${BASE_URL}/api/resume/parse`, {
    method: "POST",
    headers: { Cookie: sessionCookie },
    body: docxFormData,
  });
  assert(docxRes.status === 200, `Valid DOCX parse endpoint returns 200 OK (got ${docxRes.status})`);
  const docxData = await docxRes.json();
  const docxProfile = docxData.profile;
  assert(docxProfile.text.includes("Maya Patel"), `Extracted text contains candidate name ("Maya Patel")`);
  assert(docxProfile.extractedSkills.includes("TypeScript"), `Profile detects declared skills (TypeScript)`);
  assert(docxProfile.extractedExperienceYears === 4, `Extracted 4 years of experience correctly`);

  // -------------------------------------------------------------------------
  // TEST GROUP 3: TXT EXTRACTION
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 3: Plain Text Extraction ---");
  const txtContent = "Liam Chen Backend Architect. Skills: Python, FastAPI, Docker, Kafka. Project: High Throughput Ingestion Pipeline.";
  const txtBlob = new Blob([Buffer.from(txtContent)], { type: "text/plain" });
  const txtFormData = new FormData();
  txtFormData.append("file", txtBlob, "Liam_Chen_Resume.txt");

  const txtRes = await fetch(`${BASE_URL}/api/resume/parse`, {
    method: "POST",
    headers: { Cookie: sessionCookie },
    body: txtFormData,
  });
  assert(txtRes.status === 200, `Valid TXT parse returns 200 OK`);
  const txtData = await txtRes.json();
  assert(txtData.profile.extractedSkills.includes("Python") && txtData.profile.extractedSkills.includes("Docker"), `Profile extracts Python and Docker`);

  // -------------------------------------------------------------------------
  // TEST GROUP 4: ERROR HANDLING & EDGE CASES
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 4: Error Handling & Edge Cases ---");

  // Empty file (0 bytes) -> 400
  const emptyBlob = new Blob([Buffer.alloc(0)], { type: "text/plain" });
  const emptyForm = new FormData();
  emptyForm.append("file", emptyBlob, "empty.txt");
  const emptyRes = await fetch(`${BASE_URL}/api/resume/parse`, {
    method: "POST",
    headers: { Cookie: sessionCookie },
    body: emptyForm,
  });
  assert(emptyRes.status === 400, `Empty file rejected with 400 (got ${emptyRes.status})`);

  // Malformed PDF (does not start with %PDF) -> 400
  const malformedPdfBlob = new Blob([Buffer.from("THIS IS NOT A VALID PDF FILE")], { type: "application/pdf" });
  const malformedForm = new FormData();
  malformedForm.append("file", malformedPdfBlob, "corrupted.pdf");
  const malformedRes = await fetch(`${BASE_URL}/api/resume/parse`, {
    method: "POST",
    headers: { Cookie: sessionCookie },
    body: malformedForm,
  });
  assert(malformedRes.status === 400, `Corrupted PDF rejected with 400 (got ${malformedRes.status})`);

  // Scanned PDF (valid PDF structure but empty text streams) -> 422
  const emptyPdfRaw = `%PDF-1.4\n1 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`;
  const scannedPdfBlob = new Blob([Buffer.from(emptyPdfRaw)], { type: "application/pdf" });
  const scannedForm = new FormData();
  scannedForm.append("file", scannedPdfBlob, "scanned_doc.pdf");
  const scannedRes = await fetch(`${BASE_URL}/api/resume/parse`, {
    method: "POST",
    headers: { Cookie: sessionCookie },
    body: scannedForm,
  });
  assert(scannedRes.status === 422, `Scanned PDF without text rejected with 422 (got ${scannedRes.status})`);
  const scannedData = await scannedRes.json();
  assert(scannedData.isScanned === true, `Response explicitly flags isScanned: true`);

  // Unsupported file type (.png) -> 400
  const pngBlob = new Blob([Buffer.from("Fake PNG image content")], { type: "image/png" });
  const pngForm = new FormData();
  pngForm.append("file", pngBlob, "resume_image.png");
  const pngRes = await fetch(`${BASE_URL}/api/resume/parse`, {
    method: "POST",
    headers: { Cookie: sessionCookie },
    body: pngForm,
  });
  assert(pngRes.status === 400, `Unsupported image format rejected with 400`);

  // Truncated DOCX ZIP (header claiming 5000 bytes but file only 50 bytes) -> 422
  const truncatedHeader = Buffer.alloc(40);
  truncatedHeader.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
  truncatedHeader.writeUInt16LE(20, 4);
  truncatedHeader.writeUInt16LE(0, 6);
  truncatedHeader.writeUInt16LE(8, 8); // Deflate
  truncatedHeader.writeUInt32LE(0, 10);
  truncatedHeader.writeUInt32LE(0, 14);
  truncatedHeader.writeUInt32LE(5000, 18); // Claims 5000 bytes
  truncatedHeader.writeUInt32LE(10000, 22);
  truncatedHeader.writeUInt16LE(17, 26); // nameLen
  truncatedHeader.writeUInt16LE(0, 28);
  const truncatedBuffer = Buffer.concat([truncatedHeader, Buffer.from("word/document.xml")]); // No data follows
  const truncBlob = new Blob([truncatedBuffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const truncForm = new FormData();
  truncForm.append("file", truncBlob, "truncated.docx");
  const truncRes = await fetch(`${BASE_URL}/api/resume/parse`, {
    method: "POST",
    headers: { Cookie: sessionCookie },
    body: truncForm,
  });
  assert(truncRes.status === 422, `Truncated/malformed DOCX archive rejected with 422 (got ${truncRes.status})`);
  const truncData = await truncRes.json();
  assert(truncData.error?.includes("DOCX processing failed"), `Error response reports DOCX processing failure`);

  // -------------------------------------------------------------------------
  // TEST GROUP 5: PERSONALIZED QUESTION GENERATION WITH EXTRACTED TEXT
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 5: Question Personalization with Extracted Resume ---");
  const personalizedQRes = await fetch(`${BASE_URL}/api/interview/generate-question`, {
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
        skills: ["React", "Node.js", "GraphQL"],
        resumeFileName: "Alex_Rivera_Resume.pdf",
      },
      resumeText: pdfProfile.text, // Text genuinely extracted from PDF
    }),
  });
  assert(personalizedQRes.status === 200, `Personalized question generates successfully with PDF extracted text (got ${personalizedQRes.status})`);
  const qData = await personalizedQRes.json();
  assert(Boolean(qData.question?.questionText), `Question text generated: "${qData.question?.questionText?.slice(0, 60)}..."`);

  // Sample resume fallback
  const sampleQRes = await fetch(`${BASE_URL}/api/interview/generate-question`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie,
    },
    body: JSON.stringify({
      setup: {
        candidateName: "Sample Candidate",
        targetRole: "frontend",
        experienceLevel: "intermediate",
        interviewFocus: "core-concepts",
        skills: ["React", "TypeScript"],
        isSampleResume: true,
      },
    }),
  });
  assert(sampleQRes.status === 200, `Sample resume fallback generates question successfully`);

  console.log(`\n======================================================================`);
  console.log(`🎯 STAGE 2A TOTAL: ${passed}/${total} PASSED. ALL PASSED: ${passed === total}`);
  console.log(`======================================================================\n`);
}

runStage2ATests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
