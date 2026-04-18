import type { DemoQuery } from "@/lib/demo-queries";

type QueryPresetsProps = {
  presets: DemoQuery[];
  activeQuery: string;
  onSelect: (query: string) => void;
};

export function QueryPresets({ presets, activeQuery, onSelect }: QueryPresetsProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {presets.map((preset) => {
        const selected = preset.query.trim() === activeQuery.trim();

        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset.query)}
            className={`rounded-full border px-3 py-1.5 text-[0.92rem] transition ${
              selected
                ? "border-slate-300 bg-slate-900 text-white"
                : "border-black/8 bg-white/88 text-slate-500 hover:bg-white"
            }`}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
