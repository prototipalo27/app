"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { generateDevAgreementPdf } from "@/lib/studio-dev-agreement-pdf";
import { getPrototipaloSignature } from "@/lib/prototipalo-signature";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { AgreementLanguage } from "@/lib/studio-dev-agreement-text";

interface SignContractData {
  signer_name: string;
  signer_company: string;
  signer_nif: string;
  signer_address: string;
  signer_email: string;
  signer_position: string;
  signature_data: string;
}

// `studio_dev_agreements` aún no está en database.types.ts.
interface DevAgreementRow {
  id: string;
  studio_project_id: string | null;
  language: AgreementLanguage;
  workspace_fee: number | string;
  engineering_hours: number;
  engineering_rate: number | string;
  printing_hours: number;
  printing_rate: number | string;
  minimum_months: number;
  approval_threshold: number | string;
  nda_reference_date: string | null;
  studio_projects: {
    name: string;
    nda_project_description: string | null;
  } | null;
}

// Cast helper so the supabase chain works without studio_dev_agreements types.
// Tipamos el método `from` como una función que devuelve `any`, que permite
// cualquier encadenamiento de query builders. El resto del fichero sigue
// chequeado porque casteamos el resultado a `DevAgreementRow`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseSupabase = { from: (table: string) => any };

export async function signContract(
  token: string,
  data: SignContractData,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient() as unknown as LooseSupabase;

  // 1. Validate token + load snapshot.
  const { data: rawAgreement, error: loadErr } = await supabase
    .from("studio_dev_agreements")
    .select("*, studio_projects(name, nda_project_description)")
    .eq("token", token)
    .eq("status", "pending")
    .single();

  if (loadErr || !rawAgreement) {
    return { success: false, error: "Enlace no válido o ya firmado" };
  }
  const agreement = rawAgreement as DevAgreementRow;

  // 2. IP + user agent.
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown";
  const userAgent = headersList.get("user-agent") || "unknown";

  // 3. Persist signature.
  const { error: updateErr } = await supabase
    .from("studio_dev_agreements")
    .update({
      status: "signed",
      signer_name: data.signer_name.trim(),
      signer_company: data.signer_company.trim(),
      signer_nif: data.signer_nif.trim(),
      signer_address: data.signer_address.trim(),
      signer_email: data.signer_email.trim(),
      signer_position: data.signer_position.trim(),
      signature_data: data.signature_data,
      signed_at: new Date().toISOString(),
      signer_ip: ip,
      signer_user_agent: userAgent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", agreement.id);

  if (updateErr) {
    return { success: false, error: "Error al guardar la firma" };
  }

  // 4. Generate PDF + email a copy.
  const project = agreement.studio_projects as {
    name: string;
    nda_project_description: string | null;
  } | null;
  const lang = agreement.language as AgreementLanguage;
  const companySignatureData = await getPrototipaloSignature();

  try {
    const pdfBuffer = await generateDevAgreementPdf({
      language: lang,
      terms: {
        workspaceFee: Number(agreement.workspace_fee),
        engineeringHours: agreement.engineering_hours,
        engineeringRate: Number(agreement.engineering_rate),
        printingHours: agreement.printing_hours,
        printingRate: Number(agreement.printing_rate),
        minimumMonths: agreement.minimum_months,
        approvalThreshold: Number(agreement.approval_threshold),
      },
      signerName: data.signer_name.trim(),
      signerCompany: data.signer_company.trim(),
      signerNif: data.signer_nif.trim(),
      signerAddress: data.signer_address.trim(),
      signerPosition: data.signer_position.trim(),
      signatureData: data.signature_data,
      signedAt: new Date(),
      ndaReferenceDate: agreement.nda_reference_date
        ? new Date(agreement.nda_reference_date)
        : null,
      projectDescription: project?.nda_project_description ?? null,
      companySignatureData,
    });

    const subject = lang === "es"
      ? "Contrato de desarrollo firmado — Prototipalo"
      : "Development Agreement signed — Prototipalo";
    const greetingName = data.signer_name.trim();
    const bodyText = lang === "es"
      ? `Hola ${greetingName},\n\nAdjuntamos una copia firmada del contrato de desarrollo y colaboración.\n\nGracias por tu confianza.\n\nPrototipalo\nViriato 27 · 28010 Madrid\nprototipalo.com`
      : `Hello ${greetingName},\n\nAttached you'll find a signed copy of the development and collaboration agreement.\n\nThank you,\nPrototipalo\nViriato 27 · 28010 Madrid\nprototipalo.com`;
    const bodyHtml = lang === "es"
      ? `
        <p>Hola ${greetingName},</p>
        <p>Adjuntamos una copia firmada del contrato de desarrollo y colaboración.</p>
        <p>Gracias por tu confianza.</p>
      `
      : `
        <p>Hello ${greetingName},</p>
        <p>Attached you'll find a signed copy of the development and collaboration agreement.</p>
        <p>Thank you.</p>
      `;

    await sendEmail({
      to: data.signer_email.trim(),
      subject,
      signature: false,
      text: bodyText,
      html: `
        ${bodyHtml}
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
          filename: lang === "es"
            ? "Contrato-Desarrollo-Prototipalo.pdf"
            : "Development-Agreement-Prototipalo.pdf",
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });
  } catch (e) {
    console.error("[signContract] PDF/email step failed:", e);
  }

  if (agreement.studio_project_id) {
    revalidatePath(`/dashboard/studio/${agreement.studio_project_id}`);
  }

  return { success: true };
}
