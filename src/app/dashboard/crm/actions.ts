"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { sendEmail, type SmtpConfig, type EmailAttachment } from "@/lib/email";
import { decrypt } from "@/lib/encryption";
import { createProforma, getDocumentPdf, getDocument } from "@/lib/holded/api";
import type { HoldedDocument } from "@/lib/holded/types";
import type { LeadStatus } from "@/lib/crm-config";
import { generateAndSaveDraft } from "@/lib/ai-draft";
import { detectProjectTypeTag } from "@/lib/lead-tagger";

/** Fetch per-user SMTP config or return undefined for global fallback */
async function getUserSmtpConfig(userId: string): Promise<SmtpConfig | undefined> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_smtp_settings")
    .select("smtp_email, smtp_password_encrypted, display_name, signature_html")
    .eq("user_id", userId)
    .single();

  if (!data) return undefined;

  return {
    user: data.smtp_email,
    pass: decrypt(data.smtp_password_encrypted),
    displayName: data.display_name,
    signatureHtml: data.signature_html,
  };
}

// ── Create Lead (manual) ────────────────────────────────

export async function createLead(formData: FormData) {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  const fullName = formData.get("full_name") as string;
  if (!fullName?.trim()) {
    redirect("/dashboard/crm/new");
  }

  const assignedTo = (formData.get("assigned_to") as string)?.trim() || profile.id;

  const { data, error } = await supabase
    .from("leads")
    .insert({
      full_name: fullName.trim(),
      company: (formData.get("company") as string)?.trim() || null,
      email: (formData.get("email") as string)?.trim() || null,
      phone: (formData.get("phone") as string)?.trim() || null,
      message: (formData.get("message") as string)?.trim() || null,
      source: "manual",
      assigned_to: assignedTo,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Auto-detect project type tag from message
  const message = (formData.get("message") as string)?.trim() || null;
  const tag = await detectProjectTypeTag(message);
  if (tag) {
    await supabase.from("leads").update({ project_type_tag: tag }).eq("id", data.id);
  }

  revalidatePath("/dashboard/crm");
  redirect(`/dashboard/crm/${data.id}`);
}

// ── Update Lead Tag ──────────────────────────────────────

export async function updateLeadTag(
  id: string,
  tag: string | null
): Promise<{ success: boolean; error?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("leads")
    .update({ project_type_tag: tag || null })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/crm/${id}`);
  revalidatePath("/dashboard/crm");
  return { success: true };
}

// ── Update Lead Status ───────────────────────────────────

export async function updateLeadStatus(
  id: string,
  newStatus: LeadStatus,
  lostReason?: string
): Promise<{ success: boolean; error?: string }> {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  // Get current status for the activity log
  const { data: lead } = await supabase
    .from("leads")
    .select("status")
    .eq("id", id)
    .single();

  if (!lead) return { success: false, error: "Lead no encontrado" };

  const oldStatus = lead.status;

  const updates: Record<string, unknown> = { status: newStatus };
  if (newStatus === "lost" && lostReason) {
    updates.lost_reason = lostReason;
  }

  const { error } = await supabase.from("leads").update(updates).eq("id", id);

  if (error) return { success: false, error: error.message };

  // Log status change activity
  await supabase.from("lead_activities").insert({
    lead_id: id,
    activity_type: "status_change",
    content: `Estado cambiado de ${oldStatus} a ${newStatus}`,
    metadata: { old_status: oldStatus, new_status: newStatus, lost_reason: lostReason || null },
    created_by: profile.id,
  });

  revalidatePath(`/dashboard/crm/${id}`);
  revalidatePath("/dashboard/crm");
  return { success: true };
}

// ── Assign Lead ──────────────────────────────────────────

export async function assignLead(id: string, userId: string | null): Promise<{ success: boolean; error?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("leads")
    .update({ assigned_to: userId })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/crm/${id}`);
  revalidatePath("/dashboard/crm");
  return { success: true };
}

// ── Add Note ─────────────────────────────────────────────

export async function addNote(id: string, content: string): Promise<{ success: boolean; error?: string }> {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  if (!content?.trim()) return { success: false, error: "Contenido vacío" };

  const { error } = await supabase.from("lead_activities").insert({
    lead_id: id,
    activity_type: "note",
    content: content.trim(),
    created_by: profile.id,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/crm/${id}`);
  return { success: true };
}

// ── Send Email ───────────────────────────────────────────

export async function sendLeadEmail(
  id: string,
  to: string,
  subject: string,
  body: string,
  replyToMessageId?: string,
  threadId?: string,
  attachProforma?: boolean
): Promise<{ success: boolean; error?: string }> {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  if (!to?.trim() || !subject?.trim() || !body?.trim()) {
    return { success: false, error: "Email, asunto y cuerpo son obligatorios" };
  }

  // Build threading headers for replies
  let inReplyTo: string | undefined;
  let references: string[] | undefined;

  if (replyToMessageId && threadId) {
    inReplyTo = replyToMessageId;

    // Fetch all message_ids in this thread for the References header
    const { data: threadActivities } = await supabase
      .from("lead_activities")
      .select("metadata")
      .eq("thread_id", threadId)
      .in("activity_type", ["email_sent", "email_received"])
      .order("created_at", { ascending: true });

    references = (threadActivities || [])
      .map((a) => (a.metadata as Record<string, unknown>)?.message_id as string)
      .filter(Boolean);
  }

  // Get per-user SMTP config (falls back to global if not configured)
  const smtpConfig = await getUserSmtpConfig(profile.id);

  // Optionally attach proforma PDF from Holded
  let attachments: EmailAttachment[] | undefined;
  if (attachProforma) {
    const { data: qr } = await supabase
      .from("quote_requests")
      .select("holded_proforma_id")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (qr?.holded_proforma_id) {
      try {
        const pdf = await getDocumentPdf("proform", qr.holded_proforma_id);
        attachments = [{ filename: "proforma.pdf", content: pdf, contentType: "application/pdf" }];
      } catch {
        // Non-fatal: send without attachment if PDF download fails
      }
    }
  }

  try {
    const result = await sendEmail({
      to: to.trim(),
      subject: subject.trim(),
      text: body.trim(),
      html: body.trim().replace(/\n/g, "<br>"),
      inReplyTo,
      references,
      smtpConfig,
      attachments,
    });

    // Determine thread_id for this sent email
    const finalThreadId = threadId || result.messageId || `sent-${Date.now()}`;

    // Log email activity
    await supabase.from("lead_activities").insert({
      lead_id: id,
      activity_type: "email_sent",
      content: body.trim(),
      thread_id: finalThreadId,
      metadata: {
        email_to: to.trim(),
        email_subject: subject.trim(),
        message_id: result.messageId || null,
        in_reply_to: inReplyTo || null,
      },
      created_by: profile.id,
    });

    // Auto-mark as "contacted" and assign to sender if lead is still "new"
    const { data: lead } = await supabase
      .from("leads")
      .select("status, assigned_to")
      .eq("id", id)
      .single();

    // Clear AI draft after sending
    await supabase.from("leads").update({ ai_draft: null }).eq("id", id);

    if (lead?.status === "new") {
      await supabase
        .from("leads")
        .update({ status: "contacted", assigned_to: profile.id })
        .eq("id", id);

      // Log status change
      await supabase.from("lead_activities").insert({
        lead_id: id,
        activity_type: "status_change",
        content: "Estado cambiado de new a contacted",
        metadata: { old_status: "new", new_status: "contacted", auto: true },
        created_by: profile.id,
      });
    } else if (!lead?.assigned_to) {
      // If not "new" but unassigned, still claim ownership
      await supabase
        .from("leads")
        .update({ assigned_to: profile.id })
        .eq("id", id);
    }

    revalidatePath(`/dashboard/crm/${id}`);
    revalidatePath("/dashboard/crm");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Error al enviar el email",
    };
  }
}

// ── Link Lead to Project ─────────────────────────────────

export async function linkLeadToProject(leadId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("projects")
    .update({ lead_id: leadId })
    .eq("id", projectId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/crm/${leadId}`);
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

// ── Save Quote Items (presupuesto) ──────────────────────

export async function saveQuoteItems(
  leadId: string,
  items: ProformaLineItem[],
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  // Check if a quote_request already exists for this lead
  const { data: existing } = await supabase
    .from("quote_requests")
    .select("id")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const itemsJson = JSON.parse(JSON.stringify(items));

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from("quote_requests")
      .update({ items: itemsJson, notes: notes || null })
      .eq("id", existing.id);

    if (error) return { success: false, error: error.message };
  } else {
    // Create new
    const { error } = await supabase
      .from("quote_requests")
      .insert({
        lead_id: leadId,
        items: itemsJson,
        notes: notes || null,
      });

    if (error) return { success: false, error: error.message };
  }

  revalidatePath(`/dashboard/crm/${leadId}`);
  return { success: true };
}

// ── Send Quote to Client ────────────────────────────────

export async function sendQuoteToClient(
  leadId: string,
): Promise<{ success: boolean; error?: string }> {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  // Get lead email
  const { data: lead } = await supabase
    .from("leads")
    .select("email, full_name")
    .eq("id", leadId)
    .single();

  if (!lead?.email) {
    return { success: false, error: "El lead no tiene email" };
  }

  // Get the quote request with items
  const { data: qr } = await supabase
    .from("quote_requests")
    .select("id, token, items")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!qr) {
    return { success: false, error: "No hay presupuesto guardado" };
  }

  const items = (qr.items || []) as unknown as ProformaLineItem[];
  if (items.length === 0) {
    return { success: false, error: "El presupuesto no tiene líneas" };
  }

  // Build public URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://app.prototipalo.es";
  const quoteUrl = `${baseUrl}/quote/${qr.token}`;

  // Build items HTML table for the email
  const subtotal = items.reduce((s, i) => s + i.price * i.units, 0);
  const taxTotal = items.reduce((s, i) => s + i.price * i.units * (i.tax / 100), 0);
  const total = subtotal + taxTotal;

  const itemsHtml = `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <thead>
        <tr style="border-bottom:2px solid #e4e4e7;">
          <th style="text-align:left;padding:8px 4px;font-size:13px;color:#71717a;">Concepto</th>
          <th style="text-align:right;padding:8px 4px;font-size:13px;color:#71717a;">Uds</th>
          <th style="text-align:right;padding:8px 4px;font-size:13px;color:#71717a;">Precio</th>
          <th style="text-align:right;padding:8px 4px;font-size:13px;color:#71717a;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((i) => `
          <tr style="border-bottom:1px solid #f4f4f5;">
            <td style="padding:8px 4px;font-size:13px;">${i.concept}</td>
            <td style="text-align:right;padding:8px 4px;font-size:13px;">${i.units}</td>
            <td style="text-align:right;padding:8px 4px;font-size:13px;">${i.price.toFixed(2)} &euro;</td>
            <td style="text-align:right;padding:8px 4px;font-size:13px;">${(i.price * i.units).toFixed(2)} &euro;</td>
          </tr>
        `).join("")}
      </tbody>
      <tfoot>
        <tr><td colspan="3" style="text-align:right;padding:4px;font-size:13px;color:#71717a;">Subtotal</td><td style="text-align:right;padding:4px;font-size:13px;">${subtotal.toFixed(2)} &euro;</td></tr>
        <tr><td colspan="3" style="text-align:right;padding:4px;font-size:13px;color:#71717a;">IVA</td><td style="text-align:right;padding:4px;font-size:13px;">${taxTotal.toFixed(2)} &euro;</td></tr>
        <tr style="border-top:2px solid #e4e4e7;"><td colspan="3" style="text-align:right;padding:8px 4px;font-size:14px;font-weight:600;">Total</td><td style="text-align:right;padding:8px 4px;font-size:14px;font-weight:600;">${total.toFixed(2)} &euro;</td></tr>
      </tfoot>
    </table>`;

  // Get per-user SMTP config
  const smtpConfig = await getUserSmtpConfig(profile.id);

  // Send email
  try {
    await sendEmail({
      to: lead.email,
      subject: "Presupuesto — Prototipalo",
      text: `Hola ${lead.full_name},\n\nTe enviamos el presupuesto para tu proyecto.\n\nPuedes verlo y completar tus datos de facturación en el siguiente enlace:\n${quoteUrl}\n\nGracias,\nEl equipo de Prototipalo`,
      html: `<p>Hola ${lead.full_name},</p><p>Te enviamos el presupuesto para tu proyecto:</p>${itemsHtml}<p>Para confirmar el presupuesto, necesitamos tus datos de facturación:</p><p><a href="${quoteUrl}" style="display:inline-block;padding:10px 20px;background:#e9473f;color:white;border-radius:8px;text-decoration:none;font-weight:500;">Ver presupuesto y rellenar datos</a></p><p>Gracias,<br>El equipo de Prototipalo</p>`,
      smtpConfig,
    });
  } catch {
    return { success: false, error: "Error al enviar el email" };
  }

  // Update quote request status
  await supabase
    .from("quote_requests")
    .update({ status: "quote_sent" })
    .eq("id", qr.id);

  // Log activity
  await supabase.from("lead_activities").insert({
    lead_id: leadId,
    activity_type: "email_sent",
    content: "Presupuesto enviado al cliente",
    metadata: {
      email_to: lead.email,
      email_subject: "Presupuesto — Prototipalo",
      quote_token: qr.token,
    },
    created_by: profile.id,
  });

  revalidatePath(`/dashboard/crm/${leadId}`);
  return { success: true };
}

// ── Legacy: Quote Request (billing data form) ───────────

export async function createQuoteRequest(
  leadId: string,
): Promise<{ success: boolean; error?: string }> {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  // Get lead email
  const { data: lead } = await supabase
    .from("leads")
    .select("email, full_name")
    .eq("id", leadId)
    .single();

  if (!lead?.email) {
    return { success: false, error: "El lead no tiene email" };
  }

  // Insert quote request
  const { data: qr, error: insertError } = await supabase
    .from("quote_requests")
    .insert({ lead_id: leadId })
    .select("token")
    .single();

  if (insertError || !qr) {
    return { success: false, error: insertError?.message || "Error al crear solicitud" };
  }

  // Build public URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://app.prototipalo.es";
  const quoteUrl = `${baseUrl}/quote/${qr.token}`;

  // Get per-user SMTP config
  const smtpConfig = await getUserSmtpConfig(profile.id);

  // Send email
  try {
    await sendEmail({
      to: lead.email,
      subject: "Datos de facturación — Prototipalo",
      text: `Hola ${lead.full_name},\n\nPara preparar tu presupuesto necesitamos tus datos de facturación.\n\nPor favor, rellena el siguiente formulario:\n${quoteUrl}\n\nGracias,\nEl equipo de Prototipalo`,
      html: `<p>Hola ${lead.full_name},</p><p>Para preparar tu presupuesto necesitamos tus datos de facturación.</p><p>Por favor, rellena el siguiente formulario:</p><p><a href="${quoteUrl}" style="display:inline-block;padding:10px 20px;background:#e9473f;color:white;border-radius:8px;text-decoration:none;font-weight:500;">Rellenar datos de facturación</a></p><p>Gracias,<br>El equipo de Prototipalo</p>`,
      smtpConfig,
    });
  } catch {
    return { success: false, error: "Error al enviar el email" };
  }

  // Log activity
  await supabase.from("lead_activities").insert({
    lead_id: leadId,
    activity_type: "email_sent",
    content: "Formulario de datos de facturación enviado",
    metadata: {
      email_to: lead.email,
      email_subject: "Datos de facturación — Prototipalo",
      quote_token: qr.token,
    },
    created_by: profile.id,
  });

  revalidatePath(`/dashboard/crm/${leadId}`);
  return { success: true };
}

export async function getQuoteRequest(leadId: string) {
  await requireRole("manager");
  const supabase = await createClient();

  const { data } = await supabase
    .from("quote_requests")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

// ── Get Lead Emails (for contact modal) ─────────────────

export async function getLeadEmails(leadId: string) {
  await requireRole("manager");
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("email, full_name, company, email_subject_tag, lead_number")
    .eq("id", leadId)
    .single();

  if (!lead) return { success: false as const, error: "Lead no encontrado" };

  const { data: activities } = await supabase
    .from("lead_activities")
    .select("id, activity_type, content, metadata, thread_id, created_at, created_by")
    .eq("lead_id", leadId)
    .in("activity_type", ["email_sent", "email_received"])
    .order("created_at", { ascending: true });

  // Check if lead has a holded proforma
  const { data: qr } = await supabase
    .from("quote_requests")
    .select("holded_proforma_id")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    success: true as const,
    lead,
    activities: activities || [],
    holdedProformaId: qr?.holded_proforma_id || null,
  };
}

// ── Search Leads ─────────────────────────────────────────

export async function searchLeads(query: string) {
  await requireRole("manager");
  const supabase = await createClient();

  const { data } = await supabase
    .from("leads")
    .select("id, full_name, email, company")
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%`)
    .limit(10);

  return data || [];
}

// ── Block Email & Delete Lead ────────────────────────────

export async function blockEmailAndDeleteLead(
  leadId: string,
  email: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  if (!email?.trim()) return { success: false, error: "Email es obligatorio" };

  // Insert into blocked_emails (ignore if already blocked)
  await supabase
    .from("blocked_emails")
    .insert({ email: email.toLowerCase().trim(), reason: reason || null })
    .single();

  // Delete the lead
  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/crm");
  redirect("/dashboard/crm");
}

// ── Delete Lead ──────────────────────────────────────────

export async function deleteLead(id: string): Promise<{ success: boolean; error?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase.from("leads").delete().eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/crm");
  redirect("/dashboard/crm");
}

// ── Dismiss Lead (block email if exists + delete, no redirect) ──

// ── Update Payment Condition ─────────────────────────────

export async function updatePaymentCondition(
  id: string,
  condition: string | null
): Promise<{ success: boolean; error?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  const value = condition && ["50-50", "100-5"].includes(condition) ? condition : null;

  const { error } = await supabase
    .from("leads")
    .update({ payment_condition: value })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/crm/${id}`);
  return { success: true };
}

