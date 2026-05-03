"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { sendEmailOrSchedule } from "@/lib/email";
import { getUserEmailSender } from "@/lib/email-sender";

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = (v as string | null)?.trim();
  return s ? s : null;
}

/**
 * Crea un acuerdo de confidencialidad ligado al proyecto Studio y envía
 * por email un link público para firmarlo. Mismo flujo que el NDA de
 * leads (`sendNdaToClient`) — comparte tabla `nda_agreements`, página
 * `/nda/[token]` y action `signNda`. Solo cambia el contexto del que
 * cuelga (studio_project en vez de lead).
 */
export async function sendStudioNdaToClient(formData: FormData): Promise<void> {
  const studioProjectId = strOrNull(formData.get("studio_project_id"));
  if (!studioProjectId) throw new Error("Falta studio_project_id");

  const profile = await requireRole("manager");
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("studio_projects")
    .select("name, client_name, client_email, nda_project_description")
    .eq("id", studioProjectId)
    .single();

  if (!project?.client_email) {
    throw new Error("El proyecto no tiene email de cliente");
  }

  // Sin descripción específica, el NDA cae al genérico "the products,
  // services and intellectual property developed under this collaboration".
  // Forzamos a rellenarlo para evitar que un proyecto mande un NDA con
  // descripción de otro proyecto o totalmente genérica.
  if (!project.nda_project_description?.trim()) {
    throw new Error(
      "Rellena la descripción del proyecto para el NDA en el Brief antes de enviarlo",
    );
  }

  // Evitar duplicar NDAs pendientes para el mismo proyecto.
  const { data: existing } = await supabase
    .from("nda_agreements")
    .select("id")
    .eq("studio_project_id", studioProjectId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    throw new Error("Ya hay un NDA pendiente de firma para este proyecto");
  }

  const { data: nda, error: insertError } = await supabase
    .from("nda_agreements")
    .insert({
      studio_project_id: studioProjectId,
      signer_email: project.client_email,
      sent_by: profile.id,
    })
    .select("token")
    .single();

  if (insertError || !nda) {
    console.error("[studio-nda] insert failed:", insertError);
    throw new Error("Error al crear el NDA");
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://app.prototipalo.es";
  const ndaUrl = `${baseUrl}/nda/${nda.token}`;

  const emailSender = await getUserEmailSender(profile.id);
  if (!emailSender) {
    await supabase.from("nda_agreements").delete().eq("token", nda.token);
    throw new Error(
      "No tienes método de envío configurado. Ve a Ajustes → Email para conectar tu cuenta de Google.",
    );
  }

  const greetingName = project.client_name?.split(" ")[0] || "";

  try {
    await sendEmailOrSchedule(
      {
        to: project.client_email,
        subject: `Mutual NDA — ${project.name}`,
        text: `Hello ${greetingName},\n\nBefore we kick off work on ${project.name}, we need to formalize a mutual non-disclosure agreement to protect any information either party shares.\n\nIt only takes a couple of minutes — just review the agreement, fill in your details and sign:\n${ndaUrl}\n\nThanks,\nThe Prototipalo Studio team`,
        html: `
          <p>Hello ${greetingName},</p>
          <p>Before we kick off work on <strong>${project.name}</strong>, we need to formalize a mutual non-disclosure agreement to protect any information either party shares.</p>
          <p>It only takes a couple of minutes — just review the agreement, fill in your details and sign:</p>
          <p>
            <a href="${ndaUrl}" style="display:inline-block;padding:12px 24px;background:#18181b;color:white;border-radius:8px;text-decoration:none;font-weight:500;">
              Review and sign the NDA
            </a>
          </p>
          <p style="font-size:13px;color:#71717a;margin-top:16px;">You'll be able to read the full agreement before signing.</p>
        `,
        emailSender,
        entityType: "studio_project",
        entityId: studioProjectId,
      },
      { createdBy: profile.id },
    );
  } catch (e) {
    console.error("[studio-nda] email failed:", e);
    await supabase.from("nda_agreements").delete().eq("token", nda.token);
    throw new Error("Error al enviar el email");
  }

  revalidatePath(`/dashboard/studio/${studioProjectId}`);
}

export async function getStudioNdaStatus(
  studioProjectId: string,
): Promise<{
  status: "none" | "pending" | "signed";
  id?: string;
  token?: string;
  signed_at?: string;
  signer_name?: string;
  signer_email?: string;
}> {
  const supabase = await createClient();

  const { data: nda } = await supabase
    .from("nda_agreements")
    .select("id, status, token, signed_at, signer_name, signer_email")
    .eq("studio_project_id", studioProjectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!nda) return { status: "none" };
  return {
    status: nda.status as "pending" | "signed",
    id: nda.id,
    token: nda.token,
    signed_at: nda.signed_at || undefined,
    signer_name: nda.signer_name || undefined,
    signer_email: nda.signer_email || undefined,
  };
}

/**
 * Sugiere una descripción para el Recital I del NDA usando Claude.
 * El frasaje resultante encaja después de "Prototipalo ... is developing"
 * (ej. `a wearable monitoring device for horses`).
 */
export async function suggestStudioNdaDescription(
  studioProjectId: string,
): Promise<{ suggestion: string } | { error: string }> {
  if (!studioProjectId) return { error: "Falta proyecto" };

  await requireRole("manager");
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "ANTHROPIC_API_KEY no configurada" };

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("studio_projects")
    .select(
      "name, client_name, brief_description, brief_objectives, brief_constraints, nda_project_description",
    )
    .eq("id", studioProjectId)
    .single();

  if (!project) return { error: "Proyecto no encontrado" };

  const context = [
    `Project name: ${project.name}`,
    project.client_name ? `Client: ${project.client_name}` : null,
    project.brief_description ? `Brief: ${project.brief_description}` : null,
    project.brief_objectives ? `Objectives: ${project.brief_objectives}` : null,
    project.brief_constraints ? `Constraints: ${project.brief_constraints}` : null,
    project.nda_project_description
      ? `Current NDA description: ${project.nda_project_description}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `You are drafting the project description used in Recital I of a mutual NDA between Prototipalo (a custom hardware/electronics prototyping workshop) and a client.

The sentence in the NDA reads:
"Prototipalo is engaged in the design, prototyping and manufacture of custom hardware and electronics, and is developing <DESCRIPTION> (the 'Project')."

Write the <DESCRIPTION> only. It must:
- Be in English.
- Start with an article ("a"/"an") or determiner so it grammatically follows "is developing".
- Be 1 sentence, max ~30 words.
- Describe what the Project is, at a level high enough to protect confidentiality but specific enough that a third party reading it would know which project this is about.
- NOT repeat "Prototipalo is developing".
- NOT add quotes, commentary, or alternatives — return only the description.

Project context:
${context}`,
        },
      ],
    });

    const block = response.content[0];
    const text = block?.type === "text" ? block.text.trim() : "";
    if (!text) return { error: "Respuesta vacía del modelo" };

    // El modelo a veces devuelve la frase entre comillas o con punto final
    // suelto: lo limpiamos para que se pueda pegar directo en el campo.
    const cleaned = text
      .replace(/^["“”']+|["“”']+$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    return { suggestion: cleaned };
  } catch (e) {
    console.error("[studio-nda] suggest failed:", e);
    return { error: e instanceof Error ? e.message : "Error desconocido" };
  }
}

/**
 * Cancela un NDA pendiente (no firmado). Útil si te equivocaste de email
 * o quieres reenviar con datos distintos.
 */
export async function cancelStudioNda(formData: FormData): Promise<void> {
  const studioProjectId = strOrNull(formData.get("studio_project_id"));
  const ndaId = strOrNull(formData.get("nda_id"));
  if (!studioProjectId || !ndaId) throw new Error("Falta proyecto o id");

  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("nda_agreements")
    .delete()
    .eq("id", ndaId)
    .eq("studio_project_id", studioProjectId)
    .eq("status", "pending");

  if (error) {
    console.error("[studio-nda] cancel failed:", error);
    throw new Error("Error al cancelar");
  }

  revalidatePath(`/dashboard/studio/${studioProjectId}`);
}
