import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const prisma = new PrismaClient();

const DEMO_SALT = "demo_salt_interviewiq_2026";

function hashPassword(password: string, salt: string): string {
  return crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");
}

// 4 Core Demo identities + backward-compatible aliases
const DEMO_USERS = [
  {
    id: "usr_demo_recruiter",
    name: "Sarah Jenkins",
    email: "recruiter@interviewiq.ai",
    role: "recruiter",
    companyName: "TechCorp Global",
    title: "Head of Technical Talent",
    passwordSalt: DEMO_SALT,
    passwordHash: hashPassword("Password123", DEMO_SALT),
  },
  {
    id: "usr_demo_alex",
    name: "Alex Rivera",
    email: "alex.rivera@example.com",
    role: "candidate",
    companyName: undefined,
    title: "Full Stack Developer",
    passwordSalt: DEMO_SALT,
    passwordHash: hashPassword("Password123", DEMO_SALT),
  },
  {
    id: "usr_demo_maya",
    name: "Maya Patel",
    email: "maya.patel@example.com",
    role: "candidate",
    companyName: undefined,
    title: "Frontend Developer",
    passwordSalt: DEMO_SALT,
    passwordHash: hashPassword("Password123", DEMO_SALT),
  },
  {
    id: "usr_demo_liam",
    name: "Liam Chen",
    email: "liam.chen@example.com",
    role: "candidate",
    companyName: undefined,
    title: "Backend Developer",
    passwordSalt: DEMO_SALT,
    passwordHash: hashPassword("Password123", DEMO_SALT),
  },
  {
    id: "usr_demo_priya",
    name: "Priya Sharma",
    email: "priya.sharma@example.com",
    role: "candidate",
    companyName: undefined,
    title: "Frontend Engineer",
    passwordSalt: DEMO_SALT,
    passwordHash: hashPassword("Password123", DEMO_SALT),
  },
  {
    id: "usr_demo_marcus",
    name: "Marcus Chen",
    email: "marcus.chen@example.com",
    role: "candidate",
    companyName: undefined,
    title: "Backend Engineer",
    passwordSalt: DEMO_SALT,
    passwordHash: hashPassword("Password123", DEMO_SALT),
  },
  {
    id: "usr_demo_rohan",
    name: "Rohan Gupta",
    email: "rohan.gupta@example.com",
    role: "candidate",
    companyName: undefined,
    title: "Python Developer",
    passwordSalt: DEMO_SALT,
    passwordHash: hashPassword("Password123", DEMO_SALT),
  },
];

export async function seedAndImport() {
  console.log("=== Starting Idempotent Authentication Import & Seed ===");

  let importedUsersCount = 0;
  let skippedUsersCount = 0;
  let importedSessionsCount = 0;
  let conflictsCount = 0;

  // 1. Seed Core Demo Users
  for (const demo of DEMO_USERS) {
    const existing = await prisma.user.findUnique({
      where: { email: demo.email.toLowerCase() },
    });

    if (!existing) {
      await prisma.user.create({
        data: {
          id: demo.id,
          name: demo.name,
          email: demo.email.toLowerCase(),
          role: demo.role,
          companyName: demo.companyName || null,
          title: demo.title || null,
          passwordHash: demo.passwordHash,
          passwordSalt: demo.passwordSalt,
        },
      });
      importedUsersCount++;
    } else {
      if (existing.id !== demo.id) {
        console.warn(`[Conflict Notice] Existing user email matches demo email with different ID: ${existing.email}`);
        conflictsCount++;
      } else {
        skippedUsersCount++;
      }
    }
  }

  // 2. Safe Legacy Import from frontend/data/auth-store.json (if present)
  const legacyStorePath = path.join(process.cwd(), "data", "auth-store.json");
  if (fs.existsSync(legacyStorePath)) {
    try {
      const raw = fs.readFileSync(legacyStorePath, "utf8");
      const data = JSON.parse(raw);
      const legacyUsers = Array.isArray(data.users) ? data.users : [];
      const legacySessions = Array.isArray(data.sessions) ? data.sessions : [];

      console.log(`Found legacy auth store with ${legacyUsers.length} users and ${legacySessions.length} sessions.`);

      for (const legUser of legacyUsers) {
        if (!legUser.email || !legUser.passwordHash || !legUser.passwordSalt) continue;
        const normalizedEmail = legUser.email.trim().toLowerCase();

        const existing = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (!existing) {
          await prisma.user.create({
            data: {
              id: legUser.id || undefined,
              name: legUser.name || "User",
              email: normalizedEmail,
              role: legUser.role || "candidate",
              companyName: legUser.companyName || null,
              title: legUser.title || null,
              passwordHash: legUser.passwordHash,
              passwordSalt: legUser.passwordSalt,
              createdAt: legUser.createdAt ? new Date(legUser.createdAt) : new Date(),
            },
          });
          importedUsersCount++;
        } else {
          // Verify ID matching
          if (legUser.id && existing.id !== legUser.id) {
            console.warn(`[Conflict Notice] Legacy user ID ${legUser.id} differs from DB ID ${existing.id} for email ${normalizedEmail}. Preserving DB record.`);
            conflictsCount++;
          } else {
            skippedUsersCount++;
          }
        }
      }

      // Migrate active, non-expired sessions
      const now = Date.now();
      for (const legSess of legacySessions) {
        if (!legSess.token || !legSess.userId || !legSess.expiresAt) continue;

        // Skip expired sessions
        if (legSess.expiresAt <= now) continue;

        // Verify that the user exists in database
        const userExists = await prisma.user.findUnique({
          where: { id: legSess.userId },
        });

        if (!userExists) continue;

        const existingSession = await prisma.authSession.findUnique({
          where: { token: legSess.token },
        });

        if (!existingSession) {
          await prisma.authSession.create({
            data: {
              token: legSess.token,
              userId: legSess.userId,
              expiresAt: new Date(legSess.expiresAt),
              createdAt: legSess.createdAt ? new Date(legSess.createdAt) : new Date(),
            },
          });
          importedSessionsCount++;
        }
      }
    } catch (err) {
      console.error("Error reading or importing legacy auth store:", err);
    }
  }

  const totalUsersInDb = await prisma.user.count();
  const totalSessionsInDb = await prisma.authSession.count();

  console.log("=== Import & Seed Summary ===");
  console.log(`Newly imported users: ${importedUsersCount}`);
  console.log(`Pre-existing/skipped users: ${skippedUsersCount}`);
  console.log(`Active sessions imported: ${importedSessionsCount}`);
  console.log(`Credential conflicts: ${conflictsCount}`);
  console.log(`Total users in SQLite: ${totalUsersInDb}`);
  console.log(`Total active sessions in SQLite: ${totalSessionsInDb}`);

  return {
    importedUsersCount,
    skippedUsersCount,
    importedSessionsCount,
    conflictsCount,
    totalUsersInDb,
    totalSessionsInDb,
  };
}

// Execute if run directly
seedAndImport()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
