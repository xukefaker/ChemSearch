"use client";

import { startTransition, useEffect, useMemo, useState } from "react";

import { ConversationThread } from "@/components/conversation-thread";
import { PaperDetailDrawer } from "@/components/paper-detail-drawer";
import { QueryComposer } from "@/components/query-composer";
import { SystemStatusSheet } from "@/components/system-status-sheet";
import { TraceSheet } from "@/components/trace-sheet";
import { DEFAULT_QUERY, type DemoQuery } from "@/lib/demo-queries";
import {
  buildPendingRun,
  defaultBucket,
  type ResultBucketKey,
  type SearchRun,
} from "@/lib/presentation";
import { createSearchJob, fetchSearchJob, fetchSearchJobResult, fetchTrace } from "@/lib/client-api";
import type { HealthSummary, PaperResult } from "@/lib/types";

type AppShellProps = {
  initialHealth: HealthSummary;
  demoQueries: DemoQuery[];
};

type SelectedPaperState = {
  runId: string;
  paper: PaperResult;
} | null;

export function AppShell({ initialHealth, demoQueries }: AppShellProps) {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [runs, setRuns] = useState<SearchRun[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<SelectedPaperState>(null);
  const [traceRunId, setTraceRunId] = useState<string | null>(null);
  const [systemOpen, setSystemOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeRun = useMemo(
    () =>
      [...runs]
        .reverse()
        .find(
          (run) =>
            run.status !== null &&
            (run.status.status === "queued" || run.status.status === "running") &&
            run.status.stage !== "starting" &&
            run.status.stage !== "completed",
        ) ?? null,
    [runs],
  );

  const traceRun = useMemo(
    () => (traceRunId ? runs.find((run) => run.id === traceRunId) ?? null : null),
    [runs, traceRunId],
  );

  function updateRun(runId: string, updater: (run: SearchRun) => SearchRun) {
    startTransition(() => {
      setRuns((currentRuns) => currentRuns.map((run) => (run.id === runId ? updater(run) : run)));
    });
  }

  useEffect(() => {
    if (!activeRun?.status) {
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const nextStatus = await fetchSearchJob(activeRun.status!.job_id);

        updateRun(activeRun.id, (currentRun) => ({
          ...currentRun,
          status: nextStatus,
          error: null,
        }));

        if (nextStatus.status === "completed") {
          const nextResult = await fetchSearchJobResult(nextStatus.job_id);
          updateRun(activeRun.id, (currentRun) => ({
            ...currentRun,
            status: nextStatus,
            result: nextResult,
            activeBucket: defaultBucket(nextResult),
            error: null,
          }));
          startTransition(() => {
            setIsSubmitting(false);
          });
          return;
        }

        if (nextStatus.status === "failed") {
          updateRun(activeRun.id, (currentRun) => ({
            ...currentRun,
            status: nextStatus,
            error: nextStatus.error ?? nextStatus.message,
          }));
          startTransition(() => {
            setIsSubmitting(false);
          });
          return;
        }
      } catch (error) {
        updateRun(activeRun.id, (currentRun) => ({
          ...currentRun,
          error: error instanceof Error ? error.message : "Failed to poll the search job.",
        }));
        startTransition(() => {
          setIsSubmitting(false);
        });
        return;
      }

      if (!active) {
        return;
      }

      timer = setTimeout(tick, activeRun.status?.status === "queued" ? 700 : 1400);
    };

    timer = setTimeout(tick, activeRun.status.status === "queued" ? 500 : 1200);

    return () => {
      active = false;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [activeRun]);

  async function handleSubmit() {
    const normalizedQuery = query.trim();
    if (!normalizedQuery || isSubmitting || activeRun) {
      return;
    }

    const runId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const topK = 10;
    const pendingRun = buildPendingRun(runId, normalizedQuery, topK);

    startTransition(() => {
      setRuns((currentRuns) => [...currentRuns, pendingRun]);
      setIsSubmitting(true);
      setSelectedPaper(null);
      setTraceRunId(null);
    });

    try {
      const created = await createSearchJob({
        query: normalizedQuery,
        top_k: topK,
      });

      if (created.status === "completed") {
        const nextResult = await fetchSearchJobResult(created.job_id);
        updateRun(runId, (currentRun) => ({
          ...currentRun,
          status: created,
          result: nextResult,
          activeBucket: defaultBucket(nextResult),
          error: null,
        }));
        startTransition(() => {
          setIsSubmitting(false);
        });
        return;
      }

      if (created.status === "failed") {
        updateRun(runId, (currentRun) => ({
          ...currentRun,
          status: created,
          error: created.error ?? created.message,
        }));
        startTransition(() => {
          setIsSubmitting(false);
        });
        return;
      }

      updateRun(runId, (currentRun) => ({
        ...currentRun,
        status: created,
      }));
    } catch (error) {
      updateRun(runId, (currentRun) => ({
        ...currentRun,
        error: error instanceof Error ? error.message : "Failed to submit the search job.",
      }));
      startTransition(() => {
        setIsSubmitting(false);
      });
    }
  }

  function handleBucketChange(runId: string, bucket: ResultBucketKey) {
    updateRun(runId, (run) => ({
      ...run,
      activeBucket: bucket,
    }));
  }

  function handleSelectPreset(nextQuery: string) {
    startTransition(() => {
      setQuery(nextQuery);
    });
  }

  async function handleOpenTrace(runId: string) {
    const run = runs.find((item) => item.id === runId);
    if (!run?.result?.trace_id) {
      return;
    }

    if (run.traceState === "loaded" || run.traceState === "loading") {
      startTransition(() => {
        setTraceRunId(runId);
      });
      return;
    }

    updateRun(runId, (currentRun) => ({
      ...currentRun,
      traceState: "loading",
      traceError: null,
    }));
    startTransition(() => {
      setTraceRunId(runId);
    });

    try {
      const trace = await fetchTrace(run.result.trace_id);
      updateRun(runId, (currentRun) => ({
        ...currentRun,
        trace,
        traceState: "loaded",
        traceError: null,
      }));
    } catch (error) {
      updateRun(runId, (currentRun) => ({
        ...currentRun,
        traceState: "error",
        traceError: error instanceof Error ? error.message : "Failed to load the trace.",
      }));
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,rgba(15,118,110,0.08),transparent_20%),linear-gradient(180deg,#f7f8fb_0%,#f3f5f7_100%)] text-slate-950">
      <button
        type="button"
        onClick={() => setSystemOpen(true)}
        aria-label="Open details"
        className="fixed right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-black/8 bg-white/88 text-sm font-medium text-slate-500 shadow-[0_10px_24px_rgba(15,23,42,0.06)] backdrop-blur sm:right-6 sm:top-6"
      >
        i
      </button>

      {runs.length === 0 ? (
        <div className="flex min-h-screen flex-1 items-center justify-center px-4 py-10 sm:px-6">
          <section className="w-full max-w-[56rem] text-center">
            <h1 className="text-balance text-[clamp(2.4rem,1.8rem+1.8vw,4.1rem)] font-semibold leading-[1.02] tracking-[-0.05em] text-slate-950">
              Find the right papers.
            </h1>
            <p className="mx-auto mt-4 max-w-[30rem] text-[1rem] leading-7 text-slate-500 sm:text-[1.05rem]">
              Query the paper corpus in natural language.
            </p>

            <div className="mt-8">
              <QueryComposer
                value={query}
                isSubmitting={isSubmitting || activeRun !== null}
                presets={demoQueries}
                variant="centered"
                showPresets
                onChange={setQuery}
                onSelectPreset={handleSelectPreset}
                onSubmit={handleSubmit}
              />
            </div>
          </section>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ConversationThread
              runs={runs}
              onBucketChange={handleBucketChange}
              onOpenPaper={(runId, paper) => setSelectedPaper({ runId, paper })}
              onOpenTrace={handleOpenTrace}
            />
          </div>

          <QueryComposer
            value={query}
            isSubmitting={isSubmitting || activeRun !== null}
            presets={demoQueries}
            showPresets={false}
            onChange={setQuery}
            onSelectPreset={handleSelectPreset}
            onSubmit={handleSubmit}
          />
        </>
      )}

      <PaperDetailDrawer
        paper={selectedPaper?.paper ?? null}
        open={selectedPaper !== null}
        onClose={() => setSelectedPaper(null)}
        onOpenTrace={() => {
          if (!selectedPaper) {
            return;
          }
          void handleOpenTrace(selectedPaper.runId);
        }}
      />

      <TraceSheet run={traceRun} open={traceRun !== null} onClose={() => setTraceRunId(null)} />
      <SystemStatusSheet health={initialHealth} open={systemOpen} onClose={() => setSystemOpen(false)} />
    </main>
  );
}
