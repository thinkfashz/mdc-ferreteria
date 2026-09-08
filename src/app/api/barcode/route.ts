import { NextResponse } from "next/server";
import { adminFunctionRpc, adminGatewayResponse } from "@/lib/supabase-admin";

interface BarcodeResult {
  found: boolean;
  source: string;
  code: string;
  name: string;
  brand: string;
  description: string;
  imageUrl: string;
  category: string;
  categoryId?: string | null;
  local: boolean;
  productId?: string | null;
  stock?: number | null;
  price?: number | null;
}

interface LocalProduct {
  id: string;
  name: string;
  brand?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  barcode?: string | null;
  sku?: string | null;
  stock?: number | null;
  price?: number | null;
  categoryId?: string | null;
  category?: { name?: string | null } | null;
}

const EMPTY: Omit<BarcodeResult, "code"> = {
  found: false,
  source: "none",
  name: "",
  brand: "",
  description: "",
  imageUrl: "",
  category: "",
  categoryId: null,
  local: false,
  productId: null,
  stock: null,
  price: null,
};

async function fetchWithTimeout(url: string, timeout = 3000): Promise<Response | null> {
  try {
    return await fetch(url, {
      signal: AbortSignal.timeout(timeout),
      headers: {
        Accept: "application/json",
        "User-Agent": "MDC-Ferreteria/2.0 (barcode inventory lookup)",
      },
      next: { revalidate: 86400 },
    });
  } catch {
    return null;
  }
}

function remoteResult(code: string, source: string, values: Partial<BarcodeResult>): BarcodeResult | null {
  const name = String(values.name || "").trim();
  const brand = String(values.brand || "").trim();
  const description = String(values.description || "").trim();
  const imageUrl = String(values.imageUrl || "").trim();
  const category = String(values.category || "").trim();
  if (!name && !brand && !description && !imageUrl) return null;
  return {
    found: true,
    source,
    code,
    name,
    brand,
    description: description || name,
    imageUrl,
    category,
    categoryId: null,
    local: false,
    productId: null,
    stock: null,
    price: null,
  };
}

async function searchUPCItemDB(code: string): Promise<BarcodeResult | null> {
  const res = await fetchWithTimeout(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`);
  if (!res?.ok) return null;
  const data = await res.json().catch(() => null);
  const item = data?.items?.[0];
  if (!item) return null;
  return remoteResult(code, "UPC Item DB", {
    name: item.title,
    brand: item.brand,
    description: item.description || item.title,
    imageUrl: item.images?.[0],
    category: item.category,
  });
}

async function searchOpenFacts(code: string, host: string, source: string): Promise<BarcodeResult | null> {
  const res = await fetchWithTimeout(`https://${host}/api/v2/product/${encodeURIComponent(code)}.json`);
  if (!res?.ok) return null;
  const data = await res.json().catch(() => null);
  if (data?.status !== 1 || !data?.product) return null;
  const p = data.product;
  return remoteResult(code, source, {
    name: p.product_name || p.generic_name,
    brand: p.brands,
    description: p.generic_name || p.product_name,
    imageUrl: p.image_front_url || p.image_url,
    category: p.categories,
  });
}

function resultScore(result: BarcodeResult) {
  let score = 0;
  if (result.name) score += 5;
  if (result.brand) score += 2;
  if (result.description && result.description !== result.name) score += 2;
  if (result.imageUrl) score += 4;
  if (result.category) score += 1;
  if (result.source === "UPC Item DB") score += 1;
  return score;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = String(searchParams.get("code") || "").trim();

  if (!code) return NextResponse.json({ error: "Código requerido" }, { status: 400 });
  if (!/^[0-9A-Za-z\-_.]{4,64}$/.test(code)) return NextResponse.json({ ...EMPTY, code });

  try {
    const local = await adminFunctionRpc<LocalProduct | null>("mdc_admin_product_lookup", { p_code: code });
    if (local?.id) {
      return NextResponse.json({
        found: true,
        source: "MDC Inventario",
        code,
        name: local.name || "",
        brand: local.brand || "",
        description: local.description || "",
        imageUrl: local.imageUrl || "",
        category: local.category?.name || "",
        categoryId: local.categoryId || null,
        local: true,
        productId: local.id,
        stock: Number(local.stock ?? 0),
        price: Number(local.price ?? 0),
      } satisfies BarcodeResult, { headers: { "Cache-Control": "private, no-store" } });
    }

    const settled = await Promise.allSettled([
      searchUPCItemDB(code),
      searchOpenFacts(code, "world.openproductsfacts.org", "Open Products Facts"),
      searchOpenFacts(code, "world.openfoodfacts.org", "Open Food Facts"),
      searchOpenFacts(code, "world.openbeautyfacts.org", "Open Beauty Facts"),
      searchOpenFacts(code, "world.openpetfoodfacts.org", "Open Pet Food Facts"),
    ]);

    const candidates = settled
      .filter((entry): entry is PromiseFulfilledResult<BarcodeResult | null> => entry.status === "fulfilled")
      .map((entry) => entry.value)
      .filter((entry): entry is BarcodeResult => Boolean(entry?.found))
      .sort((a, b) => resultScore(b) - resultScore(a));

    const best = candidates[0];
    if (best) return NextResponse.json(best, { headers: { "Cache-Control": "private, max-age=300" } });
    return NextResponse.json({ ...EMPTY, code }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    const response = adminGatewayResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
