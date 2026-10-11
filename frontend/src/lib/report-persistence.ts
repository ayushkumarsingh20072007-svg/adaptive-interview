import { prisma } from "@/lib/prisma";
import {
  EvaluationReport,
  InterviewSession,
  AnswerRecord,
  SkillMetric,
  EvidenceCitation,
  RecruiterFollowUp,
  ShortlistStatus,
  CandidateShortlistRecord,
} from "./types";

/**
 * Safely parse JSON string with fallback
 */
function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Maps a database EvaluationReport row and its related session/answers
 * back into the strongly typed domain EvaluationReport.
 */
export function mapDbReportToDomain(
  dbReport: any,
  dbAnswers?: any[],
  options?: { isRecruiter?: boolean }
): EvaluationReport {
  const metrics = safeJsonParse<SkillMetric[]>(dbReport.metrics, []);
  const strengths = safeJsonParse<string[]>(dbReport.strengths, []);
  const areasToImprove = safeJsonParse<string[]>(dbReport.areasToImprove, []);
  const actionableRoadmap = safeJsonParse<string[]>(dbReport.actionableRoadmap, []);
  const evidenceCitations = safeJsonParse<EvidenceCitation[] | undefined>(
    dbReport.evidenceCitations,
    undefined
  );
  const recruiterFollowUps = safeJsonParse<RecruiterFollowUp[] | undefined>(
    dbReport.recruiterFollowUps,
    undefined
  );
  const skillStatusCounts = safeJsonParse<
    EvaluationReport["skillStatusCounts"] | undefined
  >(dbReport.skillStatusCounts, undefined);

  // Map answers if provided
  const answerRecords: AnswerRecord[] = (dbAnswers || []).map((ans) => ({
    questionId: ans.questionId,
    questionText: ans.questionText,
    category: ans.category,
    difficulty: ans.difficulty,
    answerText: ans.answerText,
    submittedAt: ans.submittedAt,
    feedback: {
      score: ans.score,
      strengths: safeJsonParse<string[]>(ans.strengths, []),
      gaps: safeJsonParse<string[]>(ans.gaps, []),
      adaptiveNote: ans.adaptiveNote || "",
    },
  }));

  // Map review if associated with session
  const review = dbReport.session?.review;
  const shortlistStatus = (review?.status as EvaluationReport["shortlistStatus"]) || undefined;
  // Never leak recruiter-only review notes to candidates
  const shortlistNotes = options?.isRecruiter ? (review?.notes || undefined) : undefined;

  return {
    sessionId: dbReport.sessionId,
    candidateName: dbReport.candidateName,
    targetRole: dbReport.targetRole,
    experienceLevel: dbReport.experienceLevel,
    interviewFocus: dbReport.interviewFocus,
    completedAt: dbReport.completedAt,
    durationMinutes: dbReport.durationMinutes,
    overallScore: dbReport.overallScore,
    verdict: dbReport.verdict as EvaluationReport["verdict"],
    metrics,
    strengths,
    areasToImprove,
    actionableRoadmap,
    answerRecords,
    isDemoSimulation: Boolean(dbReport.isDemoSimulation),
    userId: dbReport.session?.userId || undefined,
    shortlistStatus,
    shortlistNotes,
    evidenceCitations,
    recruiterFollowUps,
    skillStatusCounts,
  };
}

/**
 * Persist or update an InterviewSession in SQLite
 */
export async function persistSession(
  session: InterviewSession,
  userId?: string
) {
  const skillsJson = JSON.stringify(session.setup?.skills || []);

  const existing = await prisma.interviewSession.findUnique({
    where: { id: session.id },
  });

  // Never allow a candidate to overwrite another candidate's private session
  if (existing && existing.userId && userId && existing.userId !== userId) {
    throw new Error("Cannot overwrite another candidate's private session");
  }

  const effectiveUserId = userId || session.userId || existing?.userId || null;

  return await prisma.interviewSession.upsert({
    where: { id: session.id },
    create: {
      id: session.id,
      userId: effectiveUserId,
      candidateName: session.setup?.candidateName || "Candidate",
      targetRole: session.setup?.targetRole || "fullstack",
      experienceLevel: session.setup?.experienceLevel || "intermediate",
      interviewFocus: session.setup?.interviewFocus || "mixed",
      interviewLength: session.setup?.interviewLength || 20,
      skills: skillsJson,
      resumeFileName: session.setup?.resumeFileName || null,
      isSampleResume: Boolean(session.setup?.isSampleResume),
      status: session.status || "in-progress",
      durationSeconds: session.durationSeconds || 0,
      startedAt: session.startedAt ? new Date(session.startedAt) : new Date(),
      endedAt: session.endedAt ? new Date(session.endedAt) : null,
    },
    update: {
      status: session.status || "in-progress",
      durationSeconds: session.durationSeconds || 0,
      endedAt: session.endedAt ? new Date(session.endedAt) : undefined,
      userId: effectiveUserId || undefined,
    },
  });
}

