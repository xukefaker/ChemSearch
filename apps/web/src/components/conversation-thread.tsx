"use client";

import { useEffect, useRef } from "react";

import type { SearchRun } from "@/lib/presentation";
import type { PaperResult } from "@/lib/types";
import { AssistantResponse } from "@/components/assistant-response";

type ConversationThreadProps = {
  runs: SearchRun[];
  onBucketChange: (runId: string, bucket: "satisfied" | "partial" | "rejected") => void;
  onOpenPaper: (runId: string, paper: PaperResult) => void;
  onOpenTrace: (runId: string) => void;
};

export function ConversationThread({
  runs,
  onBucketChange,
  onOpenPaper,
  onOpenTrace,
}: ConversationThreadProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [runs.length]);

  return (
    <div className="mx-auto flex w-full max-w-[min(100%,80rem)] flex-col gap-8 px-4 py-8 sm:px-6">
      {runs.map((run) => (
        <div key={run.id} className="space-y-4">
          <div className="flex justify-end">
            <div className="max-w-[46rem] rounded-[1.5rem] bg-slate-950 px-5 py-4 text-left text-[1rem] leading-7 text-white shadow-[0_16px_36px_rgba(15,23,42,0.12)]">
              {run.query}
            </div>
          </div>

          <div className="flex justify-start">
            <AssistantResponse
              run={run}
              onBucketChange={(bucket) => onBucketChange(run.id, bucket)}
              onOpenPaper={(paper) => onOpenPaper(run.id, paper)}
              onOpenTrace={() => onOpenTrace(run.id)}
            />
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
