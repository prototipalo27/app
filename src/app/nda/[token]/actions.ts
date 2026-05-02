"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { generateNdaPdf } from "@/lib/nda-pdf";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

interface SignNdaData {
  signer_name: string;
  signer_company: string;
  signer_nif: string;
  signer_address: string;
  signer_email: string;
  signature_data: string; // base64 PNG
}

export async function signNda(
  token: string,
  data: SignNdaData,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  // 1. Validate token exists and is pending
  const { data: nda, error: ndaError } = await supabase
    .from("nda_agreements")
    .select("*, leads(full_name, company)")
    .eq("token", token)
    .eq("status", "pending")
    .single();

  if (ndaError || !nda) {
    return { success: false, error: "Enlace no válido o ya firmado" };
  }

  // 2. Get IP and user agent
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown";
  const userAgent = headersList.get("user-agent") || "unknown";

  // 3. Update NDA with signer data
  const { error: updateError } = await supabase
    .from("nda_agreements")
    .update({
      status: "signed",
      signer_name: data.signer_name.trim(),
      signer_company: data.signer_company.trim(),
      signer_nif: data.signer_nif.trim(),
      signer_address: data.signer_address.trim(),
      signer_email: data.signer_email.trim(),
      signature_data: data.signature_data,
      signed_at: new Date().toISOString(),
      signer_ip: ip,
      signer_user_agent: userAgent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", nda.id);

  if (updateError) {
    return { success: false, error: "Error al guardar la firma" };
  }

  // 4. Generate PDF and send copy by email
  try {
    const pdfBuffer = await generateNdaPdf({
      signerName: data.signer_name.trim(),
      signerCompany: data.signer_company.trim(),
      signerNif: data.signer_nif.trim(),
      signerAddress: data.signer_address.trim(),
      signatureData: data.signature_data,
      signedAt: new Date(),
    });

    await sendEmail({
      to: data.signer_email.trim(),
      subject: "Acuerdo de confidencialidad firmado — Prototipalo",
      signature: false,
      text: `Hola ${data.signer_name.trim()},\n\nAdjuntamos una copia del acuerdo de confidencialidad que acabas de firmar.\n\nGracias por tu confianza.\n\nPrototipalo\nViriato 27 · 28010 Madrid\nprototipalo.com`,
      html: `
        <p>Hola ${data.signer_name.trim()},</p>
        <p>Adjuntamos una copia del acuerdo de confidencialidad que acabas de firmar.</p>
        <p>Gracias por tu confianza.</p>
        <br>
        <table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#333333;line-height:1.6;">
          <tr><td style="padding-bottom:10px;"><strong style="font-size:12px;color:#1a1a1a;">Prototipalo</strong></td></tr>
          <tr><td style="padding-bottom:2px;">Viriato 27 &bull; 28010 Madrid</td></tr>
          <tr><td style="padding-bottom:11px;"><a href="https://prototipalo.com" style="color:#2563eb;text-decoration:underline;">Prototipalo.com</a></td></tr>
          <tr><td style="padding-top:11px;"><a href="https://prototipalo.com" style="text-decoration:none;"><img src="https://rqqwvgdmbmgdbegpcvmz.supabase.co/storage/v1/object/public/assets/logo-email.png" alt="prototipalo — better in 3d" width="224" height="auto" style="display:block;" /></a></td></tr>
        </table>
      `,
      attachments: [
        {
          filename: "NDA-Prototipalo.pdf",
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });
  } catch (e) {
    // Email/PDF failure should not block the signing — but make it visible.
    console.error("[signNda] PDF/email step failed:", e);
  }

  // 5. Log activity on lead (solo si el NDA pertenece a un lead, no a Studio).
  if (nda.lead_id) {
    try {
      await supabase.from("lead_activities").insert({
        lead_id: nda.lead_id,
        activity_type: "note",
        content: `NDA firmado por ${data.signer_name.trim()} (${data.signer_nif.trim()})`,
        metadata: {
          type: "nda_signed",
          signer_name: data.signer_name.trim(),
          signer_nif: data.signer_nif.trim(),
          signer_email: data.signer_email.trim(),
        },
      });
    } catch {
      // Activity log failure should not block
    }
  }

  // 6. Revalidar la pantalla del owner (lead o studio) para que refleje
  //    el estado "firmado" sin tener que recargar a mano.
  if (nda.lead_id) {
    revalidatePath(`/dashboard/crm/${nda.lead_id}`);
  } else if (nda.studio_project_id) {
    revalidatePath(`/dashboard/studio/${nda.studio_project_id}`);
  }

  return { success: true };
}
