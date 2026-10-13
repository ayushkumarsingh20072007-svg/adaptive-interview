import zlib from "node:zlib";

export interface ParsedResumeResult {
  text: string;
  detectedName?: string;
  extractedSkills: string[];
  extractedProjects: string[];
  extractedExperienceYears?: number;
  wordCount: number;
  isScannedPdf?: boolean;
}

const COMMON_TECH_SKILLS = [
  "React", "Next.js", "Node.js", "Express", "TypeScript", "JavaScript",
  "Python", "FastAPI", "Django", "Java", "Spring Boot", "Go", "Golang",
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "SQLite", "GraphQL", "REST",
  "Docker", "Kubernetes", "AWS", "GCP", "Azure", "CI/CD", "Git",
  "Tailwind CSS", "HTML5", "CSS3", "Redux", "Kafka", "RabbitMQ",
  "Microservices", "System Design", "Distributed Systems", "SQL"
];

// Resource and decompression bounds
const MAX_DECOMPRESSED_ENTRY_SIZE = 15 * 1024 * 1024; // 15 MB decompression ceiling per entry (zip bomb guard)
const MAX_TOTAL_DECOMPRESSED_SIZE = 30 * 1024 * 1024; // 30 MB cumulative decompression ceiling
const MAX_STREAM_COUNT = 250; // Max streams processed per PDF
const MAX_ZIP_ENTRIES = 500; // Max zip entries traversed per DOCX

/**
 * Extract text from a standard PDF Buffer using FlateDecode stream inflation
 * and operator parsing (Tj, TJ, string literals).
 * 
 * Supported PDF subset: Standard PDF text streams (v1.0 - v1.7) encoded with FlateDecode
 * or uncompressed text streams with Tj/TJ string operators.
 * Unsupported: Scanned images (OCR not supported), Type 3 glyph-mapped fonts, heavily encrypted/DRM PDFs.
 */
export function extractTextFromPdf(buffer: Buffer): { text: string; isScanned: boolean } {
  const binary = buffer.toString("binary");
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let match: RegExpExecArray | null;
  const chunks: string[] = [];
  let streamCount = 0;
  let totalDecompressedBytes = 0;

  while ((match = streamRegex.exec(binary)) !== null) {
    streamCount++;
    if (streamCount > MAX_STREAM_COUNT) {
      break;
    }

    const streamBuffer = Buffer.from(match[1], "binary");
    let decoded = "";

    try {
      // Bound decompression with buffer limit
      const decompressedBuf = zlib.inflateSync(streamBuffer, { maxOutputLength: MAX_DECOMPRESSED_ENTRY_SIZE });
      totalDecompressedBytes += decompressedBuf.length;
      if (totalDecompressedBytes > MAX_TOTAL_DECOMPRESSED_SIZE) {
        break; // Stop processing if cumulative limit exceeded (decompression bomb protection)
      }
      decoded = decompressedBuf.toString("utf-8");
    } catch {
      try {
        const rawDecompressedBuf = zlib.inflateRawSync(streamBuffer, { maxOutputLength: MAX_DECOMPRESSED_ENTRY_SIZE });
        totalDecompressedBytes += rawDecompressedBuf.length;
        if (totalDecompressedBytes > MAX_TOTAL_DECOMPRESSED_SIZE) {
          break;
        }
        decoded = rawDecompressedBuf.toString("utf-8");
      } catch {
        // Fall back to uncompressed stream content if not flate-encoded
        decoded = match[1];
      }
    }

    // Match Tj string operators: (Text) Tj
    const tjMatches = decoded.match(/\(([^)]+)\)\s*Tj/g);
    if (tjMatches) {
      for (const m of tjMatches) {
        const val = m.replace(/^\(/, "").replace(/\)\s*Tj$/, "");
        chunks.push(unescapePdfString(val));
      }
    }

    // Match TJ array operators: [(Part 1) -120 (Part 2)] TJ
    const arrayMatches = decoded.match(/\[([\s\S]*?)\]\s*TJ/g);
    if (arrayMatches) {
      for (const m of arrayMatches) {
        const inner = m.match(/\(([^)]+)\)/g);
        if (inner) {
          chunks.push(inner.map((s) => unescapePdfString(s.slice(1, -1))).join(""));
        }
      }
    }

    // Also look for plain text in uncompressed text blocks: BT ... ET
    const btMatches = decoded.match(/BT[\s\S]*?ET/g);
    if (btMatches && !tjMatches && !arrayMatches) {
      for (const block of btMatches) {
        const strMatches = block.match(/\(([^)]+)\)/g);
        if (strMatches) {
          chunks.push(strMatches.map((s) => unescapePdfString(s.slice(1, -1))).join(" "));
        }
      }
    }
  }

  const rawText = chunks.join(" ").replace(/\s+/g, " ").trim();
  const isScanned = rawText.length === 0;

  return { text: rawText, isScanned };
}

