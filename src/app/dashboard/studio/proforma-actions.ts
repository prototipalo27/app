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

function inferCountryCode(country: string | null): string | undefined {
  if (!country) return undefined;
  const c = country.trim().toLowerCase();
  if (COUNTRY_CODE_MAP[c]) return COUNTRY_CODE_MAP[c];
  if (c.length === 2) return c.toUpperCase();
  return undefined;
}

async function ensureHoldedContact(projectId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("studio_projects")
    .select(
      "id, holded_contact_id, client_email, client_name, client_company_name, client_tax_id, client_address, client_city, client_postal_code, client_country, client_country_code",
    )
    .eq("id", projectId)
    .single();
  if (!project) return null;
  if (project.holded_contact_id) return project.holded_contact_id;

  const billingName = project.client_company_name?.trim() || project.client_name?.trim();
  if (!billingName) return null;

  const countryCode = project.client_country_code || inferCountryCode(project.client_country);

  const created = await createContact({
    name: billingName,
    code: project.client_tax_id?.trim() || undefined,
    email: project.client_email?.trim() || undefined,
    billAddress: {
      address: project.client_address?.trim() || undefined,
      city: project.client_city?.trim() || undefined,
      postalCode: project.client_postal_code?.trim() || undefined,
      country: project.client_country?.trim() || undefined,
      countryCode,
    },
  });

  await supabase
    .from("studio_projects")
    .update({ holded_contact_id: created.id })
    .eq("id", projectId);

  return created.id;
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
    .select("id, name, tax_rate, holded_contact_id")
    .eq("id", payment.studio_project_id)
    .single();
  if (!project) return { success: false, error: "Proyecto no encontrado" };

  const contactId = await ensureHoldedContact(project.id);
  if (!contactId) {
    return {
      success: false,
      error:
        "Faltan datos de facturación del cliente: añade al menos razón social o nombre antes de generar la proforma.",
    };
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
    .select("id, name, client_email, client_name, client_company_name, tax_rate")
    .eq("id", payment.studio_project_id)
    .single();
  if (!project) return { success: false, error: "Proyecto no encontrado" };
  if (!project.client_email) {
    return { success: false, error: "El proyecto no tiene email de cliente" };
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
  const greetingName = project.client_name || project.client_company_name || "";

  try {
    await sendEmailOrSchedule(
      {
        to: project.client_email,
        subject: `Proforma${proformaRef} — ${project.name} — Prototipalo`,
        text: `Hola ${greetingName},\n\nTe adjuntamos la proforma${proformaRef} (${payment.label}) por importe de ${formattedTotal} €.\n\nPuedes pagarla online en este enlace:\n${proformaUrl}\n\nO por transferencia bancaria:\nBanco: BBVA\nTitular: Prototipalo\nIBAN: ES24 0182 4010 3502 0181 5556\nSWIFT/BIC: BBVAESMM\nConcepto: ${conceptoLine}\n\nGracias.`,
        html: `
          <p>Hola ${greetingName},</p>
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
