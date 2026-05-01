import Anthropic from "@anthropic-ai/sdk";

export { slugifyCompany } from "./invoice-slug";

const client = new Anthropic();

export interface InvoiceOcrResult {
  company: string | null;
  total: string | null;
  /** Invoice date in YYYY-MM-DD format, or null */
  date: string | null;
}

const PROMPT =
  'Esta es una factura o ticket. Extrae: 1) nombre de la empresa que EMITE (proveedor, NO cliente), 2) importe TOTAL con IVA, 3) fecha de la factura. Responde SOLO JSON: {"company":"Nombre","total":"123.45","date":"2026-04-17"}. Si no detectas algo, pon null. Solo el JSON.';

const MODEL = "claude-sonnet-4-20250514";

function parseAndSanitize(rawText: string): InvoiceOcrResult {
  // Strip markdown code fences if Claude wraps the response
  const text = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let company: string | null = null;
  let total: string | null = null;
  let date: string | null = null;

  try {
    const parsed = JSON.parse(text);
    company = typeof parsed.company === "string" ? parsed.company : null;
    total = typeof parsed.total === "string" ? parsed.total : null;
    date = typeof parsed.date === "string" ? parsed.date : null;
  } catch {
    // If we couldn't parse JSON, don't fall back to raw text — it pollutes filenames
  }

  // Display-friendly company: drop filename-illegal chars and commas, keep accents/dots
  const sanitizedCompany = company
    ? company
        .replace(/[/\\:*?"<>|,]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60) || null
    : null;

  // Total: use dot as decimal separator and only keep numeric values
  if (total) {
    const normalized = total.replace(/\s/g, "").replace(",", ".");
    total = /^\d+(\.\d+)?$/.test(normalized) ? normalized : null;
  }

  const validDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;

  return { company: sanitizedCompany, total, date: validDate };
}

export async function extractInvoiceData(
  base64: string,
  mimeType: "image/jpeg" | "image/png" | "image/gif" | "image/webp",
): Promise<InvoiceOcrResult> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 150,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType, data: base64 },
          },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });

  const rawText =
    response.content[0].type === "text" ? response.content[0].text.trim() : "";
  return parseAndSanitize(rawText);
}

export async function extractInvoiceDataFromPdf(
  pdfBuffer: Buffer,
): Promise<InvoiceOcrResult> {
  try {
    const response = await client.messages.create({
      model: MODEL,
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
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text.trim() : "";
    return parseAndSanitize(rawText);
  } catch (err) {
    console.error("[InvoiceOCR] PDF extraction failed:", err);
    return { company: null, total: null, date: null };
  }
}
