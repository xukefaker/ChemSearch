"use client";

import Link from "next/link";

import { OverlayPanel } from "@/components/overlay-panel";
import { compactInteger, titleCaseToken } from "@/lib/presentation";
import { formatDuration } from "@/lib/format";
import type { SearchRun } from "@/lib/presentation";

type TraceSheetProps = {
  run: SearchRun | null;
  open: boolean;
  onClose: () => void;
};

export function TraceSheet({ run, open, onClose }: TraceSheetProps) {
  return (
    <OverlayPanel
      open={open}
      side="center"
      widthClassName="w-full max-w-[min(94vw,70rem)]"
      title="Search trace"
      description={run ? "How the system parsed the query, built candidates, and verified results." : undefined}
      onClose={onClose}
    >
      {!run ? null : run.traceState === "loading" ? (
        <div className="rounded-[1.2rem] border border-black/7 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          Loading trace details...
        </div>
      ) : run.traceState === "error" ? (
        <div className="rounded-[1.2rem] border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">
          {run.traceError ?? "The trace could not be loaded."}
        </div>
      ) : !run.trace ? (
        <div className="rounded-[1.2rem] border border-dashed border-black/10 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          No trace is available for this run yet.
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-[1.2rem] border border-black/7 bg-slate-50 px-4 py-4">
            <div className="psa-overline">Query</div>
            <h3 className="mt-2 text-[1.02rem] font-semibold leading-7 text-slate-950">{run.trace.user_query}</h3>
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
              <span className="rounded-full border border-black/8 bg-white px-3 py-1.5">{run.trace.mode}</span>
              <span className="rounded-full border border-black/8 bg-white px-3 py-1.5">{run.trace.trace_id}</span>
              <span className="rounded-full border border-black/8 bg-white px-3 py-1.5">
                {compactInteger(run.trace.paper_recall.length)} recall items
              </span>
              <span className="rounded-full border border-black/8 bg-white px-3 py-1.5">
                total {formatDuration(run.trace.timings_ms.total ?? 0)}
              </span>
            </div>
            <div className="mt-4">
              <Link
                href={`/traces/${run.trace.trace_id}`}
                className="inline-flex rounded-full border border-black/8 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Open full trace page
              </Link>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(18rem,0.92fr)]">
            <div className="rounded-[1.2rem] border border-black/7 bg-white px-4 py-4">
              <div className="psa-overline">Query parser</div>
              <div className="mt-3 rounded-[1rem] border border-black/6 bg-slate-50 px-4 py-3">
                <div className="text-sm font-medium text-slate-900">Global query</div>
                <p className="mt-2 text-sm leading-7 text-slate-600">{run.trace.query_plan.global_query}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {run.trace.query_plan.scope_constraints.venues.map((venue) => (
                  <span key={`venue-${venue}`} className="rounded-full border border-black/8 bg-slate-50 px-3 py-1.5 text-sm text-slate-600">
                    venue: {venue}
                  </span>
                ))}
                {run.trace.query_plan.scope_constraints.years.map((year) => (
                  <span key={`year-${year}`} className="rounded-full border border-black/8 bg-slate-50 px-3 py-1.5 text-sm text-slate-600">
                    year: {year}
                  </span>
                ))}
                {run.trace.query_plan.entity_terms.map((term) => (
                  <span key={`entity-${term}`} className="rounded-full border border-black/8 bg-slate-50 px-3 py-1.5 text-sm text-slate-600">
                    {term}
                  </span>
                ))}
              </div>

              <div className="mt-4 grid gap-3">
                {run.trace.query_plan.aspect_queries.map((aspect) => (
                  <div key={aspect.aspect_id} className="rounded-[1rem] border border-black/6 bg-slate-50 px-4 py-3">
                    <div className="text-sm font-medium text-slate-900">
                      {aspect.aspect_id} · weight {aspect.weight.toFixed(2)}
                    </div>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{aspect.query}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.2rem] border border-black/7 bg-white px-4 py-4">
              <div className="psa-overline">Runtime</div>
              <div className="mt-4 space-y-3">
                {Object.entries(run.trace.timings_ms).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-3 rounded-[1rem] border border-black/6 bg-slate-50 px-4 py-3">
                    <span className="text-sm font-medium text-slate-700">{titleCaseToken(key)}</span>
                    <span className="text-sm text-slate-500">{formatDuration(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[1.2rem] border border-black/7 bg-white px-4 py-4">
              <div className="psa-overline">Candidate generation</div>
              <div className="mt-4 space-y-3">
                {Object.entries((run.trace.filter_summary as { source_sizes?: Record<string, number> }).source_sizes ?? {}).map(
                  ([source, size]) => (
                    <div key={source} className="flex items-center justify-between gap-3 rounded-[1rem] border border-black/6 bg-slate-50 px-4 py-3">
                      <span className="text-sm font-medium text-slate-700">{titleCaseToken(source)}</span>
                      <span className="text-sm text-slate-500">{compactInteger(size)}</span>
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="rounded-[1.2rem] border border-black/7 bg-white px-4 py-4">
              <div className="psa-overline">Verifier summary</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {Object.entries(run.trace.verifier_summary as Record<string, unknown>).map(([key, value]) => (
                  <div key={key} className="rounded-[1rem] border border-black/6 bg-slate-50 px-4 py-3">
                    <div className="text-sm font-medium text-slate-700">{titleCaseToken(key)}</div>
                    <div className="mt-1 text-sm text-slate-500">{String(value)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[1.2rem] border border-black/7 bg-white px-4 py-4">
            <div className="psa-overline">Recall preview</div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-sm text-slate-500">
                    <th className="pr-4">Rank</th>
                    <th className="pr-4">Source</th>
                    <th className="pr-4">Item</th>
                    <th className="pr-4">Score</th>
                    <th>Aspect</th>
                  </tr>
                </thead>
                <tbody>
                  {run.trace.paper_recall.slice(0, 20).map((item) => (
                    <tr key={`${item.source}-${item.item_id}-${item.rank}`} className="rounded-[1rem] bg-slate-50 text-sm text-slate-600">
                      <td className="rounded-l-[0.9rem] px-3 py-2">{item.rank}</td>
                      <td className="px-3 py-2">{titleCaseToken(item.source)}</td>
                      <td className="px-3 py-2 font-medium text-slate-700">{item.item_id}</td>
                      <td className="px-3 py-2">{item.score.toFixed(3)}</td>
                      <td className="rounded-r-[0.9rem] px-3 py-2">{item.aspect_id ?? "global"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </OverlayPanel>
  );
}
