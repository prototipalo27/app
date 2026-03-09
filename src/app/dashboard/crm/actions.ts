"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { sendEmail, sendEmailOrSchedule, type SmtpConfig, type EmailAttachment } from "@/lib/email";
import { decrypt } from "@/lib/encryption";
import { createProforma, createEstimate, createContact, getContact, searchContacts, getDocumentPdf, getDocument } from "@/lib/holded/api";
import type { HoldedDocument } from "@/lib/holded/types";
import type { LeadStatus } from "@/lib/crm-config";
import { generateAndSaveDraft } from "@/lib/ai-draft";
import { detectProjectTypeTag } from "@/lib/lead-tagger";
// AI estimation is now handled by Postgres trigger auto_estimate_lead

// ── Base Prices ──────────────────────────────────────────

export async function getBasePrices(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("base_prices")
    .select("category, price_per_unit")
    .order("category");

  const map: Record<string, number> = {};
  for (const row of data || []) {
    map[row.category] = Number(row.price_per_unit);
  }
  return map;
}

export async function updateBasePrice(
  category: string,
  price: number
): Promise<{ success: boolean; error?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("base_prices")
    .upsert({ category, price_per_unit: price }, { onConflict: "category" });

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/crm");
  return { success: true };
}

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
  const ownedBy = (formData.get("owned_by") as string)?.trim() || null;

  const estimatedQuantity = (formData.get("estimated_quantity") as string)?.trim() || null;
  const estimatedComplexity = (formData.get("estimated_complexity") as string)?.trim() || null;
  const estimatedUrgency = (formData.get("estimated_urgency") as string)?.trim() || null;
  const message = (formData.get("message") as string)?.trim() || null;

  // DB trigger auto_estimate_lead handles:
  // - auto-fill quantity from message if not provided
  // - default complexity/urgency
  // - estimated_value calculation
  const { data, error } = await supabase
    .from("leads")
    .insert({
      full_name: fullName.trim(),
      company: (formData.get("company") as string)?.trim() || null,
      email: (formData.get("email") as string)?.trim() || null,
      phone: (formData.get("phone") as string)?.trim() || null,
      message: message,
      source: "manual",
      assigned_to: assignedTo,
      owned_by: ownedBy,
      estimated_quantity: estimatedQuantity,
      estimated_complexity: estimatedComplexity,
      estimated_urgency: estimatedUrgency,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Auto-detect project type tag from message
  const tag = await detectProjectTypeTag(message);
  if (tag) {
    // This UPDATE also fires the trigger, recalculating estimated_value with the new tag
    await supabase.from("leads").update({ project_type_tag: tag }).eq("id", data.id);
  }

  revalidatePath("/dashboard/crm");
  redirect(`/dashboard/crm/${data.id}`);
}

// ── Estimation helpers ───────────────────────────────────

/** Trigger a recalculation of estimated_value via the DB trigger.
 *  The Postgres trigger `auto_estimate_lead` handles the formula. We just
 *  need to touch one of the watched columns to fire it. */
async function recalculateEstimatedValue(id: string) {
  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("estimated_quantity")
    .eq("id", id)
    .single();
  if (!lead) return;
  // Re-set the same quantity to trigger the BEFORE UPDATE
  await supabase
    .from("leads")
    .update({ estimated_quantity: lead.estimated_quantity })
    .eq("id", id);
}

export async function updateEstimatedValue(
  id: string,
  value: number | null
): Promise<{ success: boolean; error?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("leads")
    .update({ estimated_value: value })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/crm/${id}`);
  return { success: true };
}

export async function updateEstimationField(
  id: string,
  field: "estimated_quantity" | "estimated_complexity" | "estimated_urgency",
  value: string | null
): Promise<{ success: boolean; error?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("leads")
    .update({ [field]: value || null })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  await recalculateEstimatedValue(id);

  revalidatePath(`/dashboard/crm/${id}`);
  revalidatePath("/dashboard/crm");
  return { success: true };
}

// ── Update Qualification Level ───────────────────────────

export async function updateQualificationLevel(
  id: string,
  level: number | null
): Promise<{ success: boolean; error?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  const value = level && level >= 1 && level <= 5 ? level : null;

  const { error } = await supabase
    .from("leads")
    .update({ qualification_level: value })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/crm/${id}`);
  revalidatePath("/dashboard/crm");
  return { success: true };
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

  // Recalculate estimated value since base price depends on tag
  await recalculateEstimatedValue(id);

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

// ── Update Lead Owner (commercial) ───────────────────────

export async function updateLeadOwner(
  id: string,
  userId: string | null
): Promise<{ success: boolean; error?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("leads")
    .update({ owned_by: userId })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/crm/${id}`);
  revalidatePath("/dashboard/crm");
  return { success: true };
}

// ── Commission Summary ───────────────────────────────────

// ── Commission Config Types ─────────────────────────────

export type CommissionTier = { min: number; max: number | null; rate: number };

export type CommissionConfig = {
  id: string;
  user_id: string;
  type: "flat" | "tiered";
  new_rate: number;
  returning_rate: number;
  tiers: CommissionTier[];
  prepaid_bonus: number;
};

export async function getCommissionConfigs(): Promise<CommissionConfig[]> {
  await requireRole("manager");
  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from("commission_configs")
    .select("*");
  return (data || []).map((c: any) => ({
    id: c.id,
    user_id: c.user_id,
    type: c.type as "flat" | "tiered",
    new_rate: Number(c.new_rate),
    returning_rate: Number(c.returning_rate),
    tiers: (c.tiers || []) as CommissionTier[],
    prepaid_bonus: Number(c.prepaid_bonus ?? 0.01),
  }));
}

export async function saveCommissionConfig(
  userId: string,
  config: { type: "flat" | "tiered"; new_rate: number; returning_rate: number; tiers: CommissionTier[]; prepaid_bonus: number }
) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await (supabase as any)
    .from("commission_configs")
    .upsert({
      user_id: userId,
      type: config.type,
      new_rate: config.new_rate,
      returning_rate: config.returning_rate,
      tiers: config.tiers,
      prepaid_bonus: config.prepaid_bonus,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/crm/comisiones");
}

/**
 * Calculate commission for a tiered config.
 * Each tier's rate applies to the slice of revenue in that bracket.
 * E.g. tiers [{min:0,max:3000,rate:0.05},{min:3000,max:null,rate:0.10}]
 * For accumulatedBefore=2000, quoteTotal=2000:
 *   - 1000 at 5% (fills 0-3000 bracket) + 1000 at 10% = 150€
 */
function calcTieredCommission(
  tiers: CommissionTier[],
  accumulatedBefore: number,
  quoteTotal: number
): { commission: number; effectiveRate: number } {
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  let remaining = quoteTotal;
  let commission = 0;
  let cursor = accumulatedBefore;

  for (const tier of sorted) {
    if (remaining <= 0) break;
    const tierMax = tier.max ?? Infinity;
    if (cursor >= tierMax) continue;
    const start = Math.max(cursor, tier.min);
    const end = tierMax;
    const slotAvailable = end - start;
    const slice = Math.min(remaining, slotAvailable);
    commission += slice * tier.rate;
    remaining -= slice;
    cursor += slice;
  }

  const effectiveRate = quoteTotal > 0 ? commission / quoteTotal : 0;
  return { commission, effectiveRate };
}

export async function getCommissionSummary(leadId: string): Promise<{
  isReturning: boolean;
  rate: number;
  quoteTotal: number;
  commission: number;
  prepaidBonus: number;
} | null> {
  await requireRole("manager");
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("id, email, status, created_at, owned_by, updated_at, payment_condition")
    .eq("id", leadId)
    .single();

  if (!lead || lead.status !== "won") return null;

  const { data: qr } = await supabase
    .from("quote_requests")
    .select("items")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const items = (qr?.items || []) as unknown as ProformaLineItem[];
  const quoteTotal = items.reduce((sum, i) => sum + i.price * i.units, 0);
  if (quoteTotal === 0) return null;

  // Check if returning client
  let isReturning = false;
  if (lead.email) {
    const { count } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .ilike("email", lead.email)
      .eq("status", "won")
      .neq("id", lead.id)
      .lt("created_at", lead.created_at);
    isReturning = (count ?? 0) > 0;
  }

  // Prepaid bonus: extra % if payment_condition is "100-5" (100% upfront)
  const isPrepaid = lead.payment_condition === "100-5";

  // Get commission config for this commercial
  if (lead.owned_by) {
    const { data: config } = await (supabase as any)
      .from("commission_configs")
      .select("*")
      .eq("user_id", lead.owned_by)
      .single();

    const bonusRate = (isPrepaid && config) ? Number(config.prepaid_bonus ?? 0.01) : 0;
    const prepaidBonus = quoteTotal * bonusRate;

    if (config && config.type === "tiered") {
      const tiers = (config.tiers || []) as CommissionTier[];
      const wonDate = new Date(lead.updated_at);
      const monthStart = new Date(wonDate.getFullYear(), wonDate.getMonth(), 1).toISOString();
      const monthEnd = new Date(wonDate.getFullYear(), wonDate.getMonth() + 1, 1).toISOString();

      const { data: otherWon } = await supabase
        .from("leads")
        .select("id")
        .eq("status", "won")
        .eq("owned_by", lead.owned_by)
        .neq("id", lead.id)
        .gte("updated_at", monthStart)
        .lt("updated_at", monthEnd);

      let accBefore = 0;
      if (otherWon && otherWon.length > 0) {
        const otherIds = otherWon.map((l) => l.id);
        const { data: otherQuotes } = await supabase
          .from("quote_requests")
          .select("lead_id, items")
          .in("lead_id", otherIds);
        for (const q of otherQuotes || []) {
          const qItems = (q.items || []) as unknown as ProformaLineItem[];
          accBefore += qItems.reduce((s, i) => s + i.price * i.units, 0);
        }
      }

      const { commission, effectiveRate } = calcTieredCommission(tiers, accBefore, quoteTotal);
      return { isReturning, rate: effectiveRate, quoteTotal, commission: commission + prepaidBonus, prepaidBonus };
    }

    if (config && config.type === "flat") {
      const rate = isReturning ? Number(config.returning_rate) : Number(config.new_rate);
      return { isReturning, rate, quoteTotal, commission: quoteTotal * rate + prepaidBonus, prepaidBonus };
    }
  }

  // Fallback: default flat rates
  const bonusRate = isPrepaid ? 0.01 : 0;
  const prepaidBonus = quoteTotal * bonusRate;
  const rate = isReturning ? 0.075 : 0.15;
  return { isReturning, rate, quoteTotal, commission: quoteTotal * rate + prepaidBonus, prepaidBonus };
}

// ── Link existing client ─────────────────────────────────

export async function searchLeadsForLink(query: string): Promise<{
  id: string;
  full_name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
}[]> {
  await requireRole("manager");
  const supabase = await createClient();

  const { data } = await supabase
    .from("leads")
    .select("id, full_name, company, email, phone")
    .or(`full_name.ilike.%${query}%,company.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
    .order("created_at", { ascending: false })
    .limit(10);

  return data || [];
}

export async function searchHoldedContacts(query: string): Promise<{
  id: string;
  name: string;
  email: string;
  phone: string;
  code: string;
}[]> {
  await requireRole("manager");
  const results = await searchContacts(query);
  return results.slice(0, 10).map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email || "",
    phone: c.phone || c.mobile || "",
    code: c.code || "",
  }));
}

