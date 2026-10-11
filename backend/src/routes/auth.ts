import { Router, Request, Response } from "express";
import {
  registerUser,
  verifyCredentials,
  createSession,
  getSession,
  deleteSession,
  DEMO_USERS,
  toSafeUser,
} from "../services/auth";

const router = Router();
const COOKIE_NAME = "interviewiq_session";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Register a new candidate or recruiter
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { name, email, password, role = "candidate", companyName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing required fields: name, email, or password." });
    }

    const result = await registerUser(
      name,
      email,
      password,
      role === "recruiter" ? "recruiter" : "candidate",
      companyName
    );

    if ("error" in result) {
      return res.status(400).json({ error: result.error });
    }

    const session = await createSession(result.user.id);

    res.cookie(COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_MS,
      path: "/",
    });

    return res.status(201).json({ user: result.user });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to register user";
    return res.status(500).json({ error: msg });
  }
});

// Sign In
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const result = verifyCredentials(email, password);
    if ("error" in result) {
      return res.status(401).json({ error: result.error });
    }

    const session = await createSession(result.user.id);

    res.cookie(COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_MS,
      path: "/",
    });

    return res.status(200).json({ user: result.user });
  } catch (err) {
    console.error("[auth] Login error:", err);
    return res.status(500).json({ error: "An unexpected error occurred during login." });
  }
});

// Demo Login
router.post("/demo-login", async (req: Request, res: Response) => {
  try {
    const { role } = req.body;
    let target = DEMO_USERS.find((u) => u.role === (role === "recruiter" ? "recruiter" : "candidate"));
    if (!target && DEMO_USERS.length > 0) target = DEMO_USERS[0];

    if (!target) {
      return res.status(404).json({ error: "No demo accounts found." });
    }

    const session = await createSession(target.id);

    res.cookie(COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_MS,
      path: "/",
    });

    return res.status(200).json({ user: toSafeUser(target) });
  } catch (err) {
    console.error("[auth] Demo login error:", err);
    return res.status(500).json({ error: "Failed to create demo session." });
  }
});

// Current User Profile
router.get("/me", (req: Request, res: Response) => {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) {
      return res.status(200).json({ user: null });
    }

    const session = getSession(token);
    return res.status(200).json({ user: session?.user || null });
  } catch (err) {
    console.error("[auth] /me error:", err);
    return res.status(500).json({ error: "Failed to retrieve session." });
  }
});

// Sign Out
router.post("/logout", async (req: Request, res: Response) => {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (token) {
      await deleteSession(token);
    }

    res.clearCookie(COOKIE_NAME, { path: "/" });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[auth] Logout error:", err);
    return res.status(500).json({ error: "Failed to log out." });
  }
});

export default router;
