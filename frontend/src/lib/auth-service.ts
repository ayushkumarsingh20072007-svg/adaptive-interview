import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: "candidate" | "recruiter";
  companyName?: string;
  title?: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: "candidate" | "recruiter";
  companyName?: string;
  title?: string;
  createdAt: string;
}

export interface StoredSession {
  token: string;
  userId: string;
  expiresAt: number; // timestamp in ms
  createdAt: string;
}

// Cryptographic helpers
export function hashPassword(password: string, salt: string): string {
  return crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

const DEMO_SALT = "demo_salt_interviewiq_2026";

export const DEMO_USERS: StoredUser[] = [
  {
    id: "usr_demo_recruiter",
    name: "Sarah Jenkins",
    email: "recruiter@interviewiq.ai",
    role: "recruiter",
    companyName: "TechCorp Global",
    title: "Head of Technical Talent",
    passwordSalt: DEMO_SALT,
    passwordHash: hashPassword("Password123", DEMO_SALT),
    createdAt: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "usr_demo_alex",
    name: "Alex Rivera",
    email: "alex.rivera@example.com",
    role: "candidate",
    title: "Full Stack Developer",
    passwordSalt: DEMO_SALT,
    passwordHash: hashPassword("Password123", DEMO_SALT),
    createdAt: "2026-10-02T00:00:00.000Z",
  },
  {
    id: "usr_demo_maya",
    name: "Maya Patel",
    email: "maya.patel@example.com",
    role: "candidate",
    title: "Frontend Developer",
    passwordSalt: DEMO_SALT,
    passwordHash: hashPassword("Password123", DEMO_SALT),
    createdAt: "2026-10-03T00:00:00.000Z",
  },
  {
    id: "usr_demo_liam",
    name: "Liam Chen",
    email: "liam.chen@example.com",
    role: "candidate",
    title: "Backend Developer",
    passwordSalt: DEMO_SALT,
    passwordHash: hashPassword("Password123", DEMO_SALT),
    createdAt: "2026-10-04T00:00:00.000Z",
  },
  {
    id: "usr_demo_priya",
    name: "Priya Sharma",
    email: "priya.sharma@example.com",
    role: "candidate",
    title: "Frontend Engineer",
    passwordSalt: DEMO_SALT,
    passwordHash: hashPassword("Password123", DEMO_SALT),
    createdAt: "2026-10-03T00:00:00.000Z",
  },
  {
    id: "usr_demo_marcus",
    name: "Marcus Chen",
    email: "marcus.chen@example.com",
    role: "candidate",
    title: "Backend Engineer",
    passwordSalt: DEMO_SALT,
    passwordHash: hashPassword("Password123", DEMO_SALT),
    createdAt: "2026-10-04T00:00:00.000Z",
  },
  {
    id: "usr_demo_rohan",
    name: "Rohan Gupta",
    email: "rohan.gupta@example.com",
    role: "candidate",
    title: "Python Developer",
    passwordSalt: DEMO_SALT,
    passwordHash: hashPassword("Password123", DEMO_SALT),
    createdAt: "2026-10-05T00:00:00.000Z",
  },
];

export function toSafeUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  companyName?: string | null;
  title?: string | null;
  createdAt: Date | string;
}): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: (user.role as "candidate" | "recruiter") || "candidate",
    companyName: user.companyName ?? undefined,
    title: user.title ?? undefined,
    createdAt: typeof user.createdAt === "string" ? user.createdAt : user.createdAt.toISOString(),
  };
}

// User operations backed by Prisma SQLite
export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  try {
    const normalized = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalized },
    });
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: (user.role as "candidate" | "recruiter") || "candidate",
      companyName: user.companyName ?? undefined,
      title: user.title ?? undefined,
      passwordHash: user.passwordHash,
      passwordSalt: user.passwordSalt,
      createdAt: user.createdAt.toISOString(),
    };
  } catch (err) {
    console.error("Database findUserByEmail error:", err);
    return null;
  }
}

export async function findUserById(id: string): Promise<StoredUser | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: (user.role as "candidate" | "recruiter") || "candidate",
      companyName: user.companyName ?? undefined,
      title: user.title ?? undefined,
      passwordHash: user.passwordHash,
      passwordSalt: user.passwordSalt,
      createdAt: user.createdAt.toISOString(),
    };
  } catch (err) {
    console.error("Database findUserById error:", err);
    return null;
  }
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
  role: "candidate" | "recruiter" = "candidate",
  companyName?: string
): Promise<{ user: SafeUser } | { error: string }> {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanName || cleanName.length < 2) {
    return { error: "Name must be at least 2 characters long." };
  }

  // RFC-compliant email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return { error: "Please provide a valid email address." };
  }

  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters long." };
  }

  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { error: "Password must include at least one letter and one number." };
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });
    if (existing) {
      return { error: "An account with this email address already exists." };
    }

    const salt = generateSalt();
    const hash = hashPassword(password, salt);

    const newUser = await prisma.user.create({
      data: {
        id: `usr_${crypto.randomUUID()}`,
        name: cleanName,
        email: cleanEmail,
        role,
        companyName: role === "recruiter" ? (companyName?.trim() || "TechCorp Global") : null,
        passwordHash: hash,
        passwordSalt: salt,
      },
    });

    return { user: toSafeUser(newUser) };
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      return { error: "An account with this email address already exists." };
    }
    console.error("Database registration error:", err);
    return { error: "A database error occurred during registration." };
  }
}

export async function verifyCredentials(
  email: string,
  password: string
): Promise<{ user: SafeUser } | { error: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) {
    return { error: "Email and password are required." };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });
    if (!user) {
      return { error: "Invalid email or password." };
    }

    const computedHash = hashPassword(password, user.passwordSalt);

    // Timing safe buffer comparison to prevent timing attacks
    const bufA = Buffer.from(computedHash, "hex");
    const bufB = Buffer.from(user.passwordHash, "hex");

    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
      return { error: "Invalid email or password." };
    }

    return { user: toSafeUser(user) };
  } catch (err) {
    console.error("Database verifyCredentials error:", err);
    return { error: "A database error occurred during authentication." };
  }
}

// Session operations backed by Prisma SQLite
export async function createSession(userId: string): Promise<StoredSession> {
  const token = generateToken();
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(now + sevenDaysMs);

  const session = await prisma.authSession.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return {
    token: session.token,
    userId: session.userId,
    expiresAt: session.expiresAt.getTime(),
    createdAt: session.createdAt.toISOString(),
  };
}

export async function getSession(
  token: string
): Promise<(StoredSession & { user: SafeUser }) | null> {
  if (!token) return null;

  try {
    const session = await prisma.authSession.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) return null;

    // Check expiration
    if (session.expiresAt.getTime() <= Date.now()) {
      try {
        await prisma.authSession.delete({ where: { token } });
      } catch {
        // ignore deletion error on expired token
      }
      return null;
    }

    if (!session.user) return null;

    return {
      token: session.token,
      userId: session.userId,
      expiresAt: session.expiresAt.getTime(),
      createdAt: session.createdAt.toISOString(),
      user: toSafeUser(session.user),
    };
  } catch (err) {
    console.error("Database getSession error:", err);
    return null;
  }
}

export async function deleteSession(token: string): Promise<void> {
  if (!token) return;
  try {
    await prisma.authSession.deleteMany({
      where: { token },
    });
  } catch (err) {
    console.error("Database deleteSession error:", err);
  }
}