// ── Dismiss Lead (block email if exists + delete, no redirect) ──

// ── Get Proforma Details from Holded ─────────────────────

export async function getProformaDetails(
  leadId: string,
): Promise<{ success: boolean; proforma?: HoldedDocument; error?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  const { data: qr } = await supabase
    .from("quote_requests")
    .select("holded_proforma_id")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!qr?.holded_proforma_id) {
    return { success: false, error: "No hay proforma vinculada" };
  }

  try {
    const proforma = await getDocument("proform", qr.holded_proforma_id);
    return { success: true, proforma };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Error al obtener la proforma",
    };
  }
}

export async function dismissLead(
  leadId: string,
  email: string | null
): Promise<{ success: boolean; error?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  if (email?.trim()) {
    await supabase
      .from("blocked_emails")
      .insert({ email: email.toLowerCase().trim(), reason: "Descartado desde bandeja de nuevos" })
      .single();
  }

  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/crm");
  return { success: true };
}

// ── Proforma (create & send) ─────────────────────────────

export interface ProformaLineItem {
  concept: string;
  price: number;
  units: number;
  tax: number; // 0, 4, 10, 21
}

export async function createLeadProforma(
  leadId: string,
): Promise<{ success: boolean; error?: string; proformaId?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  // Get the latest quote_request for this lead
  const { data: qr } = await supabase
    .from("quote_requests")
    .select("id, holded_contact_id, items, notes")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!qr?.holded_contact_id) {
    return { success: false, error: "El lead no tiene contacto de Holded vinculado" };
  }

  const items = (qr.items || []) as unknown as ProformaLineItem[];
  if (items.length === 0) {
    return { success: false, error: "No hay líneas de presupuesto guardadas" };
  }

  try {
    // Create proforma with items in a single call
    const proforma = await createProforma(qr.holded_contact_id, {
      items: items.map((item) => ({
        name: item.concept,
        units: item.units,
        subtotal: item.price,
        tax: item.tax,
      })),
      notes: qr.notes || undefined,
    });

    // Save proforma ID to quote_request
    await supabase
      .from("quote_requests")
      .update({ holded_proforma_id: proforma.id })
      .eq("id", qr.id);

    revalidatePath(`/dashboard/crm/${leadId}`);
    return { success: true, proformaId: proforma.id };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Error al crear la proforma",
    };
  }
}

