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
              text: "Esta es una factura o ticket. Extrae SOLO el nombre de la empresa que EMITE la factura (el proveedor/vendedor, NO el cliente). Responde UNICAMENTE con el nombre de la empresa, sin explicaciones, sin comillas, sin puntuación extra. Si no puedes identificarlo, responde exactamente: null",
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const company = text === "null" || text === "" ? null : text;

    // Sanitize company name for use in filenames
    const sanitized = company
      ? company
          .replace(/[/\\:*?"<>|]/g, "") // Remove invalid filename chars
          .replace(/\s+/g, " ")          // Normalize whitespace
          .trim()
          .slice(0, 60)                  // Limit length
      : null;

    return NextResponse.json({ company: sanitized });
  } catch (err) {
    console.error("[OCR] Error:", err);
    // Non-fatal: return null company so upload can continue
    return NextResponse.json({ company: null });
  }
}
