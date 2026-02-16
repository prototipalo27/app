"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { sendEmail } from "@/lib/email";
import type { LeadStatus } from "@/lib/crm-config";

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
  threadId?: string
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

  const result = await sendEmail({
    to: to.trim(),
    subject: subject.trim(),
    text: body.trim(),
    html: body.trim().replace(/\n/g, "<br>"),
    inReplyTo,
    references,
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

  revalidatePath(`/dashboard/crm/${id}`);
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

  // Send email
  try {
    await sendEmail({
      to: lead.email,
      subject: "Datos de facturación — Prototipalo",
      text: `Hola ${lead.full_name},\n\nPara preparar tu presupuesto necesitamos tus datos de facturación.\n\nPor favor, rellena el siguiente formulario:\n${quoteUrl}\n\nGracias,\nEl equipo de Prototipalo`,
      html: `<p>Hola ${lead.full_name},</p><p>Para preparar tu presupuesto necesitamos tus datos de facturación.</p><p>Por favor, rellena el siguiente formulario:</p><p><a href="${quoteUrl}" style="display:inline-block;padding:10px 20px;background:#16a34a;color:white;border-radius:8px;text-decoration:none;font-weight:500;">Rellenar datos de facturación</a></p><p>Gracias,<br>El equipo de Prototipalo</p>`,
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
