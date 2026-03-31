import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ job_id: string }> },
) {
  const { job_id } = await params;
  return proxyToBackend(`/search/jobs/${encodeURIComponent(job_id)}`);
}