/**
 * Persist an AnswerRecord turn into SQLite with deduplication
 */
export async function persistAnswer(
  sessionId: string,
  answer: AnswerRecord,
  userId?: string
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Ensure the session exists in SQLite
    const existingSession = await tx.interviewSession.findUnique({
      where: { id: sessionId },
    });

    if (existingSession && existingSession.userId && userId && existingSession.userId !== userId) {
      throw new Error("Unauthorized session access");
    }

    if (!existingSession) {
      await tx.interviewSession.create({
        data: {
          id: sessionId,
          userId: userId || null,
          candidateName: "Candidate",
          targetRole: "fullstack",
          experienceLevel: "intermediate",
          interviewFocus: "mixed",
          interviewLength: 20,
          skills: "[]",
          status: "in-progress",
        },
      });
    } else if (userId && !existingSession.userId) {
      await tx.interviewSession.update({
        where: { id: sessionId },
        data: { userId },
      });
    }

    // 2. Deduplicate: check if an answer for this questionId already exists in this session
    const existingAnswer = await tx.interviewAnswer.findFirst({
      where: {
        sessionId,
        questionId: answer.questionId,
      },
    });

    const strengthsJson = JSON.stringify(answer.feedback?.strengths || []);
    const gapsJson = JSON.stringify(answer.feedback?.gaps || []);

    if (existingAnswer) {
      // Update existing turn answer
      return await tx.interviewAnswer.update({
        where: { id: existingAnswer.id },
        data: {
          answerText: answer.answerText,
          score: answer.feedback?.score || 0,
          strengths: strengthsJson,
          gaps: gapsJson,
          adaptiveNote: answer.feedback?.adaptiveNote || null,
        },
      });
    }

    // Insert new turn
    return await tx.interviewAnswer.create({
      data: {
        sessionId,
        questionId: answer.questionId,
        questionText: answer.questionText,
        category: answer.category,
        difficulty: answer.difficulty,
        answerText: answer.answerText,
        score: answer.feedback?.score || 0,
        strengths: strengthsJson,
        gaps: gapsJson,
        adaptiveNote: answer.feedback?.adaptiveNote || null,
        submittedAt: answer.submittedAt || new Date().toISOString(),
      },
    });
  });
}

/**
 * Persist completed EvaluationReport and mark InterviewSession completed in SQLite
 */
