import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
  "Surrogate-Control": "no-store",
  "Vary": "Cookie",
};

export async function GET(request: Request) {
  try {
    let token: string | null = null;

    // 1. Next.js official cookies() lookup (forces dynamic request context)
    try {
      const cookieStore = await cookies();
      token = cookieStore.get("interviewiq_session")?.value || null;
    } catch {
      // Fallback if cookies() throws in static evaluation
    }

    // 2. Direct Cookie header fallback
    if (!token) {
      const cookieHeader = request.headers.get("cookie");
      if (cookieHeader) {
        const match = cookieHeader.match(/interviewiq_session=([^;]+)/);
        if (match) {
          token = decodeURIComponent(match[1]);
        }
      }
    }

    if (!token) {
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: 200, headers: NO_CACHE_HEADERS }
      );
    }

    const session = await getSession(token);
    if (!session) {
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: 200, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        authenticated: true,
        user: session.user,
      },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    if ((err as { digest?: string })?.digest?.startsWith("NEXT_")) {
      throw err;
    }
    console.error("Auth me check error:", err);
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  }
}
