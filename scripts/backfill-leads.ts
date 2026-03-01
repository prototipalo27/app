/**
 * One-time script: classify and estimate all "new" leads missing project_type_tag.
 *
 * Usage: npx tsx scripts/backfill-leads.ts
 *
 * Requires env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const CATEGORIES = [
  "Trofeos",
  "Llaveros",
  "Maquetas",
  "Letras Corporeas",
  "Medallas",
  "Figuras",
  "Prototipos",
  "Merchandising",
  "Otro",
];

const VALID_QUANTITIES = ["1-10", "10-50", "50-200", "200-500", "500+"];

interface AiResult {
  category: string;
  exact_quantity: number | null;
  quantity_range: string | null;
  complexity: "low" | "medium" | "high";
  urgency: "normal" | "urgent";
}

async function classifyLead(message: string): Promise<AiResult | null> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      system: `Eres un asistente de Prototipalo, un taller de impresión 3D. Analiza el mensaje de un cliente y clasifícalo.

Categorías disponibles: ${CATEGORIES.join(", ")}

Responde SOLO con JSON válido:
{
  "category": "...",
  "exact_quantity": <número exacto de unidades que pide el cliente, o null si no lo dice>,
  "quantity_range": "1-10"|"10-50"|"50-200"|"200-500"|"500+",
  "complexity": "low"|"medium"|"high",
  "urgency": "normal"|"urgent"
}

Reglas:
- exact_quantity: el número EXACTO de piezas/unidades que pide. Ignora números que sean fechas, aniversarios, medidas o años. Si dice "un trofeo" = 1. Si no menciona cantidad, pon null.
- quantity_range: el rango que corresponde a exact_quantity, o tu mejor estimación si no hay cantidad exacta.
- category: elige la que mejor encaje. "Medallas" para medallas. "Trofeos" para trofeos/premios/reconocimientos. "Merchandising" para posavasos, regalos corporativos genéricos. "Prototipos" para piezas técnicas o prototipos. "Figuras" para figuras decorativas, muñecos, estatuillas.
- complexity: "low" = piezas planas/simples, "medium" = estándar, "high" = acabados especiales, mecanismos, multicolor complejo.
- urgency: "urgent" si menciona prisa, fecha cercana, evento próximo.`,
      messages: [{ role: "user", content: message }],
    });

    let text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    // Strip markdown code fences if present
    text = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
    const parsed = JSON.parse(text);

    return {
      category: CATEGORIES.includes(parsed.category) ? parsed.category : "Otro",
      exact_quantity: typeof parsed.exact_quantity === "number" && parsed.exact_quantity > 0 ? parsed.exact_quantity : null,
      quantity_range: VALID_QUANTITIES.includes(parsed.quantity_range) ? parsed.quantity_range : null,
      complexity: ["low", "medium", "high"].includes(parsed.complexity) ? parsed.complexity : "medium",
      urgency: ["normal", "urgent"].includes(parsed.urgency) ? parsed.urgency : "normal",
    };
  } catch (e) {
    console.error("  AI error:", e);
    return null;
  }
}

async function main() {
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, full_name, message")
    .eq("status", "new")
    .is("project_type_tag", null)
    .not("message", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching leads:", error);
    process.exit(1);
  }

  console.log(`Found ${leads.length} leads to classify\n`);

  const summary: Record<string, number> = {};
  let processed = 0;

  for (const lead of leads) {
    const result = await classifyLead(lead.message);
    if (!result) {
      console.log(`✗ ${lead.full_name}: AI failed`);
      continue;
    }

    // Update lead in DB (trigger will recalculate estimated_value)
    const { error: updateError } = await supabase
      .from("leads")
      .update({
        project_type_tag: result.category,
        estimated_quantity: result.quantity_range,
        estimated_exact_quantity: result.exact_quantity,
        estimated_complexity: result.complexity,
        estimated_urgency: result.urgency,
      })
      .eq("id", lead.id);

    if (updateError) {
      console.log(`✗ ${lead.full_name}: DB error - ${updateError.message}`);
      continue;
    }

    summary[result.category] = (summary[result.category] || 0) + 1;
    processed++;

    const qty = result.exact_quantity ?? `~${result.quantity_range}`;
    console.log(`✓ ${lead.full_name}: ${result.category} × ${qty} (${result.complexity}, ${result.urgency})`);
  }

  console.log(`\n--- Resumen ---`);
  console.log(`Procesados: ${processed}/${leads.length}`);
  console.log(`\nCategorías:`);
  Object.entries(summary)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => console.log(`  ${cat}: ${count}`));
}

main();
