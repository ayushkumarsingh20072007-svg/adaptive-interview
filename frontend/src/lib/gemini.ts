/**
 * Shared Gemini AI client with retry logic and model fallback.
 * Used by all server-side API routes.
 */
import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// Primary and fallback models
const PRIMARY_MODEL = "gemini-3.8-flash";
const FALLBACK_MODEL = "gemini-3.5-flash-lite";
const TERTIARY_MODEL = "gemini-3.1-flash-lite";

let _client: GoogleGenAI | null = null;
let _currentKey: string = "";

export function getClient(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY || "";
  if (!_client || key !== _currentKey) {
    _currentKey = key;
    _client = new GoogleGenAI({ apiKey: key });
  }
  return _client;
}

/**
 * Call Gemini with automatic retry and model fallback.
 */
export async function callGemini(
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  const client = getClient();
  const models = [PRIMARY_MODEL, FALLBACK_MODEL, TERTIARY_MODEL];
  const delays = [0, 1000, 2000];

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < models.length; attempt++) {
    if (delays[attempt] > 0) {
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }

    try {
      const callPromise = client.interactions.create({
        model: models[attempt],
        input: prompt,
        ...(systemInstruction ? { system_instruction: systemInstruction } : {}),
        store: false,
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Gemini API call timed out after 12s (${models[attempt]})`)), 12000)
      );

      const interaction = await Promise.race([callPromise, timeoutPromise]);
      const raw = interaction.output_text?.trim() ?? "";
      if (!raw) throw new Error("Empty response from model");
      return raw;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(
        `[Gemini] Attempt ${attempt + 1}/${models.length} failed (model: ${models[attempt]}):`,
        lastError.message
      );
    }
  }

  throw lastError || new Error("All Gemini API attempts failed");
}

/**
 * Parse JSON from Gemini output, stripping markdown fences, single-line comments,
 * and trailing commas before braces or brackets.
 */
export function parseGeminiJson<T>(raw: string): T {
  // Strip markdown code fences first
  let cleaned = raw
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```$/m, "")
    .trim();

  // Strip single-line comments // ...
  cleaned = cleaned.replace(/\/\/[^\r\n]*/g, "");

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // If direct parse fails, try extracting substring from first '{' or '[' to last '}' or ']'
    const firstBrace = cleaned.indexOf("{");
    const firstBracket = cleaned.indexOf("[");
    let start = -1;
    let end = -1;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      start = firstBrace;
      end = cleaned.lastIndexOf("}");
    } else if (firstBracket !== -1) {
      start = firstBracket;
      end = cleaned.lastIndexOf("]");
    }

    if (start !== -1 && end !== -1 && end > start) {
      const jsonSub = cleaned.slice(start, end + 1);
      try {
        return JSON.parse(jsonSub) as T;
      } catch {
        // Strip trailing commas before closing braces/brackets
        const sanitized = jsonSub.replace(/,\s*([}\]])/g, "$1");
        return JSON.parse(sanitized) as T;
      }
    }
    throw new Error(`Failed to parse JSON from AI response: ${raw.slice(0, 200)}...`);
  }
}

