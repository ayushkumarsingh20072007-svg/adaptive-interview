import { NextResponse } from "next/server";
import { findUserByEmail, findUserById, createSession, DEMO_USERS, toSafeUser } from "@/lib/auth-service";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, demoId, role } = body || {};

    const ALLOWED_DEMO_MAP: Record<string, string> = {
      recruiter: "usr_demo_recruiter",
      candidate: "usr_demo_alex",
      "usr_demo_recruiter": "usr_demo_recruiter",
      "usr_demo_alex": "usr_demo_alex",
      "recruiter@interviewiq.ai": "usr_demo_recruiter",
      "alex.rivera@example.com": "usr_demo_alex",
    };

    let targetId: string | undefined;

    if (role && (role === "recruiter" || role === "candidate")) {
      targetId = ALLOWED_DEMO_MAP[role];
    } else if (demoId && ALLOWED_DEMO_MAP[demoId]) {
      targetId = ALLOWED_DEMO_MAP[demoId];
    } else if (email && ALLOWED_DEMO_MAP[email.toLowerCase()]) {
      targetId = ALLOWED_DEMO_MAP[email.toLowerCase()];
    } else if (!role && !demoId && !email) {
      targetId = "usr_demo_recruiter";
    }

    if (!targetId) {
      return NextResponse.json(
        { error: "Unauthorized: only documented demo accounts are accessible via demo login." },
        { status: 403 }
      );
    }

    const user =
      (await findUserById(targetId)) ||
      DEMO_USERS.find((u) => u.id === targetId);

    if (!user) {
      return NextResponse.json(
        { error: "Requested demo user profile was not found." },
        { status: 404 }
      );
    }

    const session = await createSession(user.id);
    const safe = toSafeUser(user);

    const response = NextResponse.json(
      { success: true, user: safe },
      { status: 200 }
    );

    response.cookies.set({
      name: "interviewiq_session",
      value: session.token,
      httpOnly: true,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (err) {
    console.error("Demo login error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred during demo sign-in." },
      { status: 500 }
    );
  }
}