// ── Generate Email Draft with AI ─────────────────────────

export async function generateEmailDraft(
  leadId: string,
  replyToContent?: string
): Promise<{ success: boolean; draft?: string; error?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  // Get lead info
  const { data: lead } = await supabase
    .from("leads")
    .select("full_name, company, email, message")
    .eq("id", leadId)
    .single();

  if (!lead) return { success: false, error: "Lead no encontrado" };

  try {
    await generateAndSaveDraft(
      leadId,
      { fullName: lead.full_name, company: lead.company, message: lead.message },
      replyToContent
    );

    // Read back the saved draft
    const { data: updated } = await supabase
      .from("leads")
      .select("ai_draft")
      .eq("id", leadId)
      .single();

    return { success: true, draft: updated?.ai_draft || "" };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Error al generar borrador",
    };
  }
}

export async function sendLeadProforma(
  leadId: string,
): Promise<{ success: boolean; error?: string }> {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  // Get lead info
  const { data: lead } = await supabase
    .from("leads")
    .select("email, full_name")
    .eq("id", leadId)
    .single();

  if (!lead?.email) {
    return { success: false, error: "El lead no tiene email" };
  }

  // Get proforma ID from quote_request
  const { data: qr } = await supabase
    .from("quote_requests")
    .select("id, holded_proforma_id")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!qr?.holded_proforma_id) {
    return { success: false, error: "No hay proforma creada" };
  }

  try {
    // Download PDF from Holded
    const pdfBuffer = await getDocumentPdf("proform", qr.holded_proforma_id);

    // Get per-user SMTP config
    const smtpConfig = await getUserSmtpConfig(profile.id);

    // Send email with PDF attachment
    await sendEmail({
      to: lead.email,
      subject: `Presupuesto — Prototipalo`,
      text: `Hola ${lead.full_name},\n\nAdjuntamos el presupuesto para tu proyecto.\n\nSi tienes alguna duda, no dudes en contestar a este email.\n\nGracias,\nEl equipo de Prototipalo`,
      html: `<p>Hola ${lead.full_name},</p><p>Adjuntamos el presupuesto para tu proyecto.</p><p>Si tienes alguna duda, no dudes en contestar a este email.</p><p>Gracias,<br>El equipo de Prototipalo</p>`,
      smtpConfig,
      attachments: [
        {
          filename: `Presupuesto-Prototipalo.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    // Log activity
    await supabase.from("lead_activities").insert({
      lead_id: leadId,
      activity_type: "email_sent",
      content: "Presupuesto enviado por email",
      metadata: {
        email_to: lead.email,
        email_subject: "Presupuesto — Prototipalo",
        holded_proforma_id: qr.holded_proforma_id,
      },
      created_by: profile.id,
    });

    revalidatePath(`/dashboard/crm/${leadId}`);
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Error al enviar la proforma",
    };
  }
}
