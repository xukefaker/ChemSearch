import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/backend-proxy';

export async function POST(request: NextRequest) {
  return proxyToBackend('/workbench/library/index', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: (await request.text()) || '{}',
  });
}
