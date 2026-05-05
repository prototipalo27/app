"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { sendEmailOrSchedule } from "@/lib/email";
import { getUserEmailSender } from "@/lib/email-sender";
import type { AgreementLanguage } from "@/lib/studio-dev-agreement-text";

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = (v as string | null)?.trim();
  return s ? s : null;
}

// `studio_dev_agreements` y las columnas `dev_agreement_*` aún no están en
// database.types.ts. Casteamos puntualmente el cliente a `any` para esquivar
// las firmas generadas; tipamos a mano los resultados que consumimos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseSupabase = any;

interface StudioProjectRow {
  name: string;
  client_name: string | null;
  client_email: string | null;
  nda_project_description: string | null;
  dev_agreement_workspace_fee: number | string;
  dev_agreement_engineering_hours: number;
  dev_agreement_engineering_rate: number | string;
  dev_agreement_printing_hours: number;
  dev_agreement_printing_rate: number | string;
  dev_agreement_minimum_months: number;
  dev_agreement_approval_threshold: number | string;
}

/**
 * Crea un Contrato de Desarrollo y Colaboración ligado al proyecto Studio
 * y envía por email un link público para firmarlo. Mismo patrón que el
 * NDA pero con tabla propia (`studio_dev_agreements`) y página de firma
 * (`/contract/[token]`).
 *
 * Requisitos para enviar:
 *   - Hay un NDA firmado para el mismo proyecto (Recital III lo referencia).
 *   - El proyecto tiene `nda_project_description` rellenada (Recital II la usa).
 *   - El cliente tiene email.
 */
export async function sendStudioDevAgreement(formData: FormData): Promise<void> {
  const studioProjectId = strOrNull(formData.get("studio_project_id"));
  const language = (strOrNull(formData.get("language")) || "en") as AgreementLanguage;
  if (!studioProjectId) throw new Error("Falta studio_project_id");
  if (language !== "es" && language !== "en") {
    throw new Error("Idioma no válido");
  }

  const profile = await requireRole("manager");
  const supabase: LooseSupabase = await createClient();

  const { data: rawProject } = await supabase
    .from("studio_projects")
    .select("*")
    .eq("id", studioProjectId)
    .single();

  const project = rawProject as StudioProjectRow | null;

  if (!project?.client_email) {
    throw new Error("El proyecto no tiene email de cliente");
  }

  if (!project.nda_project_description?.trim()) {
    throw new Error(
      "Rellena la descripción del proyecto en el Brief antes de enviar el contrato",
    );
  }

  // Required: NDA firmado en el mismo proyecto (Recital III).
  const { data: signedNda } = await supabase
    .from("nda_agreements")
    .select("id, signed_at")
    .eq("studio_project_id", studioProjectId)
    .eq("status", "signed")
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!signedNda?.signed_at) {
    throw new Error(
      "Necesitas un NDA firmado por el cliente antes de enviar el contrato de desarrollo",
    );
  }

  // Evitar duplicar contratos pendientes.
  const { data: existing } = await supabase
    .from("studio_dev_agreements")
    .select("id")
    .eq("studio_project_id", studioProjectId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    throw new Error("Ya hay un contrato pendiente de firma para este proyecto");
  }

  const { data: agreement, error: insertError } = await supabase
    .from("studio_dev_agreements")
    .insert({
      studio_project_id: studioProjectId,
      language,
      signer_email: project.client_email,
      sent_by: profile.id,
      workspace_fee: project.dev_agreement_workspace_fee,
      engineering_hours: project.dev_agreement_engineering_hours,
      engineering_rate: project.dev_agreement_engineering_rate,
      printing_hours: project.dev_agreement_printing_hours,
      printing_rate: project.dev_agreement_printing_rate,
      minimum_months: project.dev_agreement_minimum_months,
      approval_threshold: project.dev_agreement_approval_threshold,
      nda_reference_date: signedNda.signed_at.slice(0, 10),
    })
    .select("token")
    .single();

  if (insertError || !agreement) {
    console.error("[studio-dev-agreement] insert failed:", insertError);
    throw new Error("Error al crear el contrato");
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://app.prototipalo.es";
  const contractUrl = `${baseUrl}/contract/${agreement.token}`;

  const emailSender = await getUserEmailSender(profile.id);
  if (!emailSender) {
    await supabase.from("studio_dev_agreements").delete().eq("token", agreement.token);
    throw new Error(
      "No tienes método de envío configurado. Ve a Ajustes → Email para conectar tu cuenta de Google.",
    );
  }

  const greetingName = project.client_name?.split(" ")[0] || "";

  const subject = language === "es"
    ? `Contrato de desarrollo — ${project.name}`
    : `Development Agreement — ${project.name}`;

  const text = language === "es"
    ? `Hola ${greetingName},\n\nAdjunto te enviamos el contrato de desarrollo y colaboración para el proyecto ${project.name}. Revisa los términos, rellena tus datos y firma online en el siguiente enlace:\n${contractUrl}\n\nGracias,\nEl equipo de Prototipalo Studio`
    : `Hello ${greetingName},\n\nAttached is the development and collaboration agreement for the ${project.name} project. Review the terms, fill in your details and sign online at the following link:\n${contractUrl}\n\nThanks,\nThe Prototipalo Studio team`;

  const ctaLabel = language === "es" ? "Revisar y firmar el contrato" : "Review and sign the contract";
  const intro = language === "es"
    ? `Adjunto te enviamos el contrato de desarrollo y colaboración para <strong>${project.name}</strong>. Revisa los términos, rellena tus datos y firma online:`
    : `Attached is the development and collaboration agreement for <strong>${project.name}</strong>. Review the terms, fill in your details and sign online:`;
  const note = language === "es"
    ? "Podrás leer el contrato completo antes de firmar."
    : "You'll be able to read the full contract before signing.";

  const html = `
    <p>${language === "es" ? "Hola" : "Hello"} ${greetingName},</p>
    <p>${intro}</p>
    <p>
      <a href="${contractUrl}" style="display:inline-block;padding:12px 24px;background:#18181b;color:white;border-radius:8px;text-decoration:none;font-weight:500;">
        ${ctaLabel}
      </a>
    </p>
    <p style="font-size:13px;color:#71717a;margin-top:16px;">${note}</p>
  `;

  try {
    await sendEmailOrSchedule(
      {
        to: project.client_email,
        subject,
        text,
        html,
        emailSender,
        entityType: "studio_project",
        entityId: studioProjectId,
      },
      { createdBy: profile.id },
    );
  } catch (e) {
    console.error("[studio-dev-agreement] email failed:", e);
    await supabase.from("studio_dev_agreements").delete().eq("token", agreement.token);
    throw new Error("Error al enviar el email");
  }

  revalidatePath(`/dashboard/studio/${studioProjectId}`);
}

