export type TargetRole =
  | "frontend"
  | "backend"
  | "fullstack"
  | "python"
  | "java"
  | "data-analyst";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export type InterviewFocus = "dsa" | "core-concepts" | "projects" | "mixed";

export interface UserAccount {
  id: string;
  name: string;
  email: string;
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

export interface InterviewSession {
  id: string;
  setup: CandidateSetup;
  status: "in-progress" | "completed";
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  answers: AnswerRecord[];
  currentQuestionIndex: number;
  userId?: string;
}

export interface SkillMetric {
  category: string;
  score: number; // 0 - 100
  level: "Needs Focus" | "Developing" | "Proficient" | "Mastery";
  totalEvaluated: number;
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
  verdict: "Strong Hire Recommendation" | "Hire Recommendation" | "Additional Review Recommended";
  metrics: SkillMetric[];
  strengths: string[];
  areasToImprove: string[];
  actionableRoadmap: string[];
  answerRecords: AnswerRecord[];
  isDemoSimulation: boolean;
  userId?: string;
}

