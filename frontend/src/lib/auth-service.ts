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

// Memory store for non-persisted / serverless registered users
const IN_MEMORY_USERS = new Map<string, StoredUser>();

// Secret key for HMAC token signing (falls back to a default consistent key for stateless verification)
const SESSION_SIGNING_SECRET =
  process.env.SESSION_SECRET ||
  process.env.GEMINI_API_KEY ||
  "interviewiq_serverless_jwt_auth_secret_2026_key";

interface SessionPayload {
  userId: string;
  name: string;
  email: string;
  role: "candidate" | "recruiter";
  companyName?: string;
  title?: string;
  createdAt: string;
  expiresAt: number;
}

function signSessionToken(payload: SessionPayload): string {
  const json = JSON.stringify(payload);
  const encodedPayload = Buffer.from(json, "utf8").toString("base64url");
  const signature = crypto
    .createHmac("sha256", SESSION_SIGNING_SECRET)
    .update(encodedPayload)
    .digest("base64url");
  return `iq_${encodedPayload}.${signature}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  if (!token || !token.startsWith("iq_")) return null;
  const raw = token.slice(3);
  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;

  try {
    const expectedSig = crypto
      .createHmac("sha256", SESSION_SIGNING_SECRET)
      .update(encodedPayload)
      .digest("base64url");

    const bufA = Buffer.from(signature);
    const bufB = Buffer.from(expectedSig);
    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as SessionPayload;

    if (payload.expiresAt <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// User operations backed by Prisma SQLite with demo and in-memory fallbacks
export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const normalized = email.trim().toLowerCase();

  // 1. Check demo users first
  const demo = DEMO_USERS.find((u) => u.email.toLowerCase() === normalized);
  if (demo) return demo;

  // 2. Check in-memory registered users
  for (const user of IN_MEMORY_USERS.values()) {
    if (user.email.toLowerCase() === normalized) return user;
  }

  // 3. Check Prisma database if available
  try {
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
    console.warn("Database findUserByEmail error (using fallback):", err);
    return null;
  }
}

export async function findUserById(id: string): Promise<StoredUser | null> {
  // 1. Check demo users first
  const demo = DEMO_USERS.find((u) => u.id === id);
  if (demo) return demo;

  // 2. Check in-memory registered users
  const inMemory = IN_MEMORY_USERS.get(id);
  if (inMemory) return inMemory;

  // 3. Check Prisma database if available
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
    console.warn("Database findUserById error (using fallback):", err);
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

  // Check demo or memory user duplicates
  const existing = await findUserByEmail(cleanEmail);
  if (existing) {
    return { error: "An account with this email address already exists." };
  }

  const salt = generateSalt();
  const hash = hashPassword(password, salt);
  const userId = `usr_${crypto.randomUUID()}`;
  const now = new Date();

  const newStoredUser: StoredUser = {
    id: userId,
    name: cleanName,
    email: cleanEmail,
    role,
    companyName: role === "recruiter" ? (companyName?.trim() || "TechCorp Global") : undefined,
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: now.toISOString(),
  };

  // Always register in memory for serverless resilience
  IN_MEMORY_USERS.set(userId, newStoredUser);

  try {
    const newUser = await prisma.user.create({
      data: {
        id: userId,
        name: cleanName,
        email: cleanEmail,
        role,
        companyName: newStoredUser.companyName || null,
        passwordHash: hash,
        passwordSalt: salt,
      },
    });

    return { user: toSafeUser(newUser) };
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
      return { error: "An account with this email address already exists." };
    }
    console.warn("Database registration fallback to in-memory:", err);
    return { user: toSafeUser(newStoredUser) };
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

  const user = await findUserByEmail(cleanEmail);
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
}

// Session operations backed by Signed Stateless Tokens + Prisma SQLite
export async function createSession(userId: string): Promise<StoredSession> {
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const expiresAt = now + sevenDaysMs;

  // Resolve user info for self-contained stateless session
  const user = (await findUserById(userId)) || DEMO_USERS.find((u) => u.id === userId);

  const payload: SessionPayload = {
    userId,
    name: user?.name || "Demo User",
    email: user?.email || "demo@interviewiq.ai",
    role: user?.role || "candidate",
    companyName: user?.companyName,
    title: user?.title,
    createdAt: user?.createdAt || new Date(now).toISOString(),
    expiresAt,
  };

  const token = signSessionToken(payload);

  // Optionally persist session in Prisma SQLite if database is reachable
  try {
    if (user) {
      await prisma.user
        .upsert({
          where: { id: user.id },
          update: {},
          create: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            companyName: user.companyName ?? null,
            title: user.title ?? null,
            passwordHash: user.passwordHash || "demo",
            passwordSalt: user.passwordSalt || "demo",
          },
        })
        .catch(() => null);
    }

    await prisma.authSession
      .create({
        data: {
          token,
          userId,
          expiresAt: new Date(expiresAt),
        },
      })
      .catch(() => null);
  } catch (err) {
    console.warn("Prisma session persistence skipped (using signed token):", err);
  }

  return {
    token,
    userId,
    expiresAt,
    createdAt: new Date(now).toISOString(),
  };
}

export async function getSession(
  token: string
): Promise<(StoredSession & { user: SafeUser }) | null> {
  if (!token) return null;

  // 1. Verify signed stateless token (works without database on serverless/Vercel)
  const payload = verifySessionToken(token);
  if (payload) {
    const user = (await findUserById(payload.userId)) || {
      id: payload.userId,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      companyName: payload.companyName,
      title: payload.title,
      passwordHash: "",
      passwordSalt: "",
      createdAt: payload.createdAt,
    };

    return {
      token,
      userId: payload.userId,
      expiresAt: payload.expiresAt,
      createdAt: payload.createdAt,
      user: toSafeUser(user),
    };
  }

  // 2. Fallback to Prisma database lookup (for legacy sessions or non-signed tokens)
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
    console.warn("Database getSession error:", err);
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
    console.warn("Database deleteSession error:", err);
  }
}

