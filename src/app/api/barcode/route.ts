import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";

interface BarcodeResult {
  found: boolean;
  source: string;
  code: string;
  name: string;
  brand: string;
  description: string;
  imageUrl: string;
  category: string;
}

const EMPTY: Omit<BarcodeResult, "code"> = {
  found: false, source: "none", name: "", brand: "", description: "", imageUrl: "", category: "",
};

async function fetchWithTimeout(url: string, timeout = 5000): Promise<Response | null> {
  try {
    return await fetch(url, {
      signal: AbortSignal.timeout(timeout),
      headers: { "User-Agent": "MDC-Ferreteria/1.0 (inventory lookup)" },
    });
  } catch { return null; }
}

async function searchUPCItemDB(code: string): Promise<BarcodeResult | null> {
  const res = await fetchWithTimeout(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`);
  if (!res?.ok) return null;
  const data = await res.json();
  if (!data.items?.length) return null;
  const item = data.items[0];
  return {
    found: true, source: "UPC Item DB", code,
    name: item.title || "",
    brand: item.brand || "",
    description: item.description || item.title || "",
    imageUrl: item.images?.[0] || "",
    category: item.category || "",
  };
}

async function searchOpenProductsFacts(code: string): Promise<BarcodeResult | null> {
  const res = await fetchWithTimeout(`https://world.openproductsfacts.org/api/v2/product/${code}.json`);
  if (!res?.ok) return null;
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  return {
    found: true, source: "Open Products Facts", code,
    name: p.product_name || p.generic_name || "",
    brand: p.brands || "",
    description: p.generic_name || p.product_name || "",
    imageUrl: p.image_url || "",
    category: p.categories || "",
  };
}

async function searchOpenFoodFacts(code: string): Promise<BarcodeResult | null> {
  const res = await fetchWithTimeout(`https://world.openfoodfacts.org/api/v2/product/${code}.json`);
  if (!res?.ok) return null;
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  return {
    found: true, source: "Open Food Facts", code,
    name: p.product_name || "",
    brand: p.brands || "",
    description: p.generic_name || p.product_name || "",
    imageUrl: p.image_url || "",
    category: p.categories || "",
  };
}

async function searchOpenBeautyFacts(code: string): Promise<BarcodeResult | null> {
  const res = await fetchWithTimeout(`https://world.openbeautyfacts.org/api/v2/product/${code}.json`);
  if (!res?.ok) return null;
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  return {
    found: true, source: "Open Beauty Facts", code,
    name: p.product_name || "",
    brand: p.brands || "",
    description: p.generic_name || p.product_name || "",
    imageUrl: p.image_url || "",
    category: p.categories || "",
  };
}

async function searchOpenPetFoodFacts(code: string): Promise<BarcodeResult | null> {
  const res = await fetchWithTimeout(`https://world.openpetfoodfacts.org/api/v2/product/${code}.json`);
  if (!res?.ok) return null;
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  return {
    found: true, source: "Open Pet Food Facts", code,
    name: p.product_name || "",
    brand: p.brands || "",
    description: p.generic_name || p.product_name || "",
    imageUrl: p.image_url || "",
    category: p.categories || "",
  };
}

async function searchGoUPC(code: string): Promise<BarcodeResult | null> {
  const res = await fetchWithTimeout(`https://go-upc.com/api/v1/code/${code}`);
  if (!res?.ok) return null;
  const data = await res.json();
  if (!data?.product) return null;
  const p = data.product;
  return {
    found: true, source: "Go-UPC", code,
    name: p.name || "",
    brand: p.brand || "",
    description: p.description || p.name || "",
    imageUrl: p.imageUrl || "",
    category: p.category || "",
  };
}

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Code required" }, { status: 400 });
  }

  const cleanCode = code.trim();
  if (!/^[0-9A-Za-z\-_\.]{4,64}$/.test(cleanCode)) {
    return NextResponse.json({ ...EMPTY, code: cleanCode });
  }

  const apis = [
    searchUPCItemDB,
    searchGoUPC,
    searchOpenProductsFacts,
    searchOpenFoodFacts,
    searchOpenBeautyFacts,
    searchOpenPetFoodFacts,
  ];

  for (const apiFn of apis) {
    const result = await apiFn(cleanCode);
    if (result?.found) return NextResponse.json(result);
  }

  return NextResponse.json({ ...EMPTY, code: cleanCode });
}
