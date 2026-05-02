"use server";

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
    .select("name, client_name, client_email")
    .eq("id", studioProjectId)
    .single();

  if (!project?.client_email) {
    throw new Error("El proyecto no tiene email de cliente");
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
        subject: `Acuerdo de confidencialidad — ${project.name}`,
        text: `Hola ${greetingName},\n\nAntes de empezar a trabajar en ${project.name} necesitamos formalizar un acuerdo de confidencialidad para proteger toda la información que compartas con nosotros.\n\nEs un proceso rápido — solo tienes que rellenar tus datos y firmar:\n${ndaUrl}\n\nGracias,\nEl equipo de Prototipalo Studio`,
        html: `
          <p>Hola ${greetingName},</p>
          <p>Antes de empezar a trabajar en <strong>${project.name}</strong> necesitamos formalizar un acuerdo de confidencialidad para proteger toda la información que compartas con nosotros.</p>
          <p>Es un proceso rápido — solo tienes que rellenar tus datos y firmar:</p>
          <p>
            <a href="${ndaUrl}" style="display:inline-block;padding:12px 24px;background:#18181b;color:white;border-radius:8px;text-decoration:none;font-weight:500;">
              Firmar acuerdo de confidencialidad
            </a>
          </p>
          <p style="font-size:13px;color:#71717a;margin-top:16px;">Tu información estará protegida en todo momento.</p>
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
