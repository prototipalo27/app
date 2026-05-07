"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { sendEmailOrSchedule } from "@/lib/email";
import { getUserEmailSender } from "@/lib/email-sender";
import { createContact, createProforma, getDocument, getDocumentPdf } from "@/lib/holded/api";

const COUNTRY_CODE_MAP: Record<string, string> = {
  españa: "ES",
  spain: "ES",
  francia: "FR",
  france: "FR",
  alemania: "DE",
  germany: "DE",
  suiza: "CH",
  switzerland: "CH",
  italia: "IT",
  italy: "IT",
  portugal: "PT",
  uk: "GB",
  "united kingdom": "GB",
  "estados unidos": "US",
  usa: "US",
};

function inferCountryCode(country: string | null | undefined): string | undefined {
  if (!country) return undefined;
  const c = country.trim().toLowerCase();
  if (COUNTRY_CODE_MAP[c]) return COUNTRY_CODE_MAP[c];
  if (c.length === 2) return c.toUpperCase();
  return undefined;
}

interface ParsedAddress {
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}

/**
 * Parse a one-line address from a signed contract into Holded's structured fields.
 * Tolerates extra whitespace and variable comma placement.
 *   "Via Ressiga 7, 6514, Sementina, Switzerland"
 *   → { address: "Via Ressiga 7", postalCode: "6514", city: "Sementina", country: "Switzerland" }
 *
 * Heuristic: postal code = first part that's mostly digits (with optional letters
 * for UK/CA codes). Anything before it is the street; anything after is city + country.
 */
function parseSignerAddress(raw: string | null | undefined): ParsedAddress {
  if (!raw) return {};
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { address: parts[0] };

  const isPostalCode = (s: string) => /^[\dA-Z\s-]{3,10}$/i.test(s) && /\d/.test(s);
  const postalIdx = parts.findIndex(isPostalCode);

  if (postalIdx === -1) {
    // No postal code detected: assume [street, city, country] or [street, country]
    return {
      address: parts[0],
      city: parts.length >= 3 ? parts[1] : undefined,
      country: parts[parts.length - 1],
    };
  }

  return {
    address: parts.slice(0, postalIdx).join(", ") || undefined,
    postalCode: parts[postalIdx],
    city: parts[postalIdx + 1],
    country: parts.slice(postalIdx + 2).join(", ") || undefined,
  };
}

interface ProjectBillingData {
  name: string;
  taxId?: string;
  email?: string;
  address: ParsedAddress;
  countryCode?: string;
  source: "nda" | "dev_agreement";
}

/**
 * Pull billing data for a studio project from the most recent signed contract.
 * NDA wins over dev_agreement because it is signed first in the operational flow.
 */