export async function linkLeadToHoldedContact(
  leadId: string,
  holdedContactId: string
): Promise<{ success: boolean; error?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  // Fetch the Holded contact details
  let contact;
  try {
    contact = await getContact(holdedContactId);
  } catch {
    return { success: false, error: "No se pudo obtener el contacto de Holded" };
  }

  // Update lead with Holded contact info
  const updateFields: Record<string, unknown> = {};
  if (contact.email) updateFields.email = contact.email;
  if (contact.phone || contact.mobile) updateFields.phone = contact.phone || contact.mobile;
  if (contact.name) updateFields.company = contact.name;

  if (Object.keys(updateFields).length > 0) {
    await supabase.from("leads").update(updateFields).eq("id", leadId);
  }

  // Link holded_contact_id to the lead's quote_request
  const { data: qr } = await supabase
    .from("quote_requests")
    .select("id")
    .eq("lead_id", leadId)
    .limit(1)
    .maybeSingle();

  if (qr) {
    await supabase
      .from("quote_requests")
      .update({ holded_contact_id: holdedContactId })
      .eq("id", qr.id);
  }

  revalidatePath(`/dashboard/crm/${leadId}`);
  revalidatePath("/dashboard/crm");
  return { success: true };
}

export async function linkLeadToClient(
  leadId: string,
  clientLeadId: string
): Promise<{ success: boolean; error?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("leads")
    .select("full_name, company, email, phone")
    .eq("id", clientLeadId)
    .single();

  if (!client) return { success: false, error: "Cliente no encontrado" };

  // Update lead contact info
  const { error } = await supabase
    .from("leads")
    .update({
      company: client.company,
      email: client.email,
      phone: client.phone,
    })
    .eq("id", leadId);

  if (error) return { success: false, error: error.message };

  // Try to link Holded contact: look for holded_contact_id from the client's quote_request
  try {
    let holdedContactId: string | null = null;

    // Check if the matched client lead already has a holded contact
    const { data: clientQr } = await supabase
      .from("quote_requests")
      .select("holded_contact_id")
      .eq("lead_id", clientLeadId)
      .not("holded_contact_id", "is", null)
      .limit(1)
      .maybeSingle();

    if (clientQr?.holded_contact_id) {
      holdedContactId = clientQr.holded_contact_id;
    } else if (client.email) {
      // Search Holded by email
      const existing = await searchContacts(client.email);
      if (existing.length > 0) {
        holdedContactId = existing[0].id;
      }
    }

    if (!holdedContactId && (client.email || client.company)) {
      // Create contact in Holded
      const newContact = await createContact({
        name: client.company || client.full_name,
        email: client.email || undefined,
        phone: client.phone || undefined,
      });
      holdedContactId = newContact.id;
    }

    // If we found/created a holded contact, link it to this lead's quote_request
    if (holdedContactId) {
      const { data: currentQr } = await supabase
        .from("quote_requests")
        .select("id")
        .eq("lead_id", leadId)
        .limit(1)
        .maybeSingle();

      if (currentQr) {
        await supabase
          .from("quote_requests")
          .update({ holded_contact_id: holdedContactId })
          .eq("id", currentQr.id);
      }
    }
  } catch {
    // Holded failure should not block the link
  }

  revalidatePath(`/dashboard/crm/${leadId}`);
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
): Promise<{ success: boolean; error?: string; scheduled?: boolean }> {
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
        attachments = [{ filename: "Presupuesto-Prototipalo.pdf", content: pdf, contentType: "application/pdf" }];
      } catch {
        // Non-fatal: send without attachment if PDF download fails
      }
    }
  }

  try {
    const result = await sendEmailOrSchedule({
      to: to.trim(),
      subject: subject.trim(),
      text: body.trim(),
      html: body.trim().replace(/\n/g, "<br>"),
      inReplyTo,
      references,
      smtpConfig,
      attachments,
    }, { createdBy: profile.id, leadId: id });

    // Determine thread_id for this sent email
    const finalThreadId = threadId || result.messageId || `sent-${Date.now()}`;

    // Log email activity
    await supabase.from("lead_activities").insert({
      lead_id: id,
      activity_type: result.scheduled ? "email_scheduled" : "email_sent",
      content: body.trim(),
      thread_id: finalThreadId,
      metadata: {
        email_to: to.trim(),
        email_subject: subject.trim(),
        message_id: result.messageId || null,
        in_reply_to: inReplyTo || null,
        scheduled: result.scheduled || false,
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
    return { success: true, scheduled: result.scheduled };
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

  // Update lead estimated_value from quote total
  const quoteTotal = items.reduce((sum, i) => sum + i.price * i.units, 0);
  if (quoteTotal > 0) {
    await supabase
      .from("leads")
      .update({ estimated_value: quoteTotal })
      .eq("id", leadId);
  }

  revalidatePath(`/dashboard/crm/${leadId}`);
  return { success: true };
}

// ── Send Quote to Client ────────────────────────────────

export async function sendQuoteToClient(
  leadId: string,
): Promise<{ success: boolean; error?: string; holdedEstimateId?: string }> {
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
    .select("id, token, items, notes, holded_contact_id, holded_proforma_id")
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

  // Send email (or schedule if night hours)
  try {
    await sendEmailOrSchedule({
      to: lead.email,
      subject: "Presupuesto — Prototipalo",
      text: `Hola ${lead.full_name},\n\nTe enviamos el presupuesto para tu proyecto.\n\nPuedes verlo y completar tus datos de facturación en el siguiente enlace:\n${quoteUrl}\n\nGracias,\nEl equipo de Prototipalo`,
      html: `<p>Hola ${lead.full_name},</p><p>Te enviamos el presupuesto para tu proyecto:</p>${itemsHtml}<p>Para confirmar el presupuesto, necesitamos tus datos de facturación:</p><p><a href="${quoteUrl}" style="display:inline-block;padding:10px 20px;background:#e9473f;color:white;border-radius:8px;text-decoration:none;font-weight:500;">Ver presupuesto y rellenar datos</a></p><p>Gracias,<br>El equipo de Prototipalo</p>`,
      smtpConfig,
    }, { createdBy: profile.id });
  } catch {
    return { success: false, error: "Error al enviar el email" };
  }

  // Create estimate (presupuesto no vinculante) in Holded
  let holdedContactId = qr.holded_contact_id || null;
  let holdedEstimateId: string | null = null;

  try {
    // Find or create a basic contact in Holded from lead data
    if (!holdedContactId) {
      if (lead.email) {
        const existing = await searchContacts(lead.email);
        if (existing.length > 0) {
          holdedContactId = existing[0].id;
        }
      }
      if (!holdedContactId) {
        const newContact = await createContact({
          name: lead.full_name,
          email: lead.email || undefined,
        });
        holdedContactId = newContact.id;
      }
    }

    // Create estimate with the quote items
    const estimate = await createEstimate(holdedContactId, {
      items: items.map((item) => ({
        name: item.concept,
        units: item.units,
        subtotal: item.price,
        tax: item.tax,
      })),
      notes: qr.notes || undefined,
    });
    holdedEstimateId = estimate.id;
  } catch {
    // Holded failure should not block quote sending
  }

  // Update quote request status + Holded IDs
  const updateData: Record<string, unknown> = { status: "quote_sent" };
  if (holdedContactId) updateData.holded_contact_id = holdedContactId;
  if (holdedEstimateId) updateData.holded_estimate_id = holdedEstimateId;

  await supabase
    .from("quote_requests")
    .update(updateData)
    .eq("id", qr.id);

  // Update lead status to "quoted" (presupuestado)
  const { data: currentLead } = await supabase
    .from("leads")
    .select("status")
    .eq("id", leadId)
    .single();

  if (currentLead && currentLead.status !== "won") {
    await supabase
      .from("leads")
      .update({ status: "quoted" })
      .eq("id", leadId);

    await supabase.from("lead_activities").insert({
      lead_id: leadId,
      activity_type: "status_change",
      content: `Estado cambiado de ${currentLead.status} a quoted`,
      metadata: { old_status: currentLead.status, new_status: "quoted", auto: true },
      created_by: profile.id,
    });
  }

  // Log activity
  await supabase.from("lead_activities").insert({
    lead_id: leadId,
    activity_type: "email_sent",
    content: "Presupuesto enviado al cliente",
    metadata: {
      email_to: lead.email,
      email_subject: "Presupuesto — Prototipalo",
      quote_token: qr.token,
      ...(holdedEstimateId ? { holded_estimate_id: holdedEstimateId } : {}),
    },
    created_by: profile.id,
  });

  revalidatePath(`/dashboard/crm/${leadId}`);
  return { success: true, holdedEstimateId: holdedEstimateId || undefined };
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

  // Send email (or schedule if night hours)
  try {
    await sendEmailOrSchedule({
      to: lead.email,
      subject: "Datos de facturación — Prototipalo",
      text: `Hola ${lead.full_name},\n\nPara preparar tu presupuesto necesitamos tus datos de facturación.\n\nPor favor, rellena el siguiente formulario:\n${quoteUrl}\n\nGracias,\nEl equipo de Prototipalo`,
      html: `<p>Hola ${lead.full_name},</p><p>Para preparar tu presupuesto necesitamos tus datos de facturación.</p><p>Por favor, rellena el siguiente formulario:</p><p><a href="${quoteUrl}" style="display:inline-block;padding:10px 20px;background:#e9473f;color:white;border-radius:8px;text-decoration:none;font-weight:500;">Rellenar datos de facturación</a></p><p>Gracias,<br>El equipo de Prototipalo</p>`,
      smtpConfig,
    }, { createdBy: profile.id });
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

    // Send email with PDF attachment (or schedule if night hours)
    await sendEmailOrSchedule({
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
    }, { createdBy: profile.id });

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