export async function persistReport(
  report: EvaluationReport,
  sessionOrUserId?: InterviewSession | string,
  maybeUserId?: string
) {
  let session: InterviewSession | undefined;
  let userId: string | undefined;
  if (typeof sessionOrUserId === "string") {
    userId = sessionOrUserId;
  } else {
    session = sessionOrUserId;
    userId = maybeUserId;
  }

  const sessionId = report.sessionId;

  return await prisma.$transaction(async (tx) => {
    // Check ownership against existing session
    const existingSession = await tx.interviewSession.findUnique({
      where: { id: sessionId },
    });

    if (existingSession && existingSession.userId && userId && existingSession.userId !== userId) {
      throw new Error("Cannot save report to another candidate's session");
    }

    const durationMinutes = Math.max(1, Math.round(Number(report.durationMinutes) || (session?.durationSeconds ? session.durationSeconds / 60 : 15)));
    const durationSeconds = durationMinutes * 60;

    // 1. Ensure session exists and update status to completed
    if (session) {
      const skillsJson = JSON.stringify(session.setup?.skills || []);
      const effectiveUserId = userId || session.userId || existingSession?.userId || null;

      await tx.interviewSession.upsert({
        where: { id: session.id },
        create: {
          id: session.id,
          userId: effectiveUserId,
          candidateName: session.setup?.candidateName || report.candidateName || "Candidate",
          targetRole: session.setup?.targetRole || report.targetRole,
          experienceLevel: session.setup?.experienceLevel || report.experienceLevel,
          interviewFocus: session.setup?.interviewFocus || report.interviewFocus,
          interviewLength: session.setup?.interviewLength || 20,
          skills: skillsJson,
          resumeFileName: session.setup?.resumeFileName || null,
          isSampleResume: Boolean(session.setup?.isSampleResume),
          status: "completed",
          durationSeconds,
          startedAt: session.startedAt ? new Date(session.startedAt) : new Date(),
          endedAt: new Date(),
        },
        update: {
          status: "completed",
          durationSeconds,
          endedAt: new Date(),
          userId: effectiveUserId || undefined,
        },
      });
    } else if (existingSession) {
      await tx.interviewSession.update({
        where: { id: sessionId },
        data: {
          status: "completed",
          endedAt: new Date(),
          durationSeconds,
        },
      });
    } else {
      await tx.interviewSession.create({
        data: {
          id: sessionId,
          userId: userId || null,
          candidateName: report.candidateName || "Candidate",
          targetRole: report.targetRole || "fullstack",
          experienceLevel: report.experienceLevel || "intermediate",
          interviewFocus: report.interviewFocus || "mixed",
          interviewLength: 20,
          skills: "[]",
          status: "completed",
          durationSeconds,
          startedAt: new Date(),
          endedAt: new Date(),
        },
      });
    }

    // 2. Persist answer records from report if present
    if (report.answerRecords && report.answerRecords.length > 0) {
      for (const ans of report.answerRecords) {
        const existingAnswer = await tx.interviewAnswer.findFirst({
          where: { sessionId, questionId: ans.questionId },
        });

        const strengthsJson = JSON.stringify(ans.feedback?.strengths || []);
        const gapsJson = JSON.stringify(ans.feedback?.gaps || []);

        if (existingAnswer) {
          await tx.interviewAnswer.update({
            where: { id: existingAnswer.id },
            data: {
              answerText: ans.answerText,
              score: ans.feedback?.score || 0,
              strengths: strengthsJson,
              gaps: gapsJson,
              adaptiveNote: ans.feedback?.adaptiveNote || null,
            },
          });
        } else {
          await tx.interviewAnswer.create({
            data: {
              sessionId,
              questionId: ans.questionId,
              questionText: ans.questionText,
              category: ans.category,
              difficulty: ans.difficulty,
              answerText: ans.answerText,
              score: ans.feedback?.score || 0,
              strengths: strengthsJson,
              gaps: gapsJson,
              adaptiveNote: ans.feedback?.adaptiveNote || null,
              submittedAt: ans.submittedAt || new Date().toISOString(),
            },
          });
        }
      }
    }

    // 3. Serialize structured fields for SQLite storage
    const metricsJson = JSON.stringify(report.metrics || []);
    const strengthsJson = JSON.stringify(report.strengths || []);
    const areasToImproveJson = JSON.stringify(report.areasToImprove || []);
    const actionableRoadmapJson = JSON.stringify(report.actionableRoadmap || []);
    const evidenceCitationsJson = report.evidenceCitations
      ? JSON.stringify(report.evidenceCitations)
      : null;
    const recruiterFollowUpsJson = report.recruiterFollowUps
      ? JSON.stringify(report.recruiterFollowUps)
      : null;
    const skillStatusCountsJson = report.skillStatusCounts
      ? JSON.stringify(report.skillStatusCounts)
      : null;

    // 4. Upsert EvaluationReport to guarantee idempotency and avoid duplicate key collisions
    const savedReport = await tx.evaluationReport.upsert({
      where: { sessionId },
      create: {
        session: { connect: { id: sessionId } },
        candidateName: report.candidateName,
        targetRole: report.targetRole,
        experienceLevel: report.experienceLevel,
        interviewFocus: report.interviewFocus || session?.setup?.interviewFocus || "mixed",
        completedAt: report.completedAt,
        durationMinutes,
        overallScore: Math.round(Number(report.overallScore) || 0),
        verdict: report.verdict,
        metrics: metricsJson,
        strengths: strengthsJson,
        areasToImprove: areasToImproveJson,
        actionableRoadmap: actionableRoadmapJson,
        evidenceCitations: evidenceCitationsJson,
        recruiterFollowUps: recruiterFollowUpsJson,
        skillStatusCounts: skillStatusCountsJson,
        isDemoSimulation: Boolean(report.isDemoSimulation),
      },
      update: {
        candidateName: report.candidateName,
        targetRole: report.targetRole,
        experienceLevel: report.experienceLevel,
        interviewFocus: report.interviewFocus || session?.setup?.interviewFocus || "mixed",
        completedAt: report.completedAt,
        durationMinutes,
        overallScore: Math.round(Number(report.overallScore) || 0),
        verdict: report.verdict,
        metrics: metricsJson,
        strengths: strengthsJson,
        areasToImprove: areasToImproveJson,
        actionableRoadmap: actionableRoadmapJson,
        evidenceCitations: evidenceCitationsJson,
        recruiterFollowUps: recruiterFollowUpsJson,
        skillStatusCounts: skillStatusCountsJson,
        isDemoSimulation: Boolean(report.isDemoSimulation),
      },
      include: {
        session: {
          include: {
            answers: true,
          },
        },
      },
    });

    return mapDbReportToDomain(savedReport, savedReport.session?.answers);
  });
}

/**
 * Retrieve an EvaluationReport by sessionId with authorization checks
 */
