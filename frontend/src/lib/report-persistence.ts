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
export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
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

  // Map integrity metadata
  const integritySummaryFromDb = safeJsonParse<EvaluationReport["integritySummary"]>(
    dbReport.integritySummary,
    undefined
  );

  const sessionEvents = dbReport.session?.integrityEvents;
  const integritySummary: EvaluationReport["integritySummary"] =
    integritySummaryFromDb ||
    (sessionEvents && sessionEvents.length > 0
      ? {
          incidents: dbReport.session.violationCount || 0,
          events: sessionEvents.map((e: any) => ({
            id: e.id,
            sessionId: e.sessionId,
            userId: e.userId,
            eventType: e.eventType,
            eventNumber: e.eventNumber,
            policyVersion: e.policyVersion,
            stageQuestionId: e.stageQuestionId,
            stageQuestionIndex: e.stageQuestionIndex,
            actionTaken: e.actionTaken,
            serverTimestamp:
              typeof e.serverTimestamp === "string"
                ? e.serverTimestamp
                : e.serverTimestamp?.toISOString() || new Date().toISOString(),
          })),
          policyVersion: dbReport.session.integrityPolicyVersion || "v1.0",
          acknowledgedAt: dbReport.session.integrityPolicyAcknowledgedAt
            ? typeof dbReport.session.integrityPolicyAcknowledgedAt === "string"
              ? dbReport.session.integrityPolicyAcknowledgedAt
              : dbReport.session.integrityPolicyAcknowledgedAt.toISOString()
            : undefined,
        }
      : undefined);

  const integrityStatus =
    dbReport.integrityStatus ||
    (dbReport.session?.status === "terminated_integrity"
      ? "terminated_integrity"
      : dbReport.session?.violationCount > 0
      ? "warning_issued"
      : "verified_clean");

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
    integrityStatus,
    integritySummary,
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

  // Never allow an unauthorized or unauthenticated caller to overwrite another candidate's private session
  if (existing && existing.userId && existing.userId !== "guest") {
    if (!userId || existing.userId !== userId) {
      throw new Error("Cannot overwrite another candidate's private session");
    }
  }

  const effectiveUserId = userId || existing?.userId || null;

  // Prevent reviving or reverting completed or terminated sessions
  const isTerminalExisting =
    existing?.status === "completed" || existing?.status === "terminated_integrity";
  const updatedStatus = isTerminalExisting ? existing.status : (session.status || "in-progress");

  const isCompleted = updatedStatus === "completed" || session.status === "completed";
  const finalEndedAt = isCompleted
    ? (session.endedAt ? new Date(session.endedAt) : (existing?.endedAt || new Date()))
    : (session.endedAt ? new Date(session.endedAt) : null);

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
      endedAt: finalEndedAt,
      integrityPolicyAcknowledgedAt: session.integrityPolicyAcknowledgedAt
        ? new Date(session.integrityPolicyAcknowledgedAt)
        : null,
      integrityPolicyVersion: session.integrityPolicyVersion || null,
      violationCount: session.violationCount || 0,
      terminationReason: session.terminationReason || null,
    },
    update: {
      status: updatedStatus,
      durationSeconds: isTerminalExisting ? (existing?.durationSeconds || session.durationSeconds || 0) : (session.durationSeconds || 0),
      endedAt: isCompleted ? finalEndedAt : (session.endedAt ? new Date(session.endedAt) : undefined),
      userId: effectiveUserId || undefined,
      integrityPolicyAcknowledgedAt: session.integrityPolicyAcknowledgedAt
        ? new Date(session.integrityPolicyAcknowledgedAt)
        : undefined,
      integrityPolicyVersion: session.integrityPolicyVersion || undefined,
      violationCount: session.violationCount !== undefined ? session.violationCount : undefined,
      terminationReason: session.terminationReason || undefined,
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

    if (existingSession && existingSession.userId && existingSession.userId !== "guest") {
      if (!userId || existingSession.userId !== userId) {
        throw new Error("Unauthorized session access");
      }
    }

    if (existingSession && existingSession.status === "terminated_integrity") {
      throw new Error("Cannot submit answers to a terminated interview session");
    }

    if (existingSession && existingSession.status === "completed") {
      throw new Error("Cannot submit answers to an already completed interview session");
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

    // 2. Deduplicate: check if answers for this questionId already exist in this session
    const existingAnswers = await tx.interviewAnswer.findMany({
      where: {
        sessionId,
        questionId: answer.questionId,
      },
      orderBy: { id: "asc" },
    });

    const strengthsJson = JSON.stringify(answer.feedback?.strengths || []);
    const gapsJson = JSON.stringify(answer.feedback?.gaps || []);

    if (existingAnswers.length > 0) {
      const primary = existingAnswers[0];
      // Prune any duplicate records created during concurrent race conditions
      if (existingAnswers.length > 1) {
        const duplicateIds = existingAnswers.slice(1).map((a) => a.id);
        await tx.interviewAnswer.deleteMany({
          where: { id: { in: duplicateIds } },
        });
      }

      // Update primary turn answer
      return await tx.interviewAnswer.update({
        where: { id: primary.id },
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

    if (existingSession && existingSession.userId && existingSession.userId !== "guest") {
      if (!userId || existingSession.userId !== userId) {
        throw new Error("Cannot save report to another candidate's session");
      }
    }

    const durationMinutes = Math.max(1, Math.round(Number(report.durationMinutes) || (session?.durationSeconds ? session.durationSeconds / 60 : 15)));
    const durationSeconds = durationMinutes * 60;

    // 1. Ensure session exists and update status to completed (or retain terminated_integrity)
    const targetStatus =
      existingSession?.status === "terminated_integrity" ||
      report.verdict === "Terminated (Integrity Policy)" ||
      report.integrityStatus === "terminated_integrity"
        ? "terminated_integrity"
        : "completed";

    if (session) {
      const skillsJson = JSON.stringify(session.setup?.skills || []);
      const effectiveUserId = userId || existingSession?.userId || null;

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
          status: targetStatus,
          durationSeconds,
          startedAt: session.startedAt ? new Date(session.startedAt) : new Date(),
          endedAt: new Date(),
        },
        update: {
          status: targetStatus,
          durationSeconds,
          endedAt: new Date(),
          userId: effectiveUserId || undefined,
        },
      });
    } else if (existingSession) {
      await tx.interviewSession.update({
        where: { id: sessionId },
        data: {
          status: targetStatus,
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
          status: targetStatus,
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
    const integritySummaryJson = report.integritySummary
      ? JSON.stringify(report.integritySummary)
      : null;
    const integrityStatus =
      report.integrityStatus ||
      (targetStatus === "terminated_integrity"
        ? "terminated_integrity"
        : (existingSession?.violationCount || 0) > 0
        ? "warning_issued"
        : "verified_clean");

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
        integrityStatus,
        integritySummary: integritySummaryJson,
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
        integrityStatus,
        integritySummary: integritySummaryJson,
      },
      include: {
        session: {
          include: {
            answers: true,
            integrityEvents: {
              orderBy: { createdAt: "asc" },
            },
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
          integrityEvents: {
            orderBy: { createdAt: "asc" },
          },
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
          integrityEvents: {
            orderBy: { createdAt: "asc" },
          },
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

/**
 * Acknowledge Interview Integrity Policy for a session
 */
export async function acknowledgeIntegrityPolicy(
  sessionId: string,
  userId?: string,
  policyVersion = "v1.0"
) {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.interviewSession.findUnique({
      where: { id: sessionId },
    });

    if (existing && existing.userId && userId && existing.userId !== userId) {
      throw new Error("Unauthorized session access: cannot acknowledge policy for another candidate's session");
    }

    if (existing && existing.status === "terminated_integrity") {
      throw new Error("Cannot acknowledge integrity policy for a terminated interview session");
    }

    const ackTime = new Date();

    return await tx.interviewSession.upsert({
      where: { id: sessionId },
      create: {
        id: sessionId,
        userId: userId || null,
        candidateName: "Candidate",
        targetRole: "fullstack",
        experienceLevel: "intermediate",
        interviewFocus: "mixed",
        skills: "[]",
        status: "in-progress",
        integrityPolicyAcknowledgedAt: ackTime,
        integrityPolicyVersion: policyVersion,
      },
      update: {
        integrityPolicyAcknowledgedAt: ackTime,
        integrityPolicyVersion: policyVersion,
      },
    });
  });
}

export interface RecordViolationInput {
  sessionId: string;
  userId?: string;
  eventType?: string;
  idempotencyKey?: string;
  stageQuestionId?: string;
  stageQuestionIndex?: number;
  clientTimestamp?: string;
  policyVersion?: string;
}

/**
 * Authoritative Server State Machine for Focus-Loss Incidents
 * Policy:
 * - 1st Incident: Records event, issues Warning 1 of 2.
 * - 2nd Incident: Records event, terminates session (status: 'terminated_integrity').
 * Idempotent: repeated submissions with same idempotencyKey return existing count.
 * Concurrency-safe: executes inside a Prisma SQLite transaction.
 */
export async function recordIntegrityViolation(input: RecordViolationInput) {
  const {
    sessionId,
    userId,
    eventType = "focus_loss",
    idempotencyKey,
    stageQuestionId,
    stageQuestionIndex,
    clientTimestamp,
    policyVersion = "v1.0",
  } = input;

  return await prisma.$transaction(async (tx) => {
    // 1. Fetch existing session
    const session = await tx.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        integrityEvents: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session) {
      throw new Error("Interview session not found");
    }

    // 2. Candidate ownership verification: Never trust client-supplied ownership
    if (session.userId && userId && session.userId !== userId) {
      throw new Error("Unauthorized session access: cannot report integrity events for another candidate's session");
    }

    // 2b. Policy acknowledgement check: Policy must be acknowledged before recording monitoring events
    if (!session.integrityPolicyAcknowledgedAt) {
      const err = new Error("Integrity policy must be acknowledged before recording monitoring events");
      (err as any).requiresPolicyAcknowledgement = true;
      (err as any).statusCode = 400;
      throw err;
    }

    // 3. Check if session was already normally completed: do not modify completed sessions
    if (session.status === "completed") {
      const err = new Error("Interview session is completed and no longer active for integrity monitoring");
      (err as any).statusCode = 400;
      throw err;
    }

    // 4. Idempotency Check: if idempotencyKey is already used, return recorded result
    if (idempotencyKey) {
      const existingEvent = await tx.interviewIntegrityEvent.findUnique({
        where: { idempotencyKey },
      });
      if (existingEvent) {
        return {
          idempotent: true,
          event: existingEvent,
          violationCount: session.violationCount,
          actionTaken: existingEvent.actionTaken,
          status: session.status,
          session,
        };
      }
    }

    // 5. Terminal State Check: If session is already terminated, reject count alteration
    if (session.status === "terminated_integrity" || session.violationCount >= 2) {
      const err = new Error("Interview session is already terminated by integrity policy");
      (err as any).terminated = true;
      (err as any).statusCode = 400;
      throw err;
    }

    // 6. Authoritative increment
    const nextViolationCount = session.violationCount + 1;
    const actionTaken = nextViolationCount >= 2 ? "interview_terminated" : "warning_issued";
    const nextStatus = nextViolationCount >= 2 ? "terminated_integrity" : session.status;
    const terminationReason =
      nextViolationCount >= 2
        ? "Exceeded allowable workspace focus-loss limit (2 of 2 incidents)"
        : session.terminationReason;

    const event = await tx.interviewIntegrityEvent.create({
      data: {
        sessionId,
        userId: userId || session.userId || null,
        eventType,
        eventNumber: nextViolationCount,
        policyVersion,
        stageQuestionId: stageQuestionId || null,
        stageQuestionIndex: stageQuestionIndex !== undefined ? stageQuestionIndex : null,
        actionTaken,
        idempotencyKey: idempotencyKey || null,
        clientTimestamp: clientTimestamp || null,
        serverTimestamp: new Date(),
      },
    });

    const updatedSession = await tx.interviewSession.update({
      where: { id: sessionId },
      data: {
        violationCount: nextViolationCount,
        status: nextStatus,
        terminationReason,
        endedAt: nextViolationCount >= 2 ? new Date() : undefined,
      },
      include: {
        integrityEvents: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return {
      idempotent: false,
      event,
      violationCount: nextViolationCount,
      actionTaken,
      status: nextStatus,
      session: updatedSession,
    };
  });
}

/**
 * Retrieve integrity audit details for a session
 */
export async function getIntegrityAudit(sessionId: string) {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: {
      integrityEvents: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!session) return null;

  return {
    sessionId: session.id,
    userId: session.userId,
    status: session.status,
    violationCount: session.violationCount,
    terminationReason: session.terminationReason,
    policyAcknowledgedAt: session.integrityPolicyAcknowledgedAt?.toISOString() || null,
    policyVersion: session.integrityPolicyVersion || "v1.0",
    events: session.integrityEvents.map((e) => ({
      id: e.id,
      sessionId: e.sessionId,
      userId: e.userId,
      eventType: e.eventType,
      eventNumber: e.eventNumber,
      policyVersion: e.policyVersion,
      stageQuestionId: e.stageQuestionId,
      stageQuestionIndex: e.stageQuestionIndex,
      actionTaken: e.actionTaken as "warning_issued" | "interview_terminated",
      serverTimestamp: e.serverTimestamp.toISOString(),
    })),
  };
}
