import { createServiceClient } from "@/lib/supabase/server";

/** Hardcoded aliases → template name mapping */
const ALIASES: Record<string, string> = {
  trofeo: "Trofeos",
  trofeos: "Trofeos",
  trophy: "Trofeos",
  maqueta: "Maquetas",
  maquetas: "Maquetas",
  maquetacion: "Maquetas",
  llavero: "Llaveros",
  llaveros: "Llaveros",
  keychain: "Llaveros",
  "letra corporea": "Letras Corporeas",
  "letras corporeas": "Letras Corporeas",
  "letras corpóreas": "Letras Corporeas",
  "letra corpórea": "Letras Corporeas",
  letras: "Letras Corporeas",
};

/**
 * Detect project type tag from a lead message by matching against
 * active project template names and hardcoded aliases.
 * Returns the first match or null.
 */
export async function detectProjectTypeTag(
  message: string | null
): Promise<string | null> {
  if (!message?.trim()) return null;

  const lower = message.toLowerCase();
  const supabase = createServiceClient();

  // Fetch active project template names
  const { data: templates } = await supabase
    .from("project_templates")
    .select("name")
    .eq("is_active", true);

  // Check template names (case-insensitive)
  if (templates) {
    for (const t of templates) {
      if (lower.includes(t.name.toLowerCase())) {
        return t.name;
      }
    }
  }

  // Check aliases
  for (const [alias, templateName] of Object.entries(ALIASES)) {
    if (lower.includes(alias)) {
      return templateName;
    }
  }

  return null;
}
