"use client";

import { OverlayPanel } from "@/components/overlay-panel";
import { compactInteger, healthStatusLabel } from "@/lib/presentation";
import type { HealthSummary } from "@/lib/types";

type SystemStatusSheetProps = {
  health: HealthSummary;
  open: boolean;
  onClose: () => void;
};

export function SystemStatusSheet({ health, open, onClose }: SystemStatusSheetProps) {
  return (
    <OverlayPanel
      open={open}
      title="System status"
      description="Current backend connectivity and index summary."
      onClose={onClose}
    >
      {health.kind === "ready" ? (
        <div className="space-y-6">
          <section className="rounded-[1.2rem] border border-black/7 bg-slate-50 px-4 py-4">
            <div className="psa-overline">Backend</div>
            <h3 className="mt-2 text-[1.02rem] font-semibold text-slate-950">{healthStatusLabel(health)}</h3>
            <p className="mt-2 text-sm leading-7 text-slate-500">{health.data.data_dir}</p>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.2rem] border border-black/7 bg-white px-4 py-4">
              <div className="psa-overline">Corpus</div>
              <div className="mt-4 grid gap-3">
                <div className="rounded-[1rem] border border-black/6 bg-slate-50 px-4 py-3">
                  <div className="text-sm font-medium text-slate-700">Indexed papers</div>
                  <div className="mt-1 text-sm text-slate-500">{compactInteger(health.data.counts.papers)}</div>
                </div>
                <div className="rounded-[1rem] border border-black/6 bg-slate-50 px-4 py-3">
                  <div className="text-sm font-medium text-slate-700">Indexed chunks</div>
                  <div className="mt-1 text-sm text-slate-500">{compactInteger(health.data.counts.chunks)}</div>
                </div>
                <div className="rounded-[1rem] border border-black/6 bg-slate-50 px-4 py-3">
                  <div className="text-sm font-medium text-slate-700">Stored traces</div>
                  <div className="mt-1 text-sm text-slate-500">{compactInteger(health.data.counts.traces)}</div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.2rem] border border-black/7 bg-white px-4 py-4">
              <div className="psa-overline">Jobs</div>
              <div className="mt-4 grid gap-3">
                <div className="rounded-[1rem] border border-black/6 bg-slate-50 px-4 py-3">
                  <div className="text-sm font-medium text-slate-700">Total jobs</div>
                  <div className="mt-1 text-sm text-slate-500">{compactInteger(health.data.jobs.total_jobs)}</div>
                </div>
                <div className="rounded-[1rem] border border-black/6 bg-slate-50 px-4 py-3">
                  <div className="text-sm font-medium text-slate-700">Running</div>
                  <div className="mt-1 text-sm text-slate-500">{compactInteger(health.data.jobs.running)}</div>
                </div>
                <div className="rounded-[1rem] border border-black/6 bg-slate-50 px-4 py-3">
                  <div className="text-sm font-medium text-slate-700">Completed</div>
                  <div className="mt-1 text-sm text-slate-500">{compactInteger(health.data.jobs.completed)}</div>
                </div>
                <div className="rounded-[1rem] border border-black/6 bg-slate-50 px-4 py-3">
                  <div className="text-sm font-medium text-slate-700">Failed</div>
                  <div className="mt-1 text-sm text-slate-500">{compactInteger(health.data.jobs.failed)}</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className="rounded-[1.2rem] border border-rose-200 bg-rose-50 px-4 py-5 text-sm leading-7 text-rose-700">
          {health.message}
        </div>
      )}
    </OverlayPanel>
  );
}
