const EDGE_BASE = "https://rrtgulgmyrghvpdmwvse.supabase.co/functions/v1/mdc-public";

export async function proxyPublicEdge(
  action: "catalog" | "checkout" | "analytics",
  req: Request,
  init?: RequestInit,
) {
  const incoming = new URL(req.url);
  const target = new URL(`${EDGE_BASE}/${action}`);

  if (action === "catalog") {
    incoming.searchParams.forEach((value, key) => target.searchParams.set(key, value));
  }

  const response = await fetch(target, {
    method: init?.method || req.method,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
    body: init?.body,
    cache: "no-store",
  });

  const text = await response.text();
  return new Response(text, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store, max-age=0",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": action === "catalog" ? "GET, OPTIONS" : "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
