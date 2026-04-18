import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ paper_id: string; image_path: string[] }>;
  },
) {
  const { paper_id, image_path } = await params;
  const encodedPath = image_path.map((part) => encodeURIComponent(part)).join("/");
  return proxyToBackend(`/papers/${encodeURIComponent(paper_id)}/images/${encodedPath}`);
}