export async function getStudioDevAgreementStatus(
  studioProjectId: string,
): Promise<{
  status: "none" | "pending" | "signed";
  id?: string;
  token?: string;
  language?: AgreementLanguage;
  signed_at?: string;
  signer_name?: string;
  signer_email?: string;
}> {
  const supabase: LooseSupabase = await createClient();

  const { data: agreement } = await supabase
    .from("studio_dev_agreements")
    .select("id, status, token, language, signed_at, signer_name, signer_email")
    .eq("studio_project_id", studioProjectId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!agreement) return { status: "none" };
  return {
    status: agreement.status as "pending" | "signed",
    id: agreement.id,
    token: agreement.token,
    language: agreement.language as AgreementLanguage,
    signed_at: agreement.signed_at || undefined,
    signer_name: agreement.signer_name || undefined,
    signer_email: agreement.signer_email || undefined,
  };
}

/**
 * Cancela un contrato pendiente (no firmado). Útil si el manager se equivocó
 * de idioma, de términos económicos o quiere reenviar con datos distintos.
 */
export async function cancelStudioDevAgreement(formData: FormData): Promise<void> {
  const studioProjectId = strOrNull(formData.get("studio_project_id"));
  const agreementId = strOrNull(formData.get("agreement_id"));
  if (!studioProjectId || !agreementId) throw new Error("Falta proyecto o id");

  await requireRole("manager");
  const supabase: LooseSupabase = await createClient();

  const { error } = await supabase
    .from("studio_dev_agreements")
    .delete()
    .eq("id", agreementId)
    .eq("studio_project_id", studioProjectId)
    .eq("status", "pending");

  if (error) {
    console.error("[studio-dev-agreement] cancel failed:", error);
    throw new Error("Error al cancelar");
  }

  revalidatePath(`/dashboard/studio/${studioProjectId}`);
}

/**
 * Actualiza los términos económicos editables del proyecto Studio.
 * Solo afecta a futuros contratos enviados — los ya emitidos guardan su
 * propio snapshot.
 */
export async function updateStudioCommercialTerms(formData: FormData): Promise<void> {
  const studioProjectId = strOrNull(formData.get("studio_project_id"));
  if (!studioProjectId) throw new Error("Falta studio_project_id");

  await requireRole("manager");
  const supabase: LooseSupabase = await createClient();

  const num = (key: string): number | null => {
    const raw = strOrNull(formData.get(key));
    if (raw === null) return null;
    const parsed = Number(raw.replace(",", "."));
    if (Number.isNaN(parsed) || parsed < 0) {
      throw new Error(`Valor inválido para ${key}`);
    }
    return parsed;
  };

  const updates: Record<string, number> = {};
  const fee = num("workspace_fee");
  if (fee !== null) updates.dev_agreement_workspace_fee = fee;
  const engHours = num("engineering_hours");
  if (engHours !== null) updates.dev_agreement_engineering_hours = Math.round(engHours);
  const engRate = num("engineering_rate");
  if (engRate !== null) updates.dev_agreement_engineering_rate = engRate;
  const printHours = num("printing_hours");
  if (printHours !== null) updates.dev_agreement_printing_hours = Math.round(printHours);
  const printRate = num("printing_rate");
  if (printRate !== null) updates.dev_agreement_printing_rate = printRate;
  const minMonths = num("minimum_months");
  if (minMonths !== null) updates.dev_agreement_minimum_months = Math.round(minMonths);
  const threshold = num("approval_threshold");
  if (threshold !== null) updates.dev_agreement_approval_threshold = threshold;

  if (Object.keys(updates).length === 0) return;

  const { error } = await supabase
    .from("studio_projects")
    .update(updates)
    .eq("id", studioProjectId);

  if (error) {
    console.error("[studio-dev-agreement] update terms failed:", error);
    throw new Error("Error al actualizar los términos");
  }

  revalidatePath(`/dashboard/studio/${studioProjectId}`);
}
