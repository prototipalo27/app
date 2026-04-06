import Anthropic from "@anthropic-ai/sdk";
import { EXPENSE_CATEGORIES } from "./categories";

interface VendorInput {
  vendorName: string;
  description: string;
  amount: number;
}

interface CategorySuggestion {
  category: string;
  confidence: number;
}

const validKeys = new Set(EXPENSE_CATEGORIES.map((c) => c.value));

/**
 * Use Claude to categorize a batch of unknown vendors.
 * Returns a map of vendorName → { category, confidence }.
 * Non-fatal: returns empty map on any failure.
 */
export async function aiCategorizeVendorsBatch(
  vendors: VendorInput[]
): Promise<Map<string, CategorySuggestion>> {
  const result = new Map<string, CategorySuggestion>();
  if (vendors.length === 0) return result;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return result;

  const categoryList = EXPENSE_CATEGORIES.map(
    (c) => `- "${c.value}": ${c.label}`
  ).join("\n");

  const vendorList = vendors
    .map(
      (v, i) =>
        `${i + 1}. Vendor: "${v.vendorName}" | Descripción: "${v.description}" | Importe: ${v.amount.toFixed(2)}€`
    )
    .join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: `Eres un clasificador de gastos de Prototipalo, un taller de impresión 3D y producción en Madrid.
Analiza cada vendor/proveedor y asígnale la categoría de gasto más apropiada.
Los importes negativos son gastos, los positivos son ingresos.

Categorías disponibles:
${categoryList}

Responde ÚNICAMENTE con un JSON array. Cada elemento debe tener:
- "vendor": el nombre exacto del vendor (tal como se te proporcionó)
- "category": la clave de categoría (ej: "production", "software")
- "confidence": un número entre 0 y 1 indicando tu confianza

Ejemplo de respuesta:
[{"vendor": "Amazon Marketplace", "category": "production", "confidence": 0.85}]

No incluyas explicaciones, solo el JSON array.`,
      messages: [
        {
          role: "user",
          content: `Clasifica estos vendors:\n${vendorList}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text.trim() : "";

    // Extract JSON array from response (handle markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return result;

    const parsed: { vendor: string; category: string; confidence: number }[] =
      JSON.parse(jsonMatch[0]);

    for (const item of parsed) {
      if (validKeys.has(item.category) && typeof item.confidence === "number") {
        result.set(item.vendor, {
          category: item.category,
          confidence: Math.min(Math.max(item.confidence, 0), 1),
        });
      }
    }
  } catch {
    // Non-fatal — return whatever we have
  }

  return result;
}
