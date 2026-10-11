import { Suspense } from "react";
import { InterviewWorkspace } from "@/components/interview/interview-workspace";
import { Loader2 } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export const instant = false;

export function generateStaticParams() {
  return [{ id: "demo-session" }];
}

export default async function LiveInterviewPage({ params }: Props) {
  const { id } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400 mb-3" />
          <p className="text-sm">Preparing interview workspace...</p>
        </div>
      }
    >
      <InterviewWorkspace sessionId={id} />
    </Suspense>
  );
}
