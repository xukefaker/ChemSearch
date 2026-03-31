import type {
  SearchJobResult,
  SearchJobStatus,
  SearchTrace,
  PaperChatRequest,
  PaperChatResponse,
  PaperViewerResponse,
} from '@/lib/types';

type JsonInit = {
  method?: 'GET' | 'POST';
  body?: unknown;
};

async function requestJson<T>(path: string, init: JsonInit = {}): Promise<T> {
  const response = await fetch(path, {
    method: init.method ?? 'GET',
    headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) message = payload.detail;
    } catch {
      const text = await response.text();
      if (text) message = text;
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export function createSearchJob(payload: { query: string; top_k: number; display_k?: number }) {
  return requestJson<SearchJobStatus>('/api/search/jobs', {
    method: 'POST',
    body: payload,
  });
}

export function fetchSearchJob(jobId: string) {
  return requestJson<SearchJobStatus>(`/api/search/jobs/${encodeURIComponent(jobId)}`);
}

export function fetchSearchJobResult(jobId: string) {
  return requestJson<SearchJobResult>(`/api/search/jobs/${encodeURIComponent(jobId)}/result`);
}

export function fetchTrace(traceId: string) {
  return requestJson<SearchTrace>(`/api/traces/${encodeURIComponent(traceId)}`);
}

export function chatWithPaper(payload: PaperChatRequest) {
  return requestJson<PaperChatResponse>('/api/chat/paper', {
    method: 'POST',
    body: payload,
  });
}

export async function fetchPaperContentList(paperId: string): Promise<unknown> {
  return requestJson<unknown>(`/api/papers/${encodeURIComponent(paperId)}/content_list`);
}

export function fetchPaperViewer(paperId: string) {
  return requestJson<PaperViewerResponse>(`/api/papers/${encodeURIComponent(paperId)}/viewer`);
}