async function getProjectBillingFromContracts(
  projectId: string,
): Promise<ProjectBillingData | null> {
  const supabase = await createClient();

  const [{ data: nda }, { data: devAgreement }] = await Promise.all([
    supabase
      .from("nda_agreements")
      .select("signer_name, signer_company, signer_nif, signer_address, signer_email, signed_at")
      .eq("studio_project_id", projectId)
      .not("signed_at", "is", null)
      .order("signed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("studio_dev_agreements")
      .select("signer_name, signer_company, signer_nif, signer_address, signer_email, signed_at")
      .eq("studio_project_id", projectId)
      .not("signed_at", "is", null)
      .order("signed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const source = nda ? ("nda" as const) : devAgreement ? ("dev_agreement" as const) : null;
  const row = nda || devAgreement;
  if (!source || !row) return null;

  const billingName = row.signer_company?.trim() || row.signer_name?.trim();
  if (!billingName) return null;

  const address = parseSignerAddress(row.signer_address);
  const countryCode = inferCountryCode(address.country);

  return {
    name: billingName,
    taxId: row.signer_nif?.trim() || undefined,
    email: row.signer_email?.trim() || undefined,
    address,
    countryCode,
    source,
  };
}

async function ensureHoldedContact(
  projectId: string,
): Promise<{ contactId: string | null; error?: string }> {
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("studio_projects")
    .select("id, holded_contact_id, client_email, client_name")
    .eq("id", projectId)
    .single();
  if (!project) return { contactId: null, error: "Proyecto no encontrado" };
  if (project.holded_contact_id) return { contactId: project.holded_contact_id };

  const billing = await getProjectBillingFromContracts(projectId);
  if (!billing) {
    return {
      contactId: null,
      error:
        "Faltan datos de facturación. Pide al cliente que firme la NDA o el Dev Agreement antes de generar la proforma.",
    };
  }

  const created = await createContact({
    name: billing.name,
    code: billing.taxId,
    email: billing.email || project.client_email?.trim() || undefined,
    billAddress: {
      address: billing.address.address,
      city: billing.address.city,
      postalCode: billing.address.postalCode,
      country: billing.address.country,
      countryCode: billing.countryCode,
    },
  });

  await supabase
    .from("studio_projects")
    .update({ holded_contact_id: created.id })
    .eq("id", projectId);

  return { contactId: created.id };
}

export async function createStudioPaymentProforma(
  paymentId: string,
): Promise<{ success: boolean; error?: string; proformaId?: string; docNumber?: string | null }> {
  await requireRole("manager");
  const supabase = await createClient();

  const { data: payment } = await supabase
    .from("studio_payments")
    .select("id, label, amount, studio_project_id, holded_proforma_id")
    .eq("id", paymentId)
    .single();
  if (!payment) return { success: false, error: "Hito no encontrado" };

  if (payment.holded_proforma_id) {
    return { success: false, error: "Este hito ya tiene una proforma generada" };
  }

  const { data: project } = await supabase
    .from("studio_projects")
    .select("id, name, tax_rate")
    .eq("id", payment.studio_project_id)
    .single();
  if (!project) return { success: false, error: "Proyecto no encontrado" };

  const { contactId, error: contactError } = await ensureHoldedContact(project.id);
  if (!contactId) {
    return { success: false, error: contactError || "No se pudo resolver el contacto Holded" };
  }

  const taxRate = Number(project.tax_rate ?? 21);
  const amount = Number(payment.amount);

  try {
    const proforma = await createProforma(contactId, {
      items: [{ name: payment.label, units: 1, subtotal: amount, tax: taxRate }],
      notes: project.name,
    });

    let docNumber: string | null = null;
    try {
      const doc = await getDocument("proform", proforma.id);
      docNumber = doc.docNumber || null;
    } catch (e) {
      console.error("[createStudioPaymentProforma] failed to fetch docNumber:", e);
    }

    await supabase
      .from("studio_payments")
      .update({
        holded_proforma_id: proforma.id,
        holded_proforma_doc_number: docNumber,
        status: "facturado",
      })
      .eq("id", payment.id);

    revalidatePath(`/dashboard/studio/${project.id}`);
    return { success: true, proformaId: proforma.id, docNumber };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Error al crear la proforma",
    };
  }
}

export async function sendStudioPaymentProforma(
  paymentId: string,
): Promise<{ success: boolean; error?: string }> {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  const { data: payment } = await supabase
    .from("studio_payments")
    .select(
      "id, label, amount, studio_project_id, tracking_token, holded_proforma_id, holded_proforma_doc_number",
    )
    .eq("id", paymentId)
    .single();
  if (!payment) return { success: false, error: "Hito no encontrado" };

  if (!payment.holded_proforma_id) {
    return { success: false, error: "Genera la proforma antes de enviarla" };
  }

  const { data: project } = await supabase
    .from("studio_projects")
    .select("id, name, client_email, client_name, tax_rate")
    .eq("id", payment.studio_project_id)
    .single();
  if (!project) return { success: false, error: "Proyecto no encontrado" };

  // Email destino: el del contrato firmado si existe, si no el del proyecto.
  const billing = await getProjectBillingFromContracts(project.id);
  const recipientEmail = billing?.email || project.client_email;
  const recipientName = billing?.name || project.client_name || "";
  if (!recipientEmail) {
    return { success: false, error: "No hay email de cliente (ni en contrato ni en proyecto)" };
  }

  const emailSender = await getUserEmailSender(profile.id);
  if (!emailSender) {
    return {
      success: false,
      error: "No tienes método de envío configurado. Ve a Ajustes → Email.",
    };
  }

  let pdfBuffer: Buffer | null = null;
  let docNumber = payment.holded_proforma_doc_number || "";
  try {
    const [pdf, doc] = await Promise.all([
      getDocumentPdf("proform", payment.holded_proforma_id),
      getDocument("proform", payment.holded_proforma_id),
    ]);
    pdfBuffer = pdf;
    if (!docNumber && doc.docNumber) {
      docNumber = doc.docNumber;
      await supabase
        .from("studio_payments")
        .update({ holded_proforma_doc_number: docNumber })
        .eq("id", payment.id);
    }
  } catch (err) {
    console.error("[sendStudioPaymentProforma] PDF/doc fetch failed:", err);
    return { success: false, error: "Error al descargar la proforma de Holded" };
  }

  const proformaRef = docNumber ? ` ${docNumber}` : "";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://app.prototipalo.es";
  const proformaUrl = `${baseUrl}/proforma/${payment.tracking_token}`;
  const taxRate = Number(project.tax_rate ?? 21);
  const amount = Number(payment.amount);
  const total = taxRate > 0 ? amount * (1 + taxRate / 100) : amount;
  const formattedTotal = total.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const conceptoLine = docNumber ? `${docNumber} – Prototipalo` : "Prototipalo – Studio";

  try {
    await sendEmailOrSchedule(
      {
        to: recipientEmail,
        subject: `Proforma${proformaRef} — ${project.name} — Prototipalo`,
        text: `Hola ${recipientName},\n\nTe adjuntamos la proforma${proformaRef} (${payment.label}) por importe de ${formattedTotal} €.\n\nPuedes pagarla online en este enlace:\n${proformaUrl}\n\nO por transferencia bancaria:\nBanco: BBVA\nTitular: Prototipalo\nIBAN: ES24 0182 4010 3502 0181 5556\nSWIFT/BIC: BBVAESMM\nConcepto: ${conceptoLine}\n\nGracias.`,
        html: `
          <p>Hola ${recipientName},</p>
          <p>Te adjuntamos la proforma${proformaRef} (<strong>${payment.label}</strong>) por importe de <strong>${formattedTotal} €</strong>.</p>
          <p>Puedes pagarla online:</p>
          <p style="margin:20px 0;">
            <a href="${proformaUrl}" style="display:inline-block;padding:14px 28px;background:#e9473f;color:white;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
              Revisar y pagar
            </a>
          </p>
          <p>O por <strong>transferencia bancaria</strong>:</p>
          <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:12px 0 20px;font-size:14px;line-height:1.8;">
            <tr><td style="padding:0 16px 0 0;color:#71717a;white-space:nowrap;">Banco</td><td style="padding:0;font-weight:600;">BBVA</td></tr>
            <tr><td style="padding:0 16px 0 0;color:#71717a;white-space:nowrap;">Titular</td><td style="padding:0;font-weight:600;">Prototipalo</td></tr>
            <tr><td style="padding:0 16px 0 0;color:#71717a;white-space:nowrap;">IBAN</td><td style="padding:0;font-weight:600;">ES24 0182 4010 3502 0181 5556</td></tr>
            <tr><td style="padding:0 16px 0 0;color:#71717a;white-space:nowrap;">SWIFT/BIC</td><td style="padding:0;font-weight:600;">BBVAESMM</td></tr>
            <tr><td style="padding:0 16px 0 0;color:#71717a;white-space:nowrap;">Concepto</td><td style="padding:0;font-weight:600;">${conceptoLine}</td></tr>
          </table>
          <p>Gracias.</p>
        `,
        emailSender,
        attachments:
          pdfBuffer && pdfBuffer.length > 0
            ? [
                {
                  filename: `Proforma${proformaRef.replace(/\s/g, "-")}-Prototipalo.pdf`,
                  content: pdfBuffer,
                  contentType: "application/pdf",
                },
              ]
            : undefined,
        entityType: "studio_payment",
        entityId: payment.id,
      },
      { createdBy: profile.id },
    );
  } catch {
    return { success: false, error: "Error al enviar el email" };
  }

  await supabase
    .from("studio_payments")
    .update({ proforma_sent_at: new Date().toISOString() })
    .eq("id", payment.id);

  revalidatePath(`/dashboard/studio/${project.id}`);
  return { success: true };
}

export async function duplicateStudioPaymentNextMonth(formData: FormData) {
  await requireRole("manager");
  const supabase = await createClient();

  const id = formData.get("id") as string;
  if (!id) throw new Error("Missing id");

  const { data: source } = await supabase
    .from("studio_payments")
    .select("studio_project_id, label, amount, currency, due_date, position")
    .eq("id", id)
    .single();
  if (!source) throw new Error("Hito no encontrado");

  const sourceDate = source.due_date ? new Date(source.due_date) : new Date();
  const nextDate = new Date(sourceDate);
  nextDate.setMonth(nextDate.getMonth() + 1);
  const dueDateStr = nextDate.toISOString().slice(0, 10);

  const monthNames = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  const newMonth = monthNames[nextDate.getMonth()];
  const newYear = nextDate.getFullYear();
  const monthRegex = new RegExp(`(${monthNames.join("|")})\\s*\\d{4}`, "i");
  const newLabel = monthRegex.test(source.label)
    ? source.label.replace(monthRegex, `${newMonth} ${newYear}`)
    : `${source.label} (${newMonth} ${newYear})`;

  await supabase.from("studio_payments").insert({
    studio_project_id: source.studio_project_id,
    label: newLabel,
    amount: source.amount,
    currency: source.currency,
    due_date: dueDateStr,
    position: source.position + 1,
  });

  revalidatePath(`/dashboard/studio/${source.studio_project_id}`);
}
