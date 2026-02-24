import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface ProjectContext {
  projectName: string;
  description?: string | null;
  products?: string[];
  clientName?: string | null;
  leadMessage?: string | null;
}

/**
 * Auto-classify a project by selecting the best matching template,
 * then apply it (copy checklist items). Non-fatal on failure.
 */
export async function classifyAndApplyTemplate(
  projectId: string,
  context: ProjectContext
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  const supabase = getSupabase();

  try {
    // Get active templates
    const { data: templates } = await supabase
      .from("project_templates")
      .select("id, name, description")
      .eq("is_active", true);

    if (!templates || templates.length === 0) return;

    const templateList = templates
      .map((t) => `- "${t.name}"${t.description ? ` (${t.description})` : ""}`)
      .join("\n");

    const projectInfo = [
      `Nombre del proyecto/cliente: ${context.projectName}`,
      context.description ? `Descripción: ${context.description}` : null,
      context.products?.length
        ? `Productos/items: ${context.products.join(", ")}`
        : null,
      context.leadMessage ? `Mensaje del cliente: ${context.leadMessage}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      system: `Eres un clasificador de proyectos de un taller de impresión 3D (Prototipalo).
Tu trabajo es analizar la información de un proyecto y elegir la plantilla que mejor encaja.
Responde ÚNICAMENTE con el nombre exacto de la plantilla elegida, sin explicación ni texto adicional.
Si ninguna plantilla encaja claramente, responde "ninguna".`,
      messages: [
        {
          role: "user",
          content: `Plantillas disponibles:\n${templateList}\n\nInformación del proyecto:\n${projectInfo}\n\n¿Qué plantilla encaja mejor?`,
        },
      ],
    });

    const answer =
      response.content[0].type === "text"
        ? response.content[0].text.trim()
        : "";

    if (!answer || answer.toLowerCase() === "ninguna") return;

    // Match the answer to a template (fuzzy: case-insensitive, trimmed)
    const matched = templates.find(
      (t) => t.name.toLowerCase() === answer.toLowerCase()
    );

    if (!matched) return;

    // Apply template: update project and copy checklist items
    await supabase
      .from("projects")
      .update({ template_id: matched.id })
      .eq("id", projectId);

    const { data: templateItems } = await supabase
      .from("template_checklist_items")
      .select("name, item_type, position")
      .eq("template_id", matched.id)
      .order("position");

    if (templateItems && templateItems.length > 0) {
      await supabase.from("project_checklist_items").insert(
        templateItems.map((item) => ({
          project_id: projectId,
          name: item.name,
          item_type: item.item_type,
          position: item.position,
        }))
      );
    }
  } catch (e) {
    console.error("AI project classification failed:", e);
  }
}
