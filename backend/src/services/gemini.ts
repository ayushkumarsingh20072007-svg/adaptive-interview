import { GoogleGenAI } from "@google/genai";

const PRIMARY_MODEL = "gemini-3.8-flash";
const FALLBACK_MODEL = "gemini-3.7-flash";

let _client: GoogleGenAI | null = null;

export function getClient(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY || "";
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: key });
  }
  return _client;
}

export async function callGemini(prompt: string): Promise<string> {
  const client = getClient();
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];
  const delays = [0, 1500];

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < models.length; attempt++) {
    if (delays[attempt] > 0) {
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }

    try {
      const interaction = await client.interactions.create({
        model: models[attempt],
        input: prompt,
        store: false,
      });

      const raw = interaction.output_text?.trim() ?? "";
      if (!raw) throw new Error("Empty response from model");
      return raw;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(
        `[Gemini] Attempt ${attempt + 1}/${models.length} failed (${models[attempt]}):`,
        lastError.message
      );
    }
  }

  throw lastError || new Error("All Gemini API attempts failed");
}

export function parseGeminiJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```$/m, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const jsonSub = cleaned.slice(start, end + 1);
      return JSON.parse(jsonSub) as T;
    }
    throw new Error(`Failed to parse JSON from AI response: ${raw.slice(0, 200)}...`);
  }
}
