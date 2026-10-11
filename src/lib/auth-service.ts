import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface StoredSession {
  token: string;
  userId: string;
  expiresAt: number; // timestamp in ms
  createdAt: string;
}

interface AuthDatabase {
  users: StoredUser[];
  sessions: StoredSession[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "auth-store.json");
const STORE_TMP = STORE_PATH + ".tmp";

// In-process write lock — prevents concurrent read-modify-write races within
// a single Node.js server process. This is sufficient for single-instance
// localhost use. For multi-instance deployments a proper database is required.
let _writeLocked = false;
const _writeQueue: Array<() => void> = [];

function acquireLock(): Promise<void> {
  return new Promise((resolve) => {
    if (!_writeLocked) {
      _writeLocked = true;
      resolve();
    } else {
      _writeQueue.push(resolve);
    }
  });
}

function releaseLock(): void {
  const next = _writeQueue.shift();
  if (next) {
    next();
  } else {
    _writeLocked = false;
  }
}

function readDatabase(): AuthDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_PATH)) {
      const initial: AuthDatabase = { users: [], sessions: [] };
      fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to read auth database:", err);
    return { users: [], sessions: [] };
  }
}

// Atomic write: write to .tmp then rename over the real file so a crash
// mid-write never leaves a truncated or partially-written store.
function writeDatabase(data: AuthDatabase): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const serialized = JSON.stringify(data, null, 2);
    fs.writeFileSync(STORE_TMP, serialized, "utf8");
    fs.renameSync(STORE_TMP, STORE_PATH);
  } catch (err) {
    console.error("Failed to write auth database:", err);
    // Clean up tmp file if it exists
    try { if (fs.existsSync(STORE_TMP)) fs.unlinkSync(STORE_TMP); } catch { /* ignore */ }
  }
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

export function toSafeUser(user: StoredUser): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

// User operations
export function findUserByEmail(email: string): StoredUser | null {
  const db = readDatabase();
  const normalized = email.trim().toLowerCase();
  return db.users.find((u) => u.email.toLowerCase() === normalized) || null;
}

export function findUserById(id: string): StoredUser | null {
  const db = readDatabase();
  return db.users.find((u) => u.id === id) || null;
}

export async function registerUser(name: string, email: string, password: string): Promise<{ user: SafeUser } | { error: string }> {
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

  // Acquire lock before the read-check-write sequence to prevent TOCTOU races
  await acquireLock();
  try {
    // Re-read inside the lock so a concurrent registration is visible
    const existing = findUserByEmail(cleanEmail);
    if (existing) {
      return { error: "An account with this email address already exists." };
    }

    const salt = generateSalt();
    const hash = hashPassword(password, salt);
    const now = new Date().toISOString();

    const newUser: StoredUser = {
      id: `usr_${crypto.randomUUID()}`,
      name: cleanName,
      email: cleanEmail,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: now,
    };

    const db = readDatabase();
    db.users.push(newUser);
    writeDatabase(db);

    return { user: toSafeUser(newUser) };
  } finally {
    releaseLock();
  }
}

export function verifyCredentials(email: string, password: string): { user: SafeUser } | { error: string } {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) {
    return { error: "Email and password are required." };
  }

  const user = findUserByEmail(cleanEmail);
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

// Session operations
export async function createSession(userId: string): Promise<StoredSession> {
  const token = generateToken();
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  const session: StoredSession = {
    token,
    userId,
    expiresAt: now + sevenDaysMs,
    createdAt: new Date().toISOString(),
  };

  await acquireLock();
  try {
    const db = readDatabase();
    // Filter out any expired sessions during creation
    db.sessions = db.sessions.filter((s) => s.expiresAt > now);
    db.sessions.push(session);
    writeDatabase(db);
  } finally {
    releaseLock();
  }

  return session;
}

export function getSession(token: string): (StoredSession & { user: SafeUser }) | null {
  if (!token) return null;
  const db = readDatabase();
  const now = Date.now();

  const session = db.sessions.find((s) => s.token === token && s.expiresAt > now);
  if (!session) return null;

  const user = db.users.find((u) => u.id === session.userId);
  if (!user) return null;

  return {
    ...session,
    user: toSafeUser(user),
  };
}

export async function deleteSession(token: string): Promise<void> {
  if (!token) return;
  await acquireLock();
  try {
    const db = readDatabase();
    db.sessions = db.sessions.filter((s) => s.token !== token);
    writeDatabase(db);
  } finally {
    releaseLock();
  }
}
