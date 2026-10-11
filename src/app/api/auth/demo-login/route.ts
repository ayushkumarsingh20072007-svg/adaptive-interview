import { NextResponse } from "next/server";
import { findUserByEmail, findUserById, createSession, DEMO_USERS, toSafeUser } from "@/lib/auth-service";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, demoId } = body || {};

    let user = null;
    if (demoId) {
      user = findUserById(demoId) || DEMO_USERS.find((u) => u.id === demoId);
    } else if (email) {
      user = findUserByEmail(email) || DEMO_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
    } else {
      // Default to recruiter for quick demo
      user = findUserById("usr_demo_recruiter") || DEMO_USERS[0];
    }

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
