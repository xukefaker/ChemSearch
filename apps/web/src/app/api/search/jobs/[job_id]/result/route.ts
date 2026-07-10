import { proxyToBackend } from '@/lib/backend-proxy';

export async function GET(_request: Request, context: { params: Promise<{ job_id: string }> }) {
  const { job_id: jobId } = await context.params;
  return proxyToBackend(`/workbench/search/jobs/${encodeURIComponent(jobId)}/result`);
}
