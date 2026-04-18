import { RESULT_BUCKETS, type ResultBucketKey, resultBucketMeta } from "@/lib/presentation";

type ResultGroupTabsProps = {
  activeBucket: ResultBucketKey;
  counts: Record<ResultBucketKey, number>;
  onChange: (bucket: ResultBucketKey) => void;
};

export function ResultGroupTabs({ activeBucket, counts, onChange }: ResultGroupTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {RESULT_BUCKETS.map((bucket) => {
        const active = bucket.key === activeBucket;

        return (
          <button
            key={bucket.key}
            type="button"
            onClick={() => onChange(bucket.key)}
            className={`rounded-full border px-3 py-2 text-sm transition ${
              active
                ? bucket.key === "satisfied"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : bucket.key === "partial"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                : "border-black/8 bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {resultBucketMeta(bucket.key).label} · {counts[bucket.key]}
          </button>
        );
      })}
    </div>
  );
}