/**
 * Extract document text from a DOCX (ZIP container containing word/document.xml).
 * 
 * Validates ZIP headers, traverses entries safely, and defends against decompression bombs.
 */
export function extractTextFromDocx(buffer: Buffer): { text: string; error?: string } {
  let offset = 0;
  let entriesProcessed = 0;

  while (offset <= buffer.length - 30) {
    entriesProcessed++;
    if (entriesProcessed > MAX_ZIP_ENTRIES) {
      return { text: "", error: "Exceeded allowable archive entry limit in DOCX file." };
    }

    // Local file header signature: 0x04034b50 (PK\x03\x04)
    if (buffer.readUInt32LE(offset) === 0x04034b50) {
      const compMethod = buffer.readUInt16LE(offset + 8);
      const compSize = buffer.readUInt32LE(offset + 18);
      const uncompSize = buffer.readUInt32LE(offset + 22);
      const nameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);

      // Bounds validation
      if (offset + 30 + nameLen > buffer.length) {
        return { text: "", error: "Malformed ZIP archive: truncated file name header." };
      }

      const fileName = buffer.toString("utf8", offset + 30, offset + 30 + nameLen);
      const dataStart = offset + 30 + nameLen + extraLen;

      if (dataStart + compSize > buffer.length) {
        return { text: "", error: "Malformed ZIP archive: truncated compressed stream." };
      }

      // Check for decompression bomb ratio (uncompressed > 50x compressed and > 10MB)
      if (uncompSize > MAX_DECOMPRESSED_ENTRY_SIZE || (compSize > 0 && uncompSize / compSize > 100)) {
        return { text: "", error: "Decompression bomb rejected: excessive uncompressed entry size." };
      }

      if (fileName === "word/document.xml") {
        const fileData = buffer.subarray(dataStart, dataStart + compSize);
        let xmlStr = "";
        try {
          if (compMethod === 8) { // Deflated
            xmlStr = zlib.inflateRawSync(fileData, { maxOutputLength: MAX_DECOMPRESSED_ENTRY_SIZE }).toString("utf8");
          } else if (compMethod === 0) { // Stored
            xmlStr = fileData.toString("utf8");
          } else {
            return { text: "", error: `Unsupported compression method in DOCX: ${compMethod}` };
          }
        } catch (inflateErr) {
          return { text: "", error: "Failed to decompress Word document XML stream." };
        }

        // Extract paragraph texts
        const text = xmlStr
          .replace(/<w:p[^>]*>/gi, "\n")
          .replace(/<w:tab[^>]*\/>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/\s+/g, " ")
          .trim();
        return { text };
      }

      offset = dataStart + compSize;
    } else {
      offset++;
    }
  }

  return { text: "" };
}

/**
 * Unescape PDF octal and standard escape characters: \( \) \\ \r \n \t
 */
function unescapePdfString(str: string): string {
  return str
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\r/g, " ")
    .replace(/\\n/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\([\\()])/g, "$1");
}

/**
 * Parse structured candidate profile claims from extracted text
 */
export function deriveCandidateProfile(text: string, originalFileName?: string): ParsedResumeResult {
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // 1. Detect candidate name
  let detectedName: string | undefined;
  if (originalFileName) {
    const cleanBaseName = originalFileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
    const potential = cleanBaseName
      .replace(/\b(resume|cv|curriculum|vitae|developer|engineer|fullstack|frontend|backend|swe)\b/gi, "")
      .trim();
    if (potential.length >= 3) {
      detectedName = potential;
    }
  }

  // 2. Extract technical skills mentioned in the resume
  const lowerText = text.toLowerCase();
  const extractedSkills = COMMON_TECH_SKILLS.filter((skill) => {
    const escaped = skill.toLowerCase().replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    return regex.test(lowerText);
  });

  // 3. Extract projects mentioned
  const extractedProjects: string[] = [];
  const projectMatches = text.match(/(?:project|portfolio|built|developed|created)\s*:\s*([^.\n]+)/gi);
  if (projectMatches) {
    for (const p of projectMatches.slice(0, 3)) {
      const cleanP = p.replace(/(?:project|portfolio|built|developed|created)\s*:\s*/i, "").trim();
      if (cleanP.length > 5 && cleanP.length < 100) {
        extractedProjects.push(cleanP);
      }
    }
  }

  // 4. Extract experience years if stated
  let extractedExperienceYears: number | undefined;
  const expMatch = text.match(/(\d+)\+?\s*(?:years|yrs)\s+(?:of\s+)?experience/i);
  if (expMatch) {
    const years = parseInt(expMatch[1], 10);
    if (!isNaN(years) && years > 0 && years < 40) {
      extractedExperienceYears = years;
    }
  }

  return {
    text: text.slice(0, 4000), // bounded size
    detectedName,
    extractedSkills,
    extractedProjects,
    extractedExperienceYears,
    wordCount,
  };
}
