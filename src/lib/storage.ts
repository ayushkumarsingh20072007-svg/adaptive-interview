import { CandidateSetup, InterviewSession, EvaluationReport } from "./types";
import { SAMPLE_CANDIDATE } from "./mock-data";

const STORAGE_KEYS = {
  SETUP: "interviewiq_candidate_setup",
  CURRENT_SESSION: "interviewiq_active_session",
  COMPLETED_REPORTS: "interviewiq_evaluation_reports",
};

export function getStoredSetup(userId?: string | null): CandidateSetup {
  if (typeof window === "undefined") return SAMPLE_CANDIDATE;
  try {
    const key = userId ? `${STORAGE_KEYS.SETUP}_${userId}` : STORAGE_KEYS.SETUP;
    const raw = localStorage.getItem(key) || (!userId ? localStorage.getItem(STORAGE_KEYS.SETUP) : null);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to load candidate setup from storage", err);
  }
  return SAMPLE_CANDIDATE;
}

export function saveStoredSetup(setup: CandidateSetup): void {
  if (typeof window === "undefined") return;
  try {
    if (setup.userId) {
      localStorage.setItem(`${STORAGE_KEYS.SETUP}_${setup.userId}`, JSON.stringify(setup));
    }
    localStorage.setItem(STORAGE_KEYS.SETUP, JSON.stringify(setup));
  } catch (err) {
    console.error("Failed to save candidate setup to storage", err);
  }
}

export function getStoredSession(id: string): InterviewSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEYS.CURRENT_SESSION}_${id}`);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to read session from storage", err);
  }
  return null;
}

export function saveStoredSession(session: InterviewSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_KEYS.CURRENT_SESSION}_${session.id}`, JSON.stringify(session));
  } catch (err) {
    console.error("Failed to save session to storage", err);
  }
}

export function getStoredReport(sessionId: string): EvaluationReport | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEYS.COMPLETED_REPORTS}_${sessionId}`);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to read report from storage", err);
  }
  return null;
}

export function saveStoredReport(report: EvaluationReport): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_KEYS.COMPLETED_REPORTS}_${report.sessionId}`, JSON.stringify(report));
  } catch (err) {
    console.error("Failed to save report to storage", err);
  }
}

export function getAllReports(userId?: string | null): EvaluationReport[] {
  if (typeof window === "undefined") return [];
  try {
    const reports: EvaluationReport[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEYS.COMPLETED_REPORTS)) {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            const parsed: EvaluationReport = JSON.parse(item);
            if (userId) {
              if (parsed.userId === userId) {
                reports.push(parsed);
              }
            } else {
              // Guest mode: only show reports not owned by any registered user
              if (!parsed.userId || parsed.userId === "guest") {
                reports.push(parsed);
              }
            }
          } catch {
            // Ignore malformed entries
          }
        }
      }
    }
    if (reports.length > 0) {
      return reports.sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1));
    }
  } catch (err) {
    console.error("Failed to list reports from storage", err);
  }
  return [];
}
