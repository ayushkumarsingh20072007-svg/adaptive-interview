import { NextResponse } from "next/server";
import { verifyCredentials, createSession } from "@/lib/auth-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body || {};

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const result = await verifyCredentials(email, password);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const session = await createSession(result.user.id);

    const response = NextResponse.json(
      { success: true, user: result.user },
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
    console.error("Auth login error:", err);
    return NextResponse.json(
      { error: "An unexpected server error occurred during login." },
      { status: 500 }
    );
  }
}
