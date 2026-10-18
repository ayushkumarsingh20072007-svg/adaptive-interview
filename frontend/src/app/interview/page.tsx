import { redirect } from "next/navigation";

/**
 * Route fallback: Visiting /interview directly redirects to /dashboard,
 * where candidates can view their active sessions or initiate calibration setup.
 */
export default function InterviewIndexPage() {
  redirect("/dashboard");
}
