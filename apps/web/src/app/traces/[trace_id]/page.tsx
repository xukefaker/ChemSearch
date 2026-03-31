import Link from "next/link";

import { compactInteger, titleCaseToken } from "@/lib/presentation";
import { fetchTrace, ServerRequestError } from "@/lib/server-api";
import { formatDuration } from "@/lib/format";
import type { SearchTrace } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TracePage({
  params,
}: {
  params: Promise<{ trace_id: string }>;
}) {
  const { trace_id } = await params;
  let trace: SearchTrace | null = null;
  let traceError: { title: string; message: string } | null = null;

  try {
    trace = await fetchTrace(trace_id);
  } catch (error) {
    if (error instanceof ServerRequestError && error.status === 404) {
      traceError = {
        title: "Trace not found",
        message: "The requested trace ID does not exist in the current backend.",
      };
    } else {
      traceError = {
        title: "Trace unavailable",
        message: error instanceof Error ? error.message : "The trace could not be loaded from the backend.",
      };
    }
  }

  if (!trace || traceError) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(15,118,110,0.08),transparent_20%),linear-gradient(180deg,#f7f8fb_0%,#f3f5f7_100%)] px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-[70rem]">
          <Link
            href="/"
            className="inline-flex rounded-full border border-black/8 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Back to search
          </Link>
          <section className="mt-6 rounded-[1.6rem] border border-black/7 bg-white px-6 py-6 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <div className="psa-overline">Trace</div>
            <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-slate-950">
              {traceError?.title ?? "Trace unavailable"}
            </h1>
            <p className="mt-4 max-w-[42rem] text-[1rem] leading-8 text-slate-500">
              {traceError?.message ?? "The requested trace could not be loaded through the Next.js proxy."}
            </p>
          </section>
        </div>
      </main>
    );
  }

  const filterSummary = trace.filter_summary;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(15,118,110,0.08),transparent_20%),linear-gradient(180deg,#f7f8fb_0%,#f3f5f7_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-[70rem]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex rounded-full border border-black/8 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Back to search
          </Link>
          <div className="flex flex-wrap gap-2 text-sm text-slate-600">
            <span className="rounded-full border border-black/8 bg-white px-3 py-1.5">{trace.mode}</span>
            <span className="rounded-full border border-black/8 bg-white px-3 py-1.5">{trace.trace_id}</span>
          </div>
        </div>

        <section className="mt-6 rounded-[1.6rem] border border-black/7 bg-white px-6 py-6 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
          <div className="psa-overline">Trace</div>
          <h1 className="mt-2 text-balance text-[clamp(2rem,1.5rem+1vw,3rem)] font-semibold leading-[1.06] tracking-[-0.04em] text-slate-950">
            How the system answered this query
          </h1>
          <p className="mt-5 max-w-[52rem] text-[1rem] leading-8 text-slate-600">{trace.user_query}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.1rem] border border-black/7 bg-slate-50 px-4 py-4">
              <div className="psa-overline">Allowed papers</div>
              <div className="mt-2 text-base font-semibold text-slate-950">
                {compactInteger(filterSummary.allowed_paper_ids ?? 0)}
              </div>
            </div>
            <div className="rounded-[1.1rem] border border-black/7 bg-slate-50 px-4 py-4">
              <div className="psa-overline">Candidate pool</div>
              <div className="mt-2 text-base font-semibold text-slate-950">
                {compactInteger(filterSummary.candidate_pool_count ?? 0)}
              </div>
            </div>
            <div className="rounded-[1.1rem] border border-black/7 bg-slate-50 px-4 py-4">
              <div className="psa-overline">Recall items</div>
              <div className="mt-2 text-base font-semibold text-slate-950">
                {compactInteger(trace.paper_recall.length)}
              </div>
            </div>
            <div className="rounded-[1.1rem] border border-black/7 bg-slate-50 px-4 py-4">
              <div className="psa-overline">Runtime</div>
              <div className="mt-2 text-base font-semibold text-slate-950">
                {formatDuration(trace.timings_ms.total ?? 0)}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
          <div className="rounded-[1.4rem] border border-black/7 bg-white px-5 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <div className="psa-overline">Query parser</div>
            <div className="mt-4 rounded-[1rem] border border-black/6 bg-slate-50 px-4 py-4">
              <div className="text-sm font-medium text-slate-900">Global query</div>
              <p className="mt-2 text-sm leading-7 text-slate-600">{trace.query_plan.global_query}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {trace.query_plan.scope_constraints.venues.map((venue: string) => (
                <span key={venue} className="rounded-full border border-black/8 bg-slate-50 px-3 py-1.5 text-sm text-slate-600">
                  venue: {venue}
                </span>
              ))}
              {trace.query_plan.scope_constraints.years.map((year) => (
                <span key={year} className="rounded-full border border-black/8 bg-slate-50 px-3 py-1.5 text-sm text-slate-600">
                  year: {year}
                </span>
              ))}
              {trace.query_plan.entity_terms.map((term) => (
                <span key={term} className="rounded-full border border-black/8 bg-slate-50 px-3 py-1.5 text-sm text-slate-600">
                  {term}
                </span>
              ))}
            </div>

            <div className="mt-4 grid gap-3">
              {trace.query_plan.aspect_queries.map((aspect) => (
                <div key={aspect.aspect_id} className="rounded-[1rem] border border-black/6 bg-slate-50 px-4 py-3">
                  <div className="text-sm font-medium text-slate-900">
                    {aspect.aspect_id} · weight {aspect.weight.toFixed(2)}
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{aspect.query}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.4rem] border border-black/7 bg-white px-5 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <div className="psa-overline">Runtime</div>
            <div className="mt-4 space-y-3">
              {Object.entries(trace.timings_ms).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3 rounded-[1rem] border border-black/6 bg-slate-50 px-4 py-3">
                  <span className="text-sm font-medium text-slate-700">{titleCaseToken(key)}</span>
                  <span className="text-sm text-slate-500">{formatDuration(value)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[1.4rem] border border-black/7 bg-white px-5 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
          <div className="psa-overline">Candidate sources</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Object.entries(filterSummary.source_sizes ?? {}).map(([source, size]) => (
              <div key={source} className="rounded-[1rem] border border-black/6 bg-slate-50 px-4 py-3">
                <div className="text-sm font-medium text-slate-700">{titleCaseToken(source)}</div>
                <div className="mt-1 text-sm text-slate-500">{compactInteger(size)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[1.4rem] border border-black/7 bg-white px-5 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
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
                {trace.paper_recall.slice(0, 20).map((item) => (
                  <tr key={`${item.source}-${item.item_id}-${item.rank}`} className="bg-slate-50 text-sm text-slate-600">
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
    </main>
  );
}
