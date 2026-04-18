import { PaperResultList } from "@/components/paper-result-list";
import { ResultGroupTabs } from "@/components/result-group-tabs";
import {
  assistantHeadline,
  assistantSubheadline,
  bucketCounts,
  papersForBucket,
  resultBucketMeta,
  runProgress,
  stageLabel,
  type SearchRun,
} from "@/lib/presentation";
import { formatDuration } from "@/lib/format";
import type { PaperResult } from "@/lib/types";

type AssistantResponseProps = {
  run: SearchRun;
  onBucketChange: (bucket: "satisfied" | "partial" | "rejected") => void;
  onOpenPaper: (paper: PaperResult) => void;
  onOpenTrace: () => void;
};

export function AssistantResponse({
  run,
  onBucketChange,
  onOpenPaper,
  onOpenTrace,
}: AssistantResponseProps) {
  const status = run.status;

  if (run.error) {
    return (
      <div className="max-w-[58rem] rounded-[1.5rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm leading-7 text-rose-700 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        {run.error}
      </div>
    );
  }

  if (!run.result) {
    return (
      <div className="max-w-[58rem] rounded-[1.5rem] border border-black/7 bg-white px-5 py-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="psa-overline">Search in progress</div>
            <h2 className="mt-1 text-[1rem] font-semibold tracking-[-0.02em] text-slate-950">
              {status ? stageLabel(status.stage) : "Submitting query"}
            </h2>
          </div>
          <div className="text-sm text-slate-500">
            {status ? formatDuration(status.elapsed_ms) : "0.0s"}
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#111827_0%,#0f766e_100%)] transition-[width] duration-500"
            style={{ width: `${runProgress(status)}%` }}
          />
        </div>

        <p className="mt-4 text-[0.98rem] leading-7 text-slate-600">
          {status?.message ?? "The backend is starting the search job."}
        </p>
      </div>
    );
  }

  const counts = bucketCounts(run.result);
  const selectedBucket = resultBucketMeta(run.activeBucket);
  const papers = papersForBucket(run.result, run.activeBucket);
  const emptyMessage =
    run.activeBucket === "satisfied"
      ? "No papers were verified as fully satisfying this query."
      : run.activeBucket === "partial"
        ? "No partial matches were returned for this run."
        : "No rejected candidates were retained for inspection.";

  return (
    <div className="max-w-[58rem] rounded-[1.5rem] border border-black/7 bg-white px-5 py-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="psa-overline">Answer</div>
          <h2 className="mt-1 text-[1.12rem] font-semibold leading-8 tracking-[-0.02em] text-slate-950">
            {assistantHeadline(run.result)}
          </h2>
          <p className="mt-2 text-sm text-slate-500">{assistantSubheadline(run.result)}</p>
        </div>
        <button
          type="button"
          onClick={onOpenTrace}
          className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Open trace
        </button>
      </div>

      <div className="mt-5">
        <ResultGroupTabs activeBucket={run.activeBucket} counts={counts} onChange={onBucketChange} />
      </div>

      <div className="mt-4 rounded-[1.1rem] bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-500">
        {selectedBucket.description}
      </div>

      <div className="mt-5">
        <PaperResultList
          papers={papers}
          emptyMessage={emptyMessage}
          onOpenPaper={onOpenPaper}
        />
      </div>
    </div>
  );
}
