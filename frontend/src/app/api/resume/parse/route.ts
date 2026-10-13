import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUser } from "@/lib/resolve-user";
import {
  extractTextFromPdf,
  extractTextFromDocx,
  deriveCandidateProfile,
  ParsedResumeResult,
} from "@/lib/resume-parser";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  try {
    const auth = await resolveRequestUser(req);

    // Require authentication unless testing as recognized demo session/persona
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: "Unauthorized: Sign in required to upload and analyze resumes." },
        { status: 401 }
      );
    }

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { error: "Invalid request: Expected multipart form data." },
        { status: 400 }
      );
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "Missing file: Please select a resume file to parse." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 10MB limit. Please upload a smaller document." },
        { status: 400 }
      );
    }

    const fileName = file.name || "resume.pdf";
    const fileExt = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json(
        { error: "The uploaded file is empty (0 bytes). Please upload a valid document." },
        { status: 400 }
      );
    }

    let extractedText = "";
    let isScannedPdf = false;

    // Validate server-side binary magic numbers
    if (fileExt === ".pdf") {
      // PDF magic bytes: %PDF- (0x25 0x50 0x44 0x46)
      if (buffer.subarray(0, 4).toString() !== "%PDF") {
        return NextResponse.json(
          { error: "Malformed PDF: The file does not have a valid PDF header." },
          { status: 400 }
        );
      }
      const pdfResult = extractTextFromPdf(buffer);
      extractedText = pdfResult.text;
      isScannedPdf = pdfResult.isScanned;
    } else if (fileExt === ".docx") {
      // DOCX (ZIP) magic bytes: PK\x03\x04
      if (buffer.readUInt32LE(0) !== 0x04034b50) {
        return NextResponse.json(
          { error: "Malformed DOCX: The file is not a valid OpenXML Word document." },
          { status: 400 }
        );
      }
      const docxResult = extractTextFromDocx(buffer);
      if (docxResult.error) {
        return NextResponse.json(
          { error: `DOCX processing failed: ${docxResult.error}` },
          { status: 422 }
        );
      }
      extractedText = docxResult.text;
    } else if (fileExt === ".txt") {
      extractedText = buffer.toString("utf-8");
    } else {
      return NextResponse.json(
        { error: "Unsupported file format. Please upload a PDF (.pdf), Word (.docx), or Text (.txt) file." },
        { status: 400 }
      );
    }

    // Check for empty or scanned PDF
    if (isScannedPdf || extractedText.trim().length === 0) {
      return NextResponse.json(
        {
          error: fileExt === ".pdf" 
            ? "No readable text found in PDF. This appears to be a scanned image or non-extractable document (OCR is not supported)."
            : "No readable text could be extracted from this document.",
          isScanned: true,
        },
        { status: 422 }
      );
    }

    // Derive bounded candidate claims
    const profile: ParsedResumeResult = deriveCandidateProfile(extractedText, fileName);

    return NextResponse.json({
      success: true,
      fileName,
      fileSize: (file.size / (1024 * 1024)).toFixed(1) + " MB",
      profile,
    });
  } catch (err: unknown) {
    console.error("[api/resume/parse] Error parsing resume:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred while parsing the resume." },
      { status: 500 }
    );
  }
}
