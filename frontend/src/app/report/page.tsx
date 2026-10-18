import { redirect } from "next/navigation";

/**
 * Route fallback: Visiting /report directly redirects to /dashboard,
 * where candidates and recruiters can browse all historical evaluation reports.
 */
export default function ReportIndexPage() {
  redirect("/dashboard");
}
