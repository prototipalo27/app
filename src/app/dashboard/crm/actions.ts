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
import Anthropic from "@anthropic-ai/sdk";

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

  const assignedTo = (formData.get("assigned_to") as string)?.trim() || null;

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

  revalidatePath("/dashboard/crm");
  redirect(`/dashboard/crm/${data.id}`);
}

// ── Update Lead Status ───────────────────────────────────

export async function updateLeadStatus(
  id: string,
  newStatus: LeadStatus,
  lostReason?: string
) {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  // Get current status for the activity log
  const { data: lead } = await supabase
    .from("leads")
    .select("status")
    .eq("id", id)
    .single();

  if (!lead) throw new Error("Lead no encontrado");

  const oldStatus = lead.status;

  const updates: Record<string, unknown> = { status: newStatus };
  if (newStatus === "lost" && lostReason) {
    updates.lost_reason = lostReason;
  }

  const { error } = await supabase.from("leads").update(updates).eq("id", id);

  if (error) throw new Error(error.message);

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
}

// ── Assign Lead ──────────────────────────────────────────

export async function assignLead(id: string, userId: string | null) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("leads")
    .update({ assigned_to: userId })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/crm/${id}`);
  revalidatePath("/dashboard/crm");
}

// ── Add Note ─────────────────────────────────────────────

export async function addNote(id: string, content: string) {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  if (!content?.trim()) return;

  const { error } = await supabase.from("lead_activities").insert({
    lead_id: id,
    activity_type: "note",
    content: content.trim(),
    created_by: profile.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/crm/${id}`);
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
) {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  if (!to?.trim() || !subject?.trim() || !body?.trim()) {
    throw new Error("Email, asunto y cuerpo son obligatorios");
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
}

// ── Link Lead to Project ─────────────────────────────────

export async function linkLeadToProject(leadId: string, projectId: string) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("projects")
    .update({ lead_id: leadId })
    .eq("id", projectId);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/crm/${leadId}`);
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard");
}

// ── Quote Request ────────────────────────────────────────

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

  const { data, error } = await supabase
    .from("leads")
    .select("id, full_name, email, company")
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%`)
    .limit(10);

  if (error) throw new Error(error.message);

  return data || [];
}

// ── Block Email & Delete Lead ────────────────────────────

export async function blockEmailAndDeleteLead(
  leadId: string,
  email: string,
  reason?: string
) {
  await requireRole("manager");
  const supabase = await createClient();

  if (!email?.trim()) throw new Error("Email es obligatorio");

  // Insert into blocked_emails (ignore if already blocked)
  await supabase
    .from("blocked_emails")
    .insert({ email: email.toLowerCase().trim(), reason: reason || null })
    .single();

  // Delete the lead
  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/crm");
  redirect("/dashboard/crm");
}

// ── Delete Lead ──────────────────────────────────────────

export async function deleteLead(id: string) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase.from("leads").delete().eq("id", id);

  if (error) throw new Error(error.message);

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
  items: ProformaLineItem[],
  notes?: string,
): Promise<{ success: boolean; error?: string; proformaId?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  // Get the latest quote_request for this lead
  const { data: qr } = await supabase
    .from("quote_requests")
    .select("id, holded_contact_id")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!qr?.holded_contact_id) {
    return { success: false, error: "El lead no tiene contacto de Holded vinculado" };
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
      notes,
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { success: false, error: "ANTHROPIC_API_KEY no configurada" };
  }

  // Get lead info
  const { data: lead } = await supabase
    .from("leads")
    .select("full_name, company, email, message")
    .eq("id", leadId)
    .single();

  if (!lead) return { success: false, error: "Lead no encontrado" };

  // Get recent email history
  const { data: emailActivities } = await supabase
    .from("lead_activities")
    .select("activity_type, content, metadata, created_at")
    .eq("lead_id", leadId)
    .in("activity_type", ["email_sent", "email_received"])
    .order("created_at", { ascending: true })
    .limit(20);

  // Get snippets for tone reference
  const { data: snippets } = await supabase
    .from("email_snippets")
    .select("title, content, category")
    .limit(10);

  // Build context for the prompt
  const leadContext = [
    `Nombre: ${lead.full_name}`,
    lead.company ? `Empresa: ${lead.company}` : null,
    lead.message ? `Mensaje original del lead: ${lead.message}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  let emailHistory = "";
  if (emailActivities && emailActivities.length > 0) {
    emailHistory = emailActivities
      .map((e) => {
        const direction = e.activity_type === "email_sent" ? "ENVIADO" : "RECIBIDO";
        const meta = e.metadata as Record<string, unknown> | null;
        const subject = meta?.email_subject ? ` (Asunto: ${meta.email_subject})` : "";
        return `[${direction}]${subject}\n${e.content || "(sin contenido)"}`;
      })
      .join("\n---\n");
  }

  let snippetRef = "";
  if (snippets && snippets.length > 0) {
    snippetRef = snippets.map((s) => `[${s.category}] ${s.title}: ${s.content}`).join("\n");
  }

  const systemPrompt = `Eres un asistente de ventas de Prototipalo, un taller de producción especializado en impresión 3D con impresoras Bambu Lab.
Generas borradores de email profesionales pero cercanos, siempre en español.

Reglas:
- Tono profesional pero cercano y amigable
- En español
- Conciso, ve al grano
- NO incluyas firma (se añade automáticamente)
- NO incluyas línea de asunto
- NO uses emojis
- Si es una respuesta, responde directamente al contenido del email recibido
- Si es un email nuevo, preséntate brevemente y aborda el mensaje/consulta del lead`;

  const userPrompt = [
    "Genera un borrador de email para este lead.",
    "",
    "--- DATOS DEL LEAD ---",
    leadContext,
    emailHistory
      ? `\n--- HISTORIAL DE EMAILS ---\n${emailHistory}`
      : "",
    replyToContent
      ? `\n--- EMAIL AL QUE RESPONDER ---\n${replyToContent}`
      : "",
    snippetRef
      ? `\n--- SNIPPETS DE REFERENCIA (usa como guía de tono y contenido) ---\n${snippetRef}`
      : "",
    "",
    replyToContent
      ? "Genera una respuesta adecuada al email recibido."
      : "Genera un email inicial adecuado para este lead.",
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const draft =
      response.content[0].type === "text" ? response.content[0].text : "";

    return { success: true, draft };
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
