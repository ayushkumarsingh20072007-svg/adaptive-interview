import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Protected routes that require the user to be logged in.
 * Uses Next.js 16 proxy (formerly middleware) for server-side auth guards.
 */

/** Auth routes — redirect already-logged-in users to dashboard */
const AUTH_ROUTES = ["/login", "/signup"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("interviewiq_session")?.value;

  // Protected paths that require authentication
  const isProtected =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/interview" ||
    pathname.startsWith("/interview/") ||
    pathname === "/setup" ||
    pathname.startsWith("/setup/") ||
    pathname === "/report" ||
    pathname.startsWith("/report/");

  // Redirect unauthenticated users to login
  if (isProtected && !sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect already-authenticated users away from auth pages
  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
  if (isAuthRoute && sessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/interview/:path*",
    "/setup/:path*",
    "/report/:path*",
    "/login",
    "/signup",
  ],
};
