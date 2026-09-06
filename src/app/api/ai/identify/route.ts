import { NextResponse } from "next/server";

export const maxDuration = 120;

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const VISION_MODEL = process.env.OLLAMA_VISION_MODEL || "minicpm-v4.6:latest";

interface ProductDetails {
  name: string;
  brand: string;
  category: string;
  description: string;
  specs: string[];
  estimatedPriceClp: number;
  confidence: "alta" | "media" | "baja";
}

/* Reduce la imagen antes de mandarla a Ollama: 640px JPEG ≈ 40KB → ~50s de inferencia
   vs 1.9MB PNG que no alcanza a procesarse en el timeout. */
async function shrinkToBase64(dataUrl: string): Promise<string> {
  try {
    const sharp = (await import("sharp")).default;
    const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    const buf = Buffer.from(base64, "base64");
    const out = await sharp(buf)
      .resize(640, 640, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    return out.toString("base64");
  } catch {
    // si sharp falla, manda la imagen recortada a 640KB máx
    const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    return base64.slice(0, 640 * 1024);
  }
}

export async function POST(req: Request) {
  try {
    const { image } = await req.json();
    if (!image || typeof image !== "string") {
      return NextResponse.json({ error: "Imagen requerida (base64 data URL)" }, { status: 400 });
    }

    // Aceptar data URL o base64 puro
    if (image.length > 12_000_000) {
      return NextResponse.json({ error: "Imagen muy grande (máx ~9MB)" }, { status: 413 });
    }

    const prompt = `Analiza la foto de este producto de ferretería chilena. Devuelve SOLO un JSON (sin explicaciones), así:
{"name":"nombre corto","brand":"marca","category":"Herramientas|Materiales|Electricidad|Plomeria|Pintura|Ferreteria general","description":"1 frase","specs":["spec"],"price":9900,"confidence":"alta|media|baja"}
price = estimado en pesos chilenos (entero). Sé conciso: name máximo 6 palabras, description máximo 20 palabras, specs máximo 3.`;

    const imageBase64 = await shrinkToBase64(image);

    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          {
            role: "user",
            content: prompt,
            images: [imageBase64],
          },
        ],
        stream: false,
        format: "json",
        options: { temperature: 0.2, num_predict: 900 },
      }),
      signal: AbortSignal.timeout(110_000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Ollama respondió ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    let raw = data?.message?.content || "";

    // Tolerar fences de markdown por si el modelo los agrega
    raw = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let parsed: Partial<ProductDetails>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Intento 2: extraer el primer objeto JSON del texto
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) {
        return NextResponse.json({ error: "La IA no devolvió JSON válido", raw: raw.slice(0, 300) }, { status: 502 });
      }
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        return NextResponse.json({ error: "La IA no devolvió JSON válido", raw: raw.slice(0, 300) }, { status: 502 });
      }
    }

    const details: ProductDetails = {
      name: String(parsed.name || "Producto identificado").slice(0, 120),
      brand: String(parsed.brand || "Genérico").slice(0, 80),
      category: String(parsed.category || "Ferreteria general").replace(/Plomeria/i, "Plomería").slice(0, 60),
      description: String(parsed.description || "").slice(0, 600),
      specs: Array.isArray(parsed.specs) ? parsed.specs.slice(0, 8).map(String) : [],
      estimatedPriceClp: Math.max(0, Math.round(Number((parsed as any).price ?? parsed.estimatedPriceClp) || 0)),
      confidence: (["alta", "media", "baja"].includes(String(parsed.confidence))
        ? parsed.confidence
        : "media") as ProductDetails["confidence"],
    };

    return NextResponse.json({ success: true, details, model: VISION_MODEL });
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (/timeout|abort/i.test(msg)) {
      return NextResponse.json({ error: "Ollama tardó demasiado. ¿Está corriendo? (ollama serve)" }, { status: 504 });
    }
    if (/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(msg)) {
      return NextResponse.json(
        { error: "No hay conexión con Ollama. La identificación por foto funciona solo con la app corriendo en tu PC (ollama serve). El lector de códigos/QR sí funciona en la nube." },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: msg.slice(0, 300) }, { status: 500 });
  }
}