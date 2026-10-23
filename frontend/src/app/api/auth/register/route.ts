import { NextResponse } from "next/server";
import { registerUser, createSession } from "@/lib/auth-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = body || {};

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Please provide a valid name." }, { status: 400 });
    }

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Please provide a password." }, { status: 400 });
    }

    const result = await registerUser(name, email, password);
    if ("error" in result) {
      const status = result.error.includes("already exists") ? 409 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    const session = await createSession(result.user.id);

    const response = NextResponse.json(
      { success: true, user: result.user },
      { status: 201 }
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
    console.error("Auth register error:", err);
    return NextResponse.json(
      { error: "An unexpected server error occurred during registration." },
      { status: 500 }
    );
  }
}
