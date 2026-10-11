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
  interviewLength: number;
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
  score: number;
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

export type SkillStatusCategory =
  | "demonstrated"
  | "claimed_unvalidated"
  | "not_assessed";

export interface EvidenceCitation {
  quote: string;
  context: string;
  competency: string;
  questionIndex: number;
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
  score: number;
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
  overallScore: number;
  verdict: "Strong Hire Recommendation" | "Hire Recommendation" | "Additional Review Recommended";
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
}
