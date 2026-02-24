import Anthropic from "@anthropic-ai/sdk";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function getSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface LeadContext {
  fullName: string;
  company?: string | null;
  message?: string | null;
}

/**
 * Generate an AI email draft for a lead and save it to the leads table.
 * Designed to be called from webhooks (service role) or server actions.
 * Non-fatal: silently returns on failure so it never blocks lead creation.
 */
export async function generateAndSaveDraft(
  leadId: string,
  lead: LeadContext,
  replyToContent?: string
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  const supabase = getSupabase();

  try {
    // Get recent email history for this lead
    const { data: emailActivities } = await supabase
      .from("lead_activities")
      .select("activity_type, content, metadata, created_at")
      .eq("lead_id", leadId)
      .in("activity_type", ["email_sent", "email_received"])
      .order("created_at", { ascending: true })
      .limit(20);

    // Get ALL snippets as knowledge base
    const { data: snippets } = await supabase
      .from("email_snippets")
      .select("title, content, category")
      .order("category")
      .order("sort_order", { ascending: true });

    // Build context
    const leadContext = [
      `Nombre: ${lead.fullName}`,
      lead.company ? `Empresa: ${lead.company}` : null,
      lead.message ? `Mensaje original del lead: ${lead.message}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    let emailHistory = "";
    if (emailActivities && emailActivities.length > 0) {
      emailHistory = emailActivities
        .map((e) => {
          const direction = e.activity_type === "email_sent" ? "ENVIADO" : "RECIBIDO";
          const meta = e.metadata as Record<string, unknown> | null;
          const subject = meta?.email_subject ? ` (Asunto: ${meta.email_subject})` : "";
          return `[${direction}]${subject}\n${e.content || "(sin contenido)"}`;
        })
        .join("\n---\n");
    }

    // Group snippets by category
    let snippetRef = "";
    if (snippets && snippets.length > 0) {
      const byCategory = new Map<string, typeof snippets>();
      for (const s of snippets) {
        if (!byCategory.has(s.category)) byCategory.set(s.category, []);
        byCategory.get(s.category)!.push(s);
      }
      snippetRef = Array.from(byCategory.entries())
        .map(
          ([cat, items]) =>
            `[${cat.toUpperCase()}]\n${items.map((s) => `- ${s.title}: ${s.content}`).join("\n")}`
        )
        .join("\n\n");
    }

    const systemPrompt = `Eres un asistente de ventas de Prototipalo, un taller de producción especializado en impresión 3D con impresoras Bambu Lab.
Generas borradores de email profesionales pero cercanos, siempre en español.

Reglas:
- Tono profesional pero cercano y amigable
- En español
- Conciso, ve al grano
- NO incluyas firma (se añade automáticamente)
- NO incluyas línea de asunto
- NO uses emojis
- Si es una respuesta, responde directamente al contenido del email recibido
- Si es un email nuevo, preséntate brevemente y aborda el mensaje/consulta del lead
- Usa la información de los SNIPPETS DE CONOCIMIENTO como fuente de verdad para precios, plazos, materiales, envíos y condiciones de pago
- Si el lead pregunta algo que está cubierto en los snippets, usa esa información en tu respuesta
- Si no tienes datos suficientes para dar un precio concreto, indica que se preparará un presupuesto personalizado`;

    const userPrompt = [
      "Genera un borrador de email para este lead.",
      "",
      "--- DATOS DEL LEAD ---",
      leadContext,
      emailHistory ? `\n--- HISTORIAL DE EMAILS ---\n${emailHistory}` : "",
      replyToContent ? `\n--- EMAIL AL QUE RESPONDER ---\n${replyToContent}` : "",
      snippetRef
        ? `\n--- SNIPPETS DE CONOCIMIENTO (precios, plazos, materiales, condiciones — ÚSALOS como fuente de verdad) ---\n${snippetRef}`
        : "",
      "",
      replyToContent
        ? "Genera una respuesta adecuada al email recibido."
        : "Genera un email inicial adecuado para este lead.",
    ]
      .filter((line) => line !== undefined)
      .join("\n");

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const draft =
      response.content[0].type === "text" ? response.content[0].text : "";

    if (draft) {
      await supabase
        .from("leads")
        .update({ ai_draft: draft })
        .eq("id", leadId);
    }
  } catch (e) {
    // Non-fatal: log but don't throw
    console.error("AI draft generation failed:", e);
  }
}
