import type {
  EvidenceChunk,
  HealthSummary,
  PaperResult,
  SearchJobResult,
  SearchJobStatus,
  SearchTrace,
} from "@/lib/types";

export const STAGE_ORDER = [
  "queued",
  "loading_index",
  "planning_query",
  "candidate_generation",
  "evidence_assembly",
  "final_verifier",
  "saving_trace",
  "completed",
] as const;

const STAGE_LABELS: Record<string, string> = {
  starting: "Submitting query",
  queued: "Queued",
  loading_index: "Loading index",
  planning_query: "Parsing query",
  candidate_generation: "Generating candidates",
  evidence_assembly: "Assembling evidence",
  final_verifier: "Running verifier",
  saving_trace: "Saving trace",
  completed: "Completed",
  failed: "Failed",
};

export const RESULT_BUCKETS = [
  {
    key: "satisfied",
    label: "Satisfied",
    description: "Papers the verifier judged as fully satisfying the query.",
  },
  {
    key: "partial",
    label: "Partial",
    description: "Papers with useful evidence, but not enough to satisfy every constraint.",
  },
  {
    key: "rejected",
    label: "Rejected",
    description: "Candidate papers inspected by the verifier and rejected.",
  },
] as const;

export type ResultBucketKey = (typeof RESULT_BUCKETS)[number]["key"];

export type SearchRun = {
  id: string;
  query: string;
  topK: number;
  createdAt: string;
  status: SearchJobStatus | null;
  result: SearchJobResult | null;
  error: string | null;
  activeBucket: ResultBucketKey;
  trace: SearchTrace | null;
  traceState: "idle" | "loading" | "loaded" | "error";
  traceError: string | null;
};

export function stageLabel(stage: string) {
  return STAGE_LABELS[stage] ?? titleCaseToken(stage);
}

export function titleCaseToken(value: string) {
  return value
    .split("_")
    .map((part) => (part.length <= 3 ? part.toUpperCase() : part[0]!.toUpperCase() + part.slice(1)))
    .join(" ");
}

export function bucketLabel(bucketId: string) {
  return bucketId
    .split("_")
    .map((part) => (part.length <= 3 ? part.toUpperCase() : part[0]!.toUpperCase() + part.slice(1)))
    .join(" ");
}

export function defaultBucket(result: SearchJobResult): ResultBucketKey {
  if (result.satisfied.length > 0) {
    return "satisfied";
  }
  if (result.partial.length > 0) {
    return "partial";
  }
  return "rejected";
}

export function bucketCounts(result: SearchJobResult) {
  return {
    satisfied: result.satisfied.length,
    partial: result.partial.length,
    rejected: result.rejected.length,
  } satisfies Record<ResultBucketKey, number>;
}

export function papersForBucket(result: SearchJobResult, bucket: ResultBucketKey) {
  if (bucket === "satisfied") {
    return result.satisfied;
  }
  if (bucket === "partial") {
    return result.partial;
  }
  return result.rejected;
}

export function assistantHeadline(result: SearchJobResult) {
  const counts = bucketCounts(result);

  if (counts.satisfied > 0) {
    return `Found ${counts.satisfied} paper${counts.satisfied === 1 ? "" : "s"} that satisfy the query.`;
  }
  if (counts.partial > 0) {
    return "No fully satisfied papers were verified, but the system found partial matches worth inspecting.";
  }
  return "The verifier rejected all candidate papers for this query.";
}

export function assistantSubheadline(result: SearchJobResult) {
  const counts = bucketCounts(result);
  return `${counts.satisfied} satisfied · ${counts.partial} partial · ${counts.rejected} rejected`;
}

export function primaryEvidenceChunk(paper: PaperResult): EvidenceChunk | null {
  for (const chunks of Object.values(paper.evidence_chunks)) {
    if (chunks.length > 0) {
      return chunks[0] ?? null;
    }
  }
  return null;
}

export function paperEvidenceCount(paper: PaperResult) {
  return Object.values(paper.evidence_chunks).reduce((total, chunks) => total + chunks.length, 0);
}

export function runProgress(status: SearchJobStatus | null) {
  if (!status) {
    return 0;
  }

  if (status.status === "completed") {
    return 100;
  }

  const stageIndex = STAGE_ORDER.indexOf(status.stage as (typeof STAGE_ORDER)[number]);
  if (stageIndex < 0) {
    return 8;
  }

  return Math.min(96, ((stageIndex + 1) / STAGE_ORDER.length) * 100);
}

export function healthStatusLabel(health: HealthSummary) {
  return health.kind === "ready" ? "Index ready" : "Backend unavailable";
}

export function healthStatusTone(health: HealthSummary) {
  return health.kind === "ready" ? "ready" : "error";
}

export function buildPendingRun(id: string, query: string, topK: number): SearchRun {
  const now = new Date().toISOString();

  return {
    id,
    query,
    topK,
    createdAt: now,
    status: {
      job_id: id,
      status: "queued",
      stage: "starting",
      message: "Submitting query to the backend.",
      created_at: now,
      elapsed_ms: 0,
    },
    result: null,
    error: null,
    activeBucket: "satisfied",
    trace: null,
    traceState: "idle",
    traceError: null,
  };
}

export function resultBucketMeta(bucket: ResultBucketKey) {
  return RESULT_BUCKETS.find((item) => item.key === bucket) ?? RESULT_BUCKETS[0];
}

export function compactInteger(value: number) {
  return new Intl.NumberFormat("en", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}
