/**
 * Shared Gemini AI client with retry logic and model fallback.
 * Used by all server-side API routes.
 */
import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// Primary and fallback models
const PRIMARY_MODEL = "gemini-3.7-flash";
const FALLBACK_MODEL = "gemini-3.5-flash-lite";

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
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];
  const delays = [0, 2000];

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
        setTimeout(() => reject(new Error("Gemini API call timed out after 25s")), 25000)
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
      // If quota/rate-limit hit on free tier, don't wait for secondary retry
      if (lastError.message.includes("429") || lastError.message.toLowerCase().includes("rate limit") || lastError.message.toLowerCase().includes("quota")) {
        break;
      }
    }
  }

  throw lastError || new Error("All Gemini API attempts failed");
}

/**
 * Parse JSON from Gemini output, stripping markdown fences and surrounding text if present.
 */
export function parseGeminiJson<T>(raw: string): T {
  // Strip markdown fences first
  const cleaned = raw
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```$/m, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // If direct parse fails, try extracting the substring from first '{' to last '}'
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const jsonSub = cleaned.slice(start, end + 1);
      return JSON.parse(jsonSub) as T;
    }
    throw new Error(`Failed to parse JSON from AI response: ${raw.slice(0, 200)}...`);
  }
}
