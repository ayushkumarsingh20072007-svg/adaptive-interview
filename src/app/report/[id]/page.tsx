import { Suspense } from "react";
import { ReportView } from "@/components/report/report-view";
import { Loader2 } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export const instant = false;

export function generateStaticParams() {
  return [{ id: "demo-session" }];
}

export default async function CandidateReportPage({ params }: Props) {
  const { id } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400 mb-3" />
          <p className="text-sm">Synthesizing candidate report...</p>
        </div>
      }
    >
      <ReportView sessionId={id} />
    </Suspense>
  );
}
