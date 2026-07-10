import { proxyToBackend } from '@/lib/backend-proxy';

export function GET() {
  return proxyToBackend('/workbench/library/papers');
}
