import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

function validateAuth(request: NextRequest): boolean {
  // Allow if Supabase session cookie exists (dashboard user)
  // OR if x-scan-pin header matches (standalone scan)
  const pin = request.headers.get("x-scan-pin");
  const expectedPin = process.env.SCAN_PIN;
  if (pin && expectedPin && pin === expectedPin) return true;

  // Check for Supabase auth cookie presence (actual auth is handled by middleware)
  const cookies = request.cookies;
  const hasAuthCookie = cookies.getAll().some((c) => c.name.startsWith("sb-"));
  return hasAuthCookie;
}

/**
 * POST /api/scan/ocr
 * Body: FormData with "file" (image)
 * Returns: { company: string | null }
 */
export async function POST(request: NextRequest) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    // Determine media type
    const mimeType = file.type || "image/jpeg";
    const supportedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
    type ImageMediaType = typeof supportedTypes[number];

    if (!supportedTypes.includes(mimeType as ImageMediaType)) {
      // For PDFs or unsupported types, skip OCR
      return NextResponse.json({ company: null });
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as ImageMediaType,
                data: base64,
              },
            },
            {
              type: "text",
              text: 'Esta es una factura o ticket. Extrae el nombre de la empresa que EMITE la factura (proveedor/vendedor, NO el cliente) y el importe TOTAL. Responde en formato JSON exacto: {"company":"Nombre Empresa","total":"123.45"}. Si no puedes identificar alguno, pon null en ese campo. Solo el JSON, nada mas.',
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    // Parse JSON response from Claude
    let company: string | null = null;
    let total: string | null = null;
    try {
      const parsed = JSON.parse(text);
      company = parsed.company || null;
      total = parsed.total || null;
    } catch {
      // If not valid JSON, try to use raw text as company name
      company = text === "null" || text === "" ? null : text;
    }

    // Sanitize company name for use in filenames
    const sanitizedCompany = company
      ? company
          .replace(/[/\\:*?"<>|]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 60)
      : null;

    return NextResponse.json({ company: sanitizedCompany, total });
  } catch (err) {
    console.error("[OCR] Error:", err);
    // Non-fatal: return null company so upload can continue
    return NextResponse.json({ company: null });
  }
}
