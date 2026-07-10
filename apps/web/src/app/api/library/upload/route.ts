import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/backend-proxy';

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? '';
  return proxyToBackend('/workbench/library/upload', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: await request.arrayBuffer(),
  });
}
