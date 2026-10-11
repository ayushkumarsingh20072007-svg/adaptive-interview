-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "companyName" TEXT,
    "title" TEXT,
    "passwordHash" TEXT NOT NULL,
    "passwordSalt" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InterviewSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "candidateName" TEXT NOT NULL,
    "targetRole" TEXT NOT NULL,
    "experienceLevel" TEXT NOT NULL,
    "interviewFocus" TEXT NOT NULL,
    "interviewLength" INTEGER NOT NULL DEFAULT 20,
    "skills" TEXT NOT NULL,
    "resumeFileName" TEXT,
    "isSampleResume" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'in-progress',
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterviewSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InterviewAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "answerText" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "strengths" TEXT NOT NULL,
    "gaps" TEXT NOT NULL,
    "adaptiveNote" TEXT,
    "submittedAt" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterviewAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvaluationReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "targetRole" TEXT NOT NULL,
    "experienceLevel" TEXT NOT NULL,
    "interviewFocus" TEXT NOT NULL,
    "completedAt" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "verdict" TEXT NOT NULL,
    "metrics" TEXT NOT NULL,
    "strengths" TEXT NOT NULL,
    "areasToImprove" TEXT NOT NULL,
    "actionableRoadmap" TEXT NOT NULL,
    "evidenceCitations" TEXT,
    "recruiterFollowUps" TEXT,
    "skillStatusCounts" TEXT,
    "isDemoSimulation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvaluationReport_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecruiterReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "reviewerId" TEXT,
    "reviewedBy" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecruiterReview_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecruiterReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_token_key" ON "AuthSession"("token");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "InterviewSession_userId_idx" ON "InterviewSession"("userId");

-- CreateIndex
CREATE INDEX "InterviewAnswer_sessionId_idx" ON "InterviewAnswer"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationReport_sessionId_key" ON "EvaluationReport"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "RecruiterReview_sessionId_key" ON "RecruiterReview"("sessionId");
