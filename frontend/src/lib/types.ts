export type TargetRole =
  | "frontend"
  | "backend"
  | "fullstack"
  | "python"
  | "java"
  | "data-analyst";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export type InterviewFocus = "dsa" | "core-concepts" | "projects" | "mixed";

export type UserRole = "candidate" | "recruiter";

export type ShortlistStatus = "pending" | "shortlisted" | "under-review" | "rejected";

export interface CandidateShortlistRecord {
  sessionId: string;
  candidateId?: string;
  candidateName: string;
  status: ShortlistStatus;
  updatedAt: string;
  notes?: string;
  reviewedBy?: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyName?: string;
  title?: string;
  createdAt: string;
}

export interface CandidateSetup {
  candidateName: string;
  targetRole: TargetRole;
  experienceLevel: ExperienceLevel;
  interviewFocus: InterviewFocus;
  interviewLength: number; // in minutes (10, 20, 30)
  resumeFileName?: string;
  resumeFileSize?: string;
  isSampleResume?: boolean;
  resumePreviewUrl?: string;
  resumeText?: string;
  skills: string[];
  createdAt: string;
  userId?: string;
}

export interface Question {
  id: string;
  role: TargetRole;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  questionText: string;
  context?: string;
  hint: string;
  expectedKeywords: string[];
  followUpBranches?: {
    keywordTrigger?: string[];
    followUpQuestionId: string;
    rationale: string;
  }[];
}

export interface AnswerFeedback {
  score: number; // 0 - 100
  strengths: string[];
  gaps: string[];
  adaptiveNote: string;
  technicalCorrectness?: "accurate" | "partial" | "incorrect";
  explanationQuality?: "clear" | "acceptable" | "confusing";
  reasoningAndProblemSolving?: string;
  completeness?: "complete" | "partially_complete" | "incomplete";
  evidenceQuote?: string | null;
  missingConcepts?: string[];
  competencyStatus?: SkillStatusCategory;
  confidence?: "high" | "medium" | "low";
}

export interface AnswerRecord {
  questionId: string;
  questionText: string;
  category: string;
  difficulty: string;
  answerText: string;
  submittedAt: string;
  feedback: AnswerFeedback;
}

export type InterviewSessionStatus = "in-progress" | "completed" | "terminated_integrity";

export interface IntegrityEventSummary {
  id: string;
  sessionId: string;
  userId?: string | null;
  eventType: string; // "focus_loss" | "visibility_hidden" | "window_blur" | "camera_multiple_faces" | "camera_missing_face" | "camera_uncalibrated"
  eventNumber: number;
  policyVersion: string;
  stageQuestionId?: string | null;
  stageQuestionIndex?: number | null;
  actionTaken: "warning_issued" | "interview_terminated";
  serverTimestamp: string;
  metadata?: string | null;
}

export interface InterviewSession {
  id: string;
  setup: CandidateSetup;
  status: InterviewSessionStatus;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  answers: AnswerRecord[];
  currentQuestionIndex: number;
  userId?: string;
  integrityPolicyAcknowledgedAt?: string;
  integrityPolicyVersion?: string;
  violationCount?: number;
  terminationReason?: string;
  integrityEvents?: IntegrityEventSummary[];
}

export type SkillStatusCategory =
  | "demonstrated"
  | "claimed_unvalidated"
  | "not_assessed";

export interface EvidenceCitation {
  quote: string; // Verbatim substring from candidate answer
  context: string; // Why this quote supports or does not support the evaluation
  competency: string; // Associated skill / topic area
  questionIndex: number; // 1-indexed (e.g. 1 for Q1)
  questionText?: string;
  confidence: "high" | "medium" | "low";
  status: SkillStatusCategory;
}

export interface RecruiterFollowUp {
  id?: string;
  question: string;
  targetSkill: string;
  rationale: string;
  verificationContext?: string;
  uncertaintyLevel?: "low" | "medium" | "high";
}

export interface SkillMetric {
  category: string;
  score: number; // 0 - 100
  level: "Needs Focus" | "Developing" | "Proficient" | "Mastery";
  totalEvaluated: number;
  status?: SkillStatusCategory;
  confidence?: "high" | "medium" | "low";
  explanation?: string;
  rubricCriteria?: string[];
  evidenceQuote?: string;
  questionReference?: string;
}

export interface EvaluationReport {
  sessionId: string;
  candidateName: string;
  targetRole: string;
  experienceLevel: string;
  interviewFocus: string;
  completedAt: string;
  durationMinutes: number;
  overallScore: number; // 0 - 100
  verdict: "Strong Hire Recommendation" | "Hire Recommendation" | "Additional Review Recommended" | "Terminated (Integrity Policy)";
  metrics: SkillMetric[];
  strengths: string[];
  areasToImprove: string[];
  actionableRoadmap: string[];
  answerRecords: AnswerRecord[];
  isDemoSimulation: boolean;
  userId?: string;
  shortlistStatus?: ShortlistStatus;
  shortlistNotes?: string;
  evidenceCitations?: EvidenceCitation[];
  recruiterFollowUps?: RecruiterFollowUp[];
  skillStatusCounts?: {
    demonstrated: number;
    claimedUnvalidated: number;
    notAssessed: number;
  };
  integrityStatus?: "verified_clean" | "warning_issued" | "terminated_integrity";
  integritySummary?: {
    incidents: number;
    events: IntegrityEventSummary[];
    policyVersion: string;
    acknowledgedAt?: string;
  };
}

