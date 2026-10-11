import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-service";

function getSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/interviewiq_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function GET(request: Request) {
  try {
    const token = getSessionToken(request);

    if (!token) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
    }

    const session = await getSession(token);
    if (!session) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
    }

    return NextResponse.json({
      authenticated: true,
      user: session.user,
    });
  } catch (err: unknown) {
    if ((err as { digest?: string })?.digest?.startsWith("NEXT_")) {
      throw err;
    }
    console.error("Auth me check error:", err);
    return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
  }
}