export async function getReportById(
  sessionId: string,
  user?: { id: string; role?: string } | null
): Promise<{ report: EvaluationReport | null; status: 200 | 403 | 404 }> {
  const isRecruiter = user?.role === "recruiter";

  const dbReport = await prisma.evaluationReport.findUnique({
    where: { sessionId },
    include: {
      session: {
        include: {
          answers: true,
          review: true,
        },
      },
    },
  });

  if (!dbReport) {
    return { report: null, status: 404 };
  }

  // Authorization check
  const reportUserId = dbReport.session?.userId;

  // If report is tied to a specific user and caller is a candidate
  if (reportUserId && reportUserId !== "guest") {
    if (!isRecruiter) {
      if (!user || user.id !== reportUserId) {
        return { report: null, status: 403 };
      }
    }
  }

  const domainReport = mapDbReportToDomain(
    dbReport,
    dbReport.session?.answers,
    { isRecruiter }
  );

  return { report: domainReport, status: 200 };
}

/**
 * Retrieve all EvaluationReports visible to the given user
 */
export async function getAllPersistedReports(
  user?: { id: string; role?: string } | null
): Promise<EvaluationReport[]> {
  const isRecruiter = user?.role === "recruiter";

  const dbReports = await prisma.evaluationReport.findMany({
    where: isRecruiter
      ? undefined
      : user?.id
      ? { session: { userId: user.id } }
      : { session: { userId: null } },
    include: {
      session: {
        include: {
          answers: true,
          review: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return dbReports.map((dbRep) =>
    mapDbReportToDomain(dbRep, dbRep.session?.answers, { isRecruiter })
  );
}

export interface UpsertReviewInput {
  sessionId: string;
  candidateName?: string;
  status?: ShortlistStatus;
  notes?: string | null;
  reviewerId: string;
  reviewedBy: string;
}

/**
 * Persist or update a RecruiterReview in SQLite with transaction safety
 */
export async function persistRecruiterReview(
  input: UpsertReviewInput
): Promise<CandidateShortlistRecord> {
  const { sessionId, candidateName, status, notes, reviewerId, reviewedBy } = input;

  return await prisma.$transaction(async (tx) => {
    // 1. Ensure InterviewSession exists in SQLite to satisfy the foreign key constraint
    let existingSession = await tx.interviewSession.findUnique({
      where: { id: sessionId },
    });

    if (!existingSession) {
      existingSession = await tx.interviewSession.create({
        data: {
          id: sessionId,
          candidateName: candidateName || "Candidate",
          targetRole: "fullstack",
          experienceLevel: "senior",
          interviewFocus: "mixed",
          interviewLength: 20,
          skills: "[]",
          status: "completed",
        },
      });
    }

    // 2. Upsert RecruiterReview idempotently
    const dbReview = await tx.recruiterReview.upsert({
      where: { sessionId },
      create: {
        sessionId,
        candidateName: candidateName || existingSession.candidateName || "Candidate",
        status: status || "pending",
        notes: notes !== undefined ? notes : null,
        reviewerId,
        reviewedBy,
      },
      update: {
        status: status !== undefined ? status : undefined,
        notes: notes !== undefined ? notes : undefined,
        candidateName: candidateName || undefined,
        reviewerId,
        reviewedBy,
      },
    });

    return {
      sessionId: dbReview.sessionId,
      candidateName: dbReview.candidateName,
      status: dbReview.status as ShortlistStatus,
      updatedAt: dbReview.updatedAt.toISOString(),
      notes: dbReview.notes || undefined,
      reviewedBy: dbReview.reviewedBy || undefined,
    };
  });
}

/**
 * Retrieve a single RecruiterReview by sessionId
 */
export async function getRecruiterReview(
  sessionId: string
): Promise<CandidateShortlistRecord | null> {
  const review = await prisma.recruiterReview.findUnique({
    where: { sessionId },
  });

  if (!review) return null;

  return {
    sessionId: review.sessionId,
    candidateName: review.candidateName,
    status: review.status as ShortlistStatus,
    updatedAt: review.updatedAt.toISOString(),
    notes: review.notes || undefined,
    reviewedBy: review.reviewedBy || undefined,
  };
}

/**
 * Retrieve all RecruiterReviews ordered by last update
 */
export async function getAllRecruiterReviews(): Promise<CandidateShortlistRecord[]> {
  const reviews = await prisma.recruiterReview.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return reviews.map((r) => ({
    sessionId: r.sessionId,
    candidateName: r.candidateName,
    status: r.status as ShortlistStatus,
    updatedAt: r.updatedAt.toISOString(),
    notes: r.notes || undefined,
    reviewedBy: r.reviewedBy || undefined,
  }));
}
