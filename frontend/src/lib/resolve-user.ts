/**
 * Shared helper to extract and validate the current user session from a request.
 * Used by interview API routes to (optionally) identify the caller.
 */
import { getSession, type SafeUser } from "./auth-service";

export interface AuthResult {
  /** True if the request carries a valid, non-expired session cookie */
  authenticated: boolean;
  /** The safe user object if authenticated, null otherwise */
  user: SafeUser | null;
  /** The userId if authenticated, "guest" otherwise */
  userId: string;
}

/**
 * Parse the interviewiq_session cookie from a raw Request and resolve the user.
 * Never throws — returns { authenticated: false } on any failure.
 */
export function resolveRequestUser(request: Request): AuthResult {
  try {
    const cookieHeader = request.headers.get("cookie");
    if (!cookieHeader) return { authenticated: false, user: null, userId: "guest" };

    const match = cookieHeader.match(/interviewiq_session=([^;]+)/);
    const token = match ? decodeURIComponent(match[1]) : null;
    if (!token) return { authenticated: false, user: null, userId: "guest" };

    const session = getSession(token);
    if (!session) return { authenticated: false, user: null, userId: "guest" };

    return { authenticated: true, user: session.user, userId: session.user.id };
  } catch {
    return { authenticated: false, user: null, userId: "guest" };
  }
}
