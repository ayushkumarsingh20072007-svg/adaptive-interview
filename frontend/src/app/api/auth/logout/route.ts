import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth-service";

function getSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/interviewiq_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function POST(request: Request) {
  try {
    const token = getSessionToken(request);

    if (token) {
      await deleteSession(token);
    }

    const response = NextResponse.json({ success: true }, { status: 200 });

    response.cookies.set({
      name: "interviewiq_session",
      value: "",
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (err: unknown) {
    if ((err as { digest?: string })?.digest?.startsWith("NEXT_")) {
      throw err;
    }
    console.error("Auth logout error:", err);
    return NextResponse.json({ error: "Failed to logout." }, { status: 500 });
  }
}
