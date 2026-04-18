import { headers } from "next/headers";

import type { HealthResponse, HealthSummary, SearchTrace } from "@/lib/types";

export class ServerRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ServerRequestError";
    this.status = status;
  }
}

async function getAppBaseUrl(): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");

  if (!host) {
    return "http://127.0.0.1:4000";
  }

  const proto =
    headerStore.get("x-forwarded-proto") ??
    (host.startsWith("127.0.0.1") || host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function requestServerJson<T>(path: string): Promise<T> {
  const response = await fetch(`${await getAppBaseUrl()}${path}`, {
    cache: "no-store",
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}.`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        detail = payload.detail;
      }
    } catch {
      const text = await response.text();
      if (text) {
        detail = text;
      }
    }
    throw new ServerRequestError(response.status, detail);
  }

  return (await response.json()) as T;
}

export async function fetchHealthSummary(): Promise<HealthSummary> {
  try {
    const payload = await requestServerJson<HealthResponse>("/api/health");
    return { kind: "ready", data: payload };
  } catch (error) {
    return {
      kind: "error",
      message: error instanceof Error ? error.message : "Unknown backend connection error.",
    };
  }
}

export async function fetchTrace(traceId: string): Promise<SearchTrace> {
  return requestServerJson<SearchTrace>(`/api/traces/${encodeURIComponent(traceId)}`);
}
