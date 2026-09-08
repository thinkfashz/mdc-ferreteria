const SUPABASE_URL = "https://rrtgulgmyrghvpdmwvse.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_xzaiNfdoM_cFPlESaDWqDQ_HG7lzKGg";

export async function callMdcRpc<T>(
  name: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "message" in data
        ? String((data as { message?: unknown }).message || "Supabase RPC error")
        : `Supabase RPC HTTP ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}
