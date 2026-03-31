import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ trace_id: string }> },
) {
  const { trace_id } = await params;
  return proxyToBackend(`/traces/${encodeURIComponent(trace_id)}`);
}
