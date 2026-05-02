"use client";

import { QueryPresets, type QueryPreset } from "@/components/query-presets";

type QueryComposerProps = {
  value: string;
  isSubmitting: boolean;
  presets: QueryPreset[];
  variant?: "centered" | "docked";
  showPresets?: boolean;
  onChange: (value: string) => void;
  onSelectPreset: (query: string) => void;
  onSubmit: () => void;
};

export function QueryComposer({
  value,
  isSubmitting,
  presets,
  variant = "docked",
  showPresets = true,
  onChange,
  onSelectPreset,
  onSubmit,
}: QueryComposerProps) {
  const centered = variant === "centered";

  return (
    <div className={centered ? "w-full" : "border-t border-black/6 bg-[rgba(247,248,251,0.9)] backdrop-blur-xl"}>
      <div
        className={`mx-auto flex w-full flex-col px-4 sm:px-6 ${
          centered ? "max-w-[min(100%,52rem)] gap-4" : "max-w-[min(100%,80rem)] gap-3 py-4"
        }`}
      >
        {showPresets ? <QueryPresets presets={presets} activeQuery={value} onSelect={onSelectPreset} /> : null}

        <div
          className={`rounded-[1.6rem] border border-black/8 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)] ${
            centered ? "p-4 sm:p-5" : "p-3"
          }`}
        >
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) {
                return;
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSubmit();
              }
            }}
            placeholder="Ask for papers, datasets, methods, or evidence."
            className={`w-full resize-none border-0 bg-transparent px-1 py-1 text-slate-950 outline-none placeholder:text-slate-400 ${
              centered
                ? "min-h-[9rem] text-[1.02rem] leading-8 sm:min-h-[8rem] sm:text-[1.08rem]"
                : "min-h-[8.5rem] text-[1rem] leading-7 sm:min-h-[7rem] sm:text-[1.05rem]"
            }`}
          />

          <div className="mt-3 flex flex-wrap items-center justify-end gap-3 border-t border-black/6 pt-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onSubmit}
                disabled={isSubmitting || value.trim().length === 0}
                className={`rounded-full bg-slate-950 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 ${
                  centered ? "px-5 py-2.5 text-sm" : "px-4 py-2 text-sm"
                }`}
              >
                {isSubmitting ? "Searching..." : "Search"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
