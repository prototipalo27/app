import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export interface InvoiceOcrResult {
  company: string | null;
  total: string | null;
  /** Invoice date in YYYY-MM-DD format, or null */
  date: string | null;
}

/**
 * Extract invoice data from an image using Claude Vision.
 * Returns company name, total amount, and invoice date.
 */
export async function extractInvoiceData(
  base64: string,
  mimeType: "image/jpeg" | "image/png" | "image/gif" | "image/webp",
): Promise<InvoiceOcrResult> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 150,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType, data: base64 },
          },
          {
            type: "text",
            text: 'Esta es una factura o ticket. Extrae: 1) nombre de la empresa que EMITE (proveedor, NO cliente), 2) importe TOTAL con IVA, 3) fecha de la factura. Responde SOLO JSON: {"company":"Nombre","total":"123.45","date":"2026-04-17"}. Si no detectas algo, pon null. Solo el JSON.',
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";

  let company: string | null = null;
  let total: string | null = null;
  let date: string | null = null;

  try {
    const parsed = JSON.parse(text);
    company = parsed.company || null;
    total = parsed.total || null;
    date = parsed.date || null;
  } catch {
    company = text === "null" || text === "" ? null : text;
  }

  // Sanitize company name for filenames
  const sanitizedCompany = company
    ? company
        .replace(/[/\\:*?"<>|]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60)
    : null;

  // Validate date format
  const validDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;

  return { company: sanitizedCompany, total, date: validDate };
}

/**
 * Extract invoice data from a PDF by converting first page to image.
 * Uses pdf-to-img or falls back to returning nulls.
 */
export async function extractInvoiceDataFromPdf(
  pdfBuffer: Buffer,
): Promise<InvoiceOcrResult> {
  // Use Claude's PDF support directly via base64 document
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBuffer.toString("base64"),
              },
            },
            {
              type: "text",
              text: 'Esta es una factura. Extrae: 1) nombre de la empresa que EMITE (proveedor, NO cliente), 2) importe TOTAL con IVA, 3) fecha de la factura. Responde SOLO JSON: {"company":"Nombre","total":"123.45","date":"2026-04-17"}. Si no detectas algo, pon null. Solo el JSON.',
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    let company: string | null = null;
    let total: string | null = null;
    let date: string | null = null;

    try {
      const parsed = JSON.parse(text);
      company = parsed.company || null;
      total = parsed.total || null;
      date = parsed.date || null;
    } catch {
      company = text === "null" || text === "" ? null : text;
    }

    const sanitizedCompany = company
      ? company.replace(/[/\\:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 60)
      : null;

    const validDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;

    return { company: sanitizedCompany, total, date: validDate };
  } catch (err) {
    console.error("[InvoiceOCR] PDF extraction failed:", err);
    return { company: null, total: null, date: null };
  }
}
