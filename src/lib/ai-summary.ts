import Anthropic from "@anthropic-ai/sdk";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function getSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Generate short AI summaries for leads that don't have one yet.
 * Processes in batch — non-fatal, never blocks the page load.
 */
export async function generateMissingSummaries(
  leads: Array<{ id: string; message: string | null; full_name: string; company: string | null }>
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return result;

  const toProcess = leads.filter((l) => l.message && l.message.length > 20);
  if (toProcess.length === 0) return result;

  const anthropic = new Anthropic({ apiKey });
  const supabase = getSupabase();

  // Process in parallel, max 10 at a time
  const batches = [];
  for (let i = 0; i < toProcess.length; i += 10) {
    batches.push(toProcess.slice(i, i + 10));
  }

  for (const batch of batches) {
    await Promise.all(
      batch.map(async (lead) => {
        try {
          const res = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 60,
            messages: [
              {
                role: "user",
                content: `Resume en máximo 12 palabras esta solicitud de un cliente a un taller de producción/impresión 3D. Solo el resumen, sin comillas ni puntos finales.\n\nCliente: ${lead.full_name}${lead.company ? ` (${lead.company})` : ""}\nMensaje: ${lead.message}`,
              },
            ],
          });

          const summary =
            res.content[0].type === "text" ? res.content[0].text.trim() : "";
          if (summary) {
            result.set(lead.id, summary);
            // Save to DB (fire and forget)
            supabase
              .from("leads")
              .update({ ai_summary: summary })
              .eq("id", lead.id)
              .then();
          }
        } catch {
          // Non-fatal
        }
      })
    );
  }

  return result;
}
