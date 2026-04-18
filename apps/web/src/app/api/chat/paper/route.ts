import { proxyToBackend } from "@/lib/backend-proxy";

export async function POST(request: Request) {
  return proxyToBackend("/chat/paper", {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
    body: await request.text(),
  });
}
