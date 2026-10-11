import {
  CandidateSetup,
  InterviewSession,
  EvaluationReport,
  CandidateShortlistRecord,
  ShortlistStatus,
  UserRole,
} from "./types";
import { SAMPLE_CANDIDATE, ALL_DEMO_REPORTS } from "./mock-data";

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

export function getShortlistRecord(sessionId: string): CandidateShortlistRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`interviewiq_shortlist_${sessionId}`);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to read shortlist record", err);
  }
  return null;
}

export function saveShortlistRecord(record: CandidateShortlistRecord): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`interviewiq_shortlist_${record.sessionId}`, JSON.stringify(record));
  } catch (err) {
    console.error("Failed to save shortlist record", err);
  }
}

export function updateCandidateShortlist(
  sessionId: string,
  candidateName: string,
  status: ShortlistStatus,
  notes?: string,
  reviewedBy?: string
): void {
  const existing = getShortlistRecord(sessionId);
  const record: CandidateShortlistRecord = {
    sessionId,
    candidateName,
    status,
    notes: notes !== undefined ? notes : existing?.notes,
    reviewedBy: reviewedBy || "Sarah Jenkins (Head of Talent)",
    updatedAt: new Date().toISOString(),
  };
  saveShortlistRecord(record);

  // Also update stored report if present in localStorage
  const stored = getStoredReport(sessionId);
  if (stored) {
    stored.shortlistStatus = status;
    if (notes !== undefined) stored.shortlistNotes = notes;
    saveStoredReport(stored);
  }
}

export function getStoredReport(sessionId: string): EvaluationReport | null {
  if (typeof window === "undefined") return null;
  try {
    // Check demo reports first
    const demo = ALL_DEMO_REPORTS.find(
      (r) => r.sessionId === sessionId || (sessionId === "demo-session" && r.sessionId === "demo-session-alex")
    );

    const raw = localStorage.getItem(`${STORAGE_KEYS.COMPLETED_REPORTS}_${sessionId}`);
    let report: EvaluationReport | null = raw ? JSON.parse(raw) : demo ? { ...demo } : null;

    if (report) {
      // Overlay shortlist record if any
      const sl = getShortlistRecord(report.sessionId);
      if (sl) {
        report.shortlistStatus = sl.status;
        if (sl.notes) report.shortlistNotes = sl.notes;
      }
    }
    return report;
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

export function getAllReports(userId?: string | null, role?: UserRole): EvaluationReport[] {
  if (typeof window === "undefined") return [];
  try {
    // Map of session ID -> EvaluationReport
    const reportsMap = new Map<string, EvaluationReport>();

    // 1. If user is recruiter (Company Head), seed all demo candidates into pipeline
    if (role === "recruiter") {
      ALL_DEMO_REPORTS.forEach((demo) => {
        reportsMap.set(demo.sessionId, { ...demo });
      });
    } else if (userId) {
      // 2. If candidate is one of demo users, include their specific demo report
      const matchingDemo = ALL_DEMO_REPORTS.find((d) => d.userId === userId);
      if (matchingDemo) {
        reportsMap.set(matchingDemo.sessionId, { ...matchingDemo });
      }
    }

    // 3. Scan localStorage for any actual evaluations performed on the machine
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEYS.COMPLETED_REPORTS)) {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            const parsed: EvaluationReport = JSON.parse(item);
            if (role === "recruiter") {
              // Recruiter sees ALL reports
              reportsMap.set(parsed.sessionId, parsed);
            } else if (userId) {
              // Candidate ONLY sees their own reports
              if (parsed.userId === userId) {
                reportsMap.set(parsed.sessionId, parsed);
              }
            } else {
              // Guest mode: only show reports not owned by any registered user
              if (!parsed.userId || parsed.userId === "guest") {
                reportsMap.set(parsed.sessionId, parsed);
              }
            }
          } catch {
            // Ignore malformed entries
          }
        }
      }
    }

    const result = Array.from(reportsMap.values()).map((rep) => {
      const sl = getShortlistRecord(rep.sessionId);
      if (sl) {
        return {
          ...rep,
          shortlistStatus: sl.status,
          shortlistNotes: sl.notes || rep.shortlistNotes,
        };
      }
      return rep;
    });

    return result.sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1));
  } catch (err) {
    console.error("Failed to list reports from storage", err);
  }
  return [];
}
