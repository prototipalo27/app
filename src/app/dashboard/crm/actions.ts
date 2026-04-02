"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { sendEmail, sendEmailOrSchedule, type SmtpConfig, type EmailAttachment } from "@/lib/email";
import { decrypt } from "@/lib/encryption";
import { createProforma, createEstimate, createInvoice, createContact, getContact, searchContacts, listContacts, listDocuments, getDocumentPdf, getDocument } from "@/lib/holded/api";
import type { HoldedDocument, HoldedContact } from "@/lib/holded/types";
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
    .maybeSingle();

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
  const ownedBy = (formData.get("owned_by") as string)?.trim() || profile.id;

  const estimatedQuantity = (formData.get("estimated_quantity") as string)?.trim() || null;
  const estimatedComplexity = (formData.get("estimated_complexity") as string)?.trim() || null;
  const estimatedUrgency = (formData.get("estimated_urgency") as string)?.trim() || null;
  const message = (formData.get("message") as string)?.trim() || null;

  const VALID_MANUAL_SOURCES = ["manual", "phone", "in_person", "email", "whatsapp"] as const;
  const rawSource = (formData.get("source") as string)?.trim() || "manual";
  const source = (VALID_MANUAL_SOURCES as readonly string[]).includes(rawSource) ? rawSource : "manual";

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
      source,
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

// ── Recurring client: New Order ──────────────────────────

export type ClientProduct = {
  concept: string;
  price: number;
  tax: number;
  lastUnits: number;
};

export type RecurringClient = {
  id: string;
  holdedContactId: string | null;
  fullName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  source: "crm" | "holded" | "both";
  products: ClientProduct[];
};

/** Get all clients (CRM won leads + Holded contacts) for "Nuevo pedido" */
export async function getRecurringClients(): Promise<RecurringClient[]> {
  await requireRole("manager");
  const supabase = await createClient();

  // Fetch CRM won leads + Holded contacts in parallel
  const [{ data: wonLeads }, holdedContacts] = await Promise.all([
    supabase.from("leads").select("id, full_name, company, email, phone").eq("status", "paid").order("updated_at", { ascending: false }),
    listContacts().catch(() => [] as HoldedContact[]),
  ]);

  // Get CRM quotes
  const allLeadIds = (wonLeads || []).map((l) => l.id);
  let crmQuotes: { id: string; lead_id: string; items: unknown; notes: string | null; created_at: string | null }[] = [];
  if (allLeadIds.length > 0) {
    const { data } = await supabase
      .from("quote_requests")
      .select("id, lead_id, items, notes, created_at")
      .in("lead_id", allLeadIds)
      .order("created_at", { ascending: false });
    crmQuotes = data || [];
  }

  // Helper: merge products into a map, keeping most recent price per concept
  function mergeProducts(productMap: Map<string, ClientProduct>, items: ProformaLineItem[]) {
    for (const item of items) {
      const key = item.concept.trim().toLowerCase();
      if (!productMap.has(key)) {
        productMap.set(key, {
          concept: item.concept.trim(),
          price: item.price,
          tax: item.tax,
          lastUnits: item.units,
        });
      }
    }
  }

  // Build client map keyed by email
  const clientMap = new Map<string, RecurringClient>();

  for (const l of wonLeads || []) {
    const key = l.email?.toLowerCase() || `lead_${l.id}`;
    if (clientMap.has(key)) continue;

    const leadQuotes = crmQuotes.filter((q) => q.lead_id === l.id);
    const productMap = new Map<string, ClientProduct>();
    for (const q of leadQuotes) {
      const items = (q.items || []) as unknown as ProformaLineItem[];
      mergeProducts(productMap, items);
    }

    clientMap.set(key, {
      id: l.id,
      holdedContactId: null,
      fullName: l.full_name,
      company: l.company,
      email: l.email,
      phone: l.phone,
      taxId: null,
      source: "crm",
      products: [...productMap.values()],
    });
  }

  // Merge Holded contacts
  for (const hc of holdedContacts) {
    if (hc.type !== "client") continue;
    const key = hc.email?.toLowerCase() || `holded_${hc.id}`;

    const existing = clientMap.get(key);
    if (existing) {
      existing.holdedContactId = hc.id;
      existing.taxId = hc.code || null;
      existing.source = "both";
    } else {
      clientMap.set(key, {
        id: `h_${hc.id}`,
        holdedContactId: hc.id,
        fullName: hc.name,
        company: hc.tradeName || null,
        email: hc.email || null,
        phone: hc.phone || hc.mobile || null,
        taxId: hc.code || null,
        source: "holded",
        products: [],
      });
    }
  }

  // Fetch Holded docs (all time) for clients with holdedContactId and extract products
  const clientsWithHolded = [...clientMap.values()].filter(
    (c) => c.holdedContactId
  );

  if (clientsWithHolded.length > 0) {
    const [proformas, invoices] = await Promise.all([
      listDocuments("proform").catch(() => []),
      listDocuments("invoice").catch(() => []),
    ]);

    const holdedIdSet = new Set(clientsWithHolded.map((c) => c.holdedContactId));
    // Group docs by contact, sorted newest first
    const docsByContact = new Map<string, HoldedDocument[]>();
    for (const doc of [...proformas, ...invoices].sort((a, b) => b.date - a.date)) {
      if (!holdedIdSet.has(doc.contact)) continue;
      if (!docsByContact.has(doc.contact)) docsByContact.set(doc.contact, []);
      docsByContact.get(doc.contact)!.push(doc);
    }

    for (const client of clientsWithHolded) {
      const docs = docsByContact.get(client.holdedContactId!) || [];
      const productMap = new Map<string, ClientProduct>();
      for (const doc of docs) {
        mergeProducts(productMap, doc.products.map((p) => ({
          concept: p.name,
          price: p.price,
          units: p.units,
          tax: p.tax,
        })));
      }
      // Merge with existing CRM products
      for (const [key, prod] of productMap) {
        const existing = client.products.find((p) => p.concept.trim().toLowerCase() === key);
        if (!existing) client.products.push(prod);
      }
    }
  }

  return [...clientMap.values()].sort((a, b) => {
    if (a.products.length > 0 && b.products.length === 0) return -1;
    if (b.products.length > 0 && a.products.length === 0) return 1;
    return a.fullName.localeCompare(b.fullName);
  });
}

/** Create a new lead (order) for a recurring client with selected products */
export async function createRepeatOrder(
  clientId: string,
  client: { fullName: string; company: string | null; email: string | null; phone: string | null; holdedContactId: string | null },
  items: ProformaLineItem[],
  message: string,
): Promise<{ success: boolean; error?: string; leadId?: string }> {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  // If client comes from CRM (not prefixed with h_), try to inherit owner/closer
  let ownedBy = profile.id;
  let assignedTo = profile.id;
  if (!clientId.startsWith("h_")) {
    const { data: source } = await supabase
      .from("leads")
      .select("owned_by, assigned_to")
      .eq("id", clientId)
      .single();
    if (source) {
      ownedBy = source.owned_by || profile.id;
      assignedTo = source.assigned_to || profile.id;
    }
  }

  const { data: newLead, error } = await supabase
    .from("leads")
    .insert({
      full_name: client.fullName,
      company: client.company,
      email: client.email,
      phone: client.phone,
      message: message || "Nuevo pedido (cliente recurrente)",
      source: "recurring",
      owned_by: ownedBy,
      assigned_to: assignedTo,
      status: "contacted",
    })
    .select("id")
    .single();

  if (error || !newLead) return { success: false, error: error?.message || "Error al crear lead" };

  // Create quote_request with selected products
  if (items.length > 0) {
    await supabase.from("quote_requests").insert({
      lead_id: newLead.id,
      items: items as unknown as import("@/lib/supabase/database.types").Json,
      holded_contact_id: client.holdedContactId,
      status: "pending",
    });
  }

  revalidatePath("/dashboard/crm");
  return { success: true, leadId: newLead.id };
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
/**
 * Retroactive step-based commission.
 * When the closer's total monthly billing crosses a tier threshold,
 * the new rate applies to the ENTIRE month's billing (retroactive).
 *
 * Example (tiers: 0-10K@6%, 10K-15K@7%):
 *   Lead 1: 8,000€ → total 8,000 → 6% → month commission = 480€
 *   Lead 2: 6,000€ → total 14,000 → 7% → month commission = 980€ (7% × 14,000)
 *   Lead 2's incremental = 980 - 480 = 500€ (not just 7% × 6,000 = 420€)
 *
 * Returns:
 *   - monthTotal: commission for the entire month at the new rate
 *   - effectiveRate: the tier rate that applies
 *   - incrementalCommission: how much this specific lead adds (monthTotal - prevMonthTotal)
 */
function calcTieredCommission(
  tiers: CommissionTier[],
  accumulatedBefore: number,
  quoteTotal: number
): { commission: number; effectiveRate: number; monthTotal: number } {
  const newTotal = accumulatedBefore + quoteTotal;
  const newRate = getCurrentTierRate(tiers, newTotal);
  const prevRate = getCurrentTierRate(tiers, accumulatedBefore);

  const newMonthTotal = newTotal * newRate;
  const prevMonthTotal = accumulatedBefore * prevRate;
  const incrementalCommission = newMonthTotal - prevMonthTotal;

  return {
    commission: incrementalCommission,
    effectiveRate: newRate,
    monthTotal: newMonthTotal,
  };
}

/**
 * Given a tiered config and a total billing amount, return the applicable tier rate.
 */
function getCurrentTierRate(tiers: CommissionTier[], totalBilling: number): number {
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  if (totalBilling <= 0) return sorted[0]?.rate ?? 0;
  let rate = sorted[0]?.rate ?? 0;
  for (const tier of sorted) {
    if (totalBilling > tier.min) {
      rate = tier.rate;
    }
  }
  return rate;
}

/**
 * Get the base (minimum) tier rate from a tiered config.
 */
function getBaseTierRate(tiers: CommissionTier[]): number {
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  return sorted[0]?.rate ?? 0;
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

  if (!lead || lead.status !== "paid") return null;

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
      .eq("status", "paid")
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
        .eq("status", "paid")
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
  attachProforma?: boolean,
  resourceAttachments?: { title: string; url: string }[],
  forceNow?: boolean
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

  // Attach resource files (from URLs — use Drive API for Google Drive files)
  if (resourceAttachments?.length) {
    if (!attachments) attachments = [];
    const { downloadFile } = await import("@/lib/google-drive/client");
    for (const res of resourceAttachments) {
      try {
        const driveMatch = res.url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
        if (driveMatch) {
          // Use authenticated Drive API for proper binary download
          const file = await downloadFile(driveMatch[1]);
          let filename = file.name || res.title.replace(/[^a-zA-Z0-9._\- ]/g, "");
          // Ensure filename has correct extension for Gmail preview
          const mimeToExt: Record<string, string> = {
            "application/pdf": ".pdf",
            "image/png": ".png",
            "image/jpeg": ".jpg",
            "image/svg+xml": ".svg",
          };
          const expectedExt = mimeToExt[file.mimeType];
          if (expectedExt && !filename.toLowerCase().endsWith(expectedExt)) {
            filename += expectedExt;
          }
          attachments.push({ filename, content: file.buffer, contentType: file.mimeType });
        } else {
          // Non-Drive URL: fetch directly
          const response = await fetch(res.url);
          if (!response.ok) continue;
          const buffer = Buffer.from(await response.arrayBuffer());
          const contentType = response.headers.get("content-type") || "application/octet-stream";
          const ext = contentType.includes("pdf") ? ".pdf"
            : contentType.includes("png") ? ".png"
            : contentType.includes("jpeg") || contentType.includes("jpg") ? ".jpg"
            : contentType.includes("svg") ? ".svg"
            : "";
          const filename = res.title.replace(/[^a-zA-Z0-9._\- ]/g, "") + ext;
          attachments.push({ filename, content: buffer, contentType });
        }
      } catch {
        // Non-fatal: skip failed downloads
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
    }, { createdBy: profile.id, leadId: id, forceNow });

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

  // Copy lead attachments to Briefing folder (fire-and-forget)
  copyLeadAttachmentsToBriefing(leadId, projectId, supabase).catch((err) => {
    console.error("[linkLeadToProject] Failed to copy attachments:", err);
  });

  revalidatePath(`/dashboard/crm/${leadId}`);
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

/** Copy lead attachment images to the project's Briefing folder in Drive */
async function copyLeadAttachmentsToBriefing(
  leadId: string,
  projectId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const { uploadFile } = await import("@/lib/google-drive/client");
  const { resolveSectionFolder } = await import("@/lib/google-drive/client");

  // Get lead attachments URL
  const { data: lead } = await supabase
    .from("leads")
    .select("attachments")
    .eq("id", leadId)
    .single();

  if (!lead?.attachments) return;

  // Get project Drive folder
  const { data: project } = await supabase
    .from("projects")
    .select("google_drive_folder_id")
    .eq("id", projectId)
    .single();

  if (!project?.google_drive_folder_id) return;

  const briefingFolderId = await resolveSectionFolder(project.google_drive_folder_id, "briefing");
  if (!briefingFolderId) return;

  // Parse attachment URLs (same logic as AttachmentGallery)
  const url = lead.attachments.trim();
  const groupMatch = url.match(/~(\d+)\/?$/);
  const fileCount = groupMatch ? parseInt(groupMatch[1]) : 0;
  const baseUrl = url.replace(/\/$/, "");

  const fileUrls =
    fileCount > 0
      ? Array.from({ length: fileCount }, (_, i) => `${baseUrl}/nth/${i}/`)
      : [url];

  // Download and upload each file
  for (let i = 0; i < fileUrls.length; i++) {
    try {
      const res = await fetch(fileUrls[i]);
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") || "image/jpeg";
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
      const fileName = `adjunto-lead-${i + 1}.${ext}`;

      await uploadFile(briefingFolderId, fileName, contentType, buffer);
    } catch (err) {
      console.error(`[copyLeadAttachmentsToBriefing] Failed to copy file ${i}:`, err);
    }
  }
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

  const ccString = await getCcString(qr.id, lead.email);

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

  const notesHtml = qr.notes
    ? `<p style="white-space:pre-line;">${qr.notes}</p>`
    : "";

  // Get per-user SMTP config
  const smtpConfig = await getUserSmtpConfig(profile.id);

  // Create estimate (presupuesto no vinculante) in Holded FIRST so we can attach its PDF
  let holdedContactId = qr.holded_contact_id || null;
  let holdedEstimateId: string | null = null;
  const emailAttachments: EmailAttachment[] = [];

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
  } catch (err) {
    console.error("[sendQuoteToClient] Holded estimate creation failed:", err);
  }

  // Download PDF from Holded and attach to email
  if (holdedEstimateId) {
    try {
      const pdfBuffer = await getDocumentPdf("estimate", holdedEstimateId);
      if (pdfBuffer && pdfBuffer.length > 0) {
        emailAttachments.push({
          filename: `Presupuesto-Prototipalo.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        });
      }
    } catch (err) {
      console.error("[sendQuoteToClient] Holded PDF download failed:", err);
    }
  }

  // Send email (or schedule if night hours)
  try {
    await sendEmailOrSchedule({
      to: lead.email,
      cc: ccString,
      subject: "Presupuesto — Prototipalo",
      text: `Hola ${lead.full_name},\n\nTe enviamos el presupuesto para tu proyecto.\n\nPuedes verlo y completar tus datos de facturación en el siguiente enlace:\n${quoteUrl}\n\nGracias,\nEl equipo de Prototipalo`,
      html: `<p>Hola ${lead.full_name},</p><p>Te enviamos el presupuesto para tu proyecto:</p>${itemsHtml}${notesHtml}<p>Para confirmar el presupuesto, necesitamos tus datos de facturación:</p><p><a href="${quoteUrl}" style="display:inline-block;padding:10px 20px;background:#e9473f;color:white;border-radius:8px;text-decoration:none;font-weight:500;">Ver presupuesto y rellenar datos</a></p><p>Gracias,<br>El equipo de Prototipalo</p>`,
      smtpConfig,
      attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
    }, { createdBy: profile.id });
  } catch {
    return { success: false, error: "Error al enviar el email" };
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

  if (currentLead && currentLead.status !== "won" && currentLead.status !== "paid") {
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

// ── Send NDA to Client ──────────────────────────────────

export async function sendNdaToClient(
  leadId: string,
): Promise<{ success: boolean; error?: string }> {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  // Get lead
  const { data: lead } = await supabase
    .from("leads")
    .select("email, full_name, company")
    .eq("id", leadId)
    .single();

  if (!lead?.email) {
    return { success: false, error: "El lead no tiene email" };
  }

  // Check if there's already a pending NDA
  const { data: existingNda } = await supabase
    .from("nda_agreements")
    .select("id, status")
    .eq("lead_id", leadId)
    .eq("status", "pending")
    .maybeSingle();

  if (existingNda) {
    return { success: false, error: "Ya hay un NDA pendiente de firma para este lead" };
  }

  // Create NDA record (token auto-generated by DB)
  const { data: nda, error: insertError } = await supabase
    .from("nda_agreements")
    .insert({
      lead_id: leadId,
      signer_email: lead.email,
      sent_by: profile.id,
    })
    .select("token")
    .single();

  if (insertError || !nda) {
    return { success: false, error: "Error al crear el NDA" };
  }

  // Build public URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://app.prototipalo.es";
  const ndaUrl = `${baseUrl}/nda/${nda.token}`;

  // Get per-user SMTP config
  const smtpConfig = await getUserSmtpConfig(profile.id);

  // Send email
  try {
    await sendEmailOrSchedule({
      to: lead.email,
      subject: "Acuerdo de confidencialidad — Prototipalo",
      text: `Hola ${lead.full_name},\n\nAntes de compartir información sobre tu proyecto, necesitamos formalizar un acuerdo de confidencialidad para proteger tus datos y diseños.\n\nEs un proceso rápido — solo tienes que rellenar tus datos y firmar:\n${ndaUrl}\n\nTu información estará protegida en todo momento.\n\nGracias,\nEl equipo de Prototipalo`,
      html: `
        <p>Hola ${lead.full_name},</p>
        <p>Antes de compartir información sobre tu proyecto, necesitamos formalizar un acuerdo de confidencialidad para <strong>proteger tus datos y diseños</strong>.</p>
        <p>Es un proceso rápido — solo tienes que rellenar tus datos y firmar:</p>
        <p>
          <a href="${ndaUrl}" style="display:inline-block;padding:12px 24px;background:#18181b;color:white;border-radius:8px;text-decoration:none;font-weight:500;">
            Firmar acuerdo de confidencialidad
          </a>
        </p>
        <p style="font-size:13px;color:#71717a;margin-top:16px;">Tu información estará protegida en todo momento.</p>
      `,
      smtpConfig,
    }, { createdBy: profile.id, leadId });
  } catch {
    // Rollback: delete the NDA if email fails
    await supabase.from("nda_agreements").delete().eq("token", nda.token);
    return { success: false, error: "Error al enviar el email" };
  }

  // Log activity
  await supabase.from("lead_activities").insert({
    lead_id: leadId,
    activity_type: "email_sent",
    content: "Acuerdo de confidencialidad enviado al cliente",
    metadata: {
      email_to: lead.email,
      email_subject: "Acuerdo de confidencialidad — Prototipalo",
      type: "nda_sent",
      nda_token: nda.token,
    },
    created_by: profile.id,
  });

  revalidatePath(`/dashboard/crm/${leadId}`);
  return { success: true };
}

export async function getNdaStatus(
  leadId: string,
): Promise<{ status: "none" | "pending" | "signed"; signed_at?: string; signer_name?: string }> {
  const supabase = await createClient();

  const { data: nda } = await supabase
    .from("nda_agreements")
    .select("status, signed_at, signer_name")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!nda) return { status: "none" };
  return {
    status: nda.status as "pending" | "signed",
    signed_at: nda.signed_at || undefined,
    signer_name: nda.signer_name || undefined,
  };
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

  const value = condition && ["50-50", "100-5", "cash"].includes(condition) ? condition : null;

  const { error } = await supabase
    .from("leads")
    .update({ payment_condition: value })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/crm/${id}`);
  return { success: true };
}

export async function updateDesiredDeliveryDate(
  id: string,
  date: string | null
): Promise<{ success: boolean; error?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("leads")
    .update({ desired_delivery_date: date || null })
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

/** Get PDF (base64) for a lead's document (estimate, proform, or invoice) */
export async function getLeadDocumentPdf(
  leadId: string,
  docType: "estimate" | "proform" | "invoice",
): Promise<{ success: boolean; base64?: string; error?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  const { data: qr } = await supabase
    .from("quote_requests")
    .select("holded_estimate_id, holded_proforma_id, holded_invoice_id")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!qr) return { success: false, error: "No hay presupuesto" };

  const docId =
    docType === "estimate" ? qr.holded_estimate_id :
    docType === "proform" ? qr.holded_proforma_id :
    qr.holded_invoice_id;

  if (!docId) return { success: false, error: `No hay ${docType === "estimate" ? "presupuesto" : docType === "proform" ? "proforma" : "factura"} vinculada` };

  try {
    const pdfBuffer = await getDocumentPdf(docType, docId);
    return { success: true, base64: pdfBuffer.toString("base64") };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Error al descargar el PDF" };
  }
}

export async function getInvoiceDetails(
  leadId: string,
): Promise<{ success: boolean; invoice?: HoldedDocument; error?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  const { data: qr } = await supabase
    .from("quote_requests")
    .select("holded_invoice_id")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!qr?.holded_invoice_id) {
    return { success: false, error: "No hay factura vinculada" };
  }

  try {
    const invoice = await getDocument("invoice", qr.holded_invoice_id);
    return { success: true, invoice };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Error al obtener la factura",
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

// ── Send Proforma to Client ─────────────────────────────

export async function sendProformaToClient(
  leadId: string,
): Promise<{ success: boolean; error?: string }> {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("email, full_name, company, payment_condition")
    .eq("id", leadId)
    .single();

  if (!lead?.email) {
    return { success: false, error: "El lead no tiene email" };
  }

  const { data: qr } = await supabase
    .from("quote_requests")
    .select("id, holded_contact_id, holded_proforma_id, items, notes, payment_option")
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

  const ccString = await getCcString(qr.id, lead.email);

  if (!qr.holded_contact_id) {
    return { success: false, error: "No hay contacto de Holded vinculado" };
  }

  // Create proforma in Holded if it doesn't exist yet
  let proformaId = qr.holded_proforma_id;
  if (!proformaId) {
    try {
      const proforma = await createProforma(qr.holded_contact_id, {
        items: items.map((item) => ({
          name: item.concept,
          units: item.units,
          subtotal: item.price,
          tax: item.tax,
        })),
        notes: qr.notes || undefined,
      });
      proformaId = proforma.id;
      await supabase
        .from("quote_requests")
        .update({ holded_proforma_id: proformaId })
        .eq("id", qr.id);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Error al crear la proforma" };
    }
  }

  // Fetch proforma details (docNumber) + download PDF in parallel
  let pdfBuffer: Buffer | null = null;
  let proformaDocNumber = "";
  try {
    const [pdf, proformaDoc] = await Promise.all([
      getDocumentPdf("proform", proformaId),
      getDocument("proform", proformaId),
    ]);
    pdfBuffer = pdf;
    proformaDocNumber = proformaDoc.docNumber || "";
  } catch (err) {
    console.error("[sendProformaToClient] PDF/doc fetch failed:", err);
    return { success: false, error: "Error al descargar la proforma de Holded" };
  }

  // Compute payment amount
  const isFull = lead.payment_condition === "100-5";
  const isSplit = lead.payment_condition === "50-50";
  const discountFactor = isFull ? 0.95 : 1;
  const subtotal = items.reduce((s, i) => s + i.price * i.units * discountFactor, 0);
  const taxTotal = items.reduce((s, i) => s + i.price * i.units * discountFactor * (i.tax / 100), 0);
  const total = subtotal + taxTotal;
  const payAmount = isSplit ? total * 0.5 : total;
  const formattedAmount = payAmount.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const proformaRef = proformaDocNumber ? ` ${proformaDocNumber}` : "";
  const paymentDesc = isSplit ? "primer pago (50%)" : isFull ? "pago total (100% con 5% dto.)" : "pago total";
  const conceptoLine = (isSplit ? "Prototipalo – Inicio de proyecto (50%)" : "Prototipalo – Proyecto completo") + (proformaDocNumber ? ` – ${proformaDocNumber}` : "");
  const introLine = isSplit
    ? `Te adjuntamos la factura proforma correspondiente, para proceder al <strong>primer pago (50%)</strong> necesario para iniciar la produccion.`
    : `Te adjuntamos la factura proforma correspondiente, para proceder al <strong>pago total</strong>${isFull ? " con un 5% de descuento por pago anticipado" : ""}.`;
  const introText = isSplit
    ? `Te adjuntamos la factura proforma correspondiente, para proceder al primer pago (50%) necesario para iniciar la produccion.`
    : `Te adjuntamos la factura proforma correspondiente, para proceder al pago total${isFull ? " con un 5% de descuento por pago anticipado" : ""}.`;

  // Create Stripe Checkout link for online payment option
  let stripeCheckoutUrl: string | null = null;
  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    const chargeAmount = Math.round(payAmount * 100);
    const productName = isSplit ? "Primer pago (50%) — Proyecto Prototipalo" : "Pago — Proyecto Prototipalo";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://app.prototipalo.es";

    const existingCust = lead?.email
      ? await stripe.customers.list({ email: lead.email, limit: 1 })
      : { data: [] };
    const stripeCust = existingCust.data.length > 0
      ? existingCust.data[0]
      : await stripe.customers.create({ email: lead?.email || undefined, name: lead?.full_name || undefined });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: { currency: "eur", product_data: { name: productName }, unit_amount: chargeAmount },
        quantity: 1,
      }],
      metadata: { lead_id: leadId, quote_request_id: qr.id, payment_type: isSplit ? "split_50" : "full" },
      success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/payment/cancel`,
      customer: stripeCust.id,
    });

    stripeCheckoutUrl = session.url;
    await supabase
      .from("quote_requests")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", qr.id);
  } catch (err) {
    console.error("[sendProformaToClient] Stripe checkout failed:", err);
  }

  // Build email with both payment options
  const smtpConfig = await getUserSmtpConfig(profile.id);

  const onlinePayText = stripeCheckoutUrl
    ? `\n\nTambien puedes completar el pago de forma rapida mediante tarjeta:\n${stripeCheckoutUrl}`
    : "";

  try {
    await sendEmailOrSchedule({
      to: lead.email,
      cc: ccString,
      subject: `Proforma${proformaRef} — Prototipalo`,
      text: `Hola ${lead.full_name},\n\nMuchas gracias por confirmar el proyecto — estamos listos para empezar.\n\n${introText}\n\nImporte: ${formattedAmount} €\nConcepto: ${conceptoLine}\n\nPuedes realizar el pago mediante transferencia bancaria utilizando la referencia indicada:\n\nBanco: BBVA\nTitular: Prototipalo\nIBAN: ES24 0182 4010 3502 0181 5556\nSWIFT/BIC: BBVAESMM${onlinePayText}\n\nUna vez recibido el pago, comenzaremos la produccion de inmediato y te mantendremos informado del avance del proyecto.\n\nQuedamos atentos a cualquier duda.`,
      html: `
        <p>Hola ${lead.full_name},</p>
        <p>Muchas gracias por confirmar el proyecto — estamos listos para empezar.</p>
        <p>${introLine}</p>
        <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:12px 0 20px;font-size:14px;line-height:1.8;">
          <tr><td style="padding:0 16px 0 0;color:#71717a;white-space:nowrap;">Importe</td><td style="padding:0;font-weight:600;">${formattedAmount} €</td></tr>
          <tr><td style="padding:0 16px 0 0;color:#71717a;white-space:nowrap;">Concepto</td><td style="padding:0;font-weight:600;">${conceptoLine}</td></tr>
        </table>
        <p>Puedes realizar el pago mediante <strong>transferencia bancaria</strong> utilizando la referencia indicada:</p>
        <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:12px 0 20px;font-size:14px;line-height:1.8;">
          <tr><td style="padding:0 16px 0 0;color:#71717a;white-space:nowrap;">Banco</td><td style="padding:0;font-weight:600;">BBVA</td></tr>
          <tr><td style="padding:0 16px 0 0;color:#71717a;white-space:nowrap;">Titular</td><td style="padding:0;font-weight:600;">Prototipalo</td></tr>
          <tr><td style="padding:0 16px 0 0;color:#71717a;white-space:nowrap;">IBAN</td><td style="padding:0;font-weight:600;">ES24 0182 4010 3502 0181 5556</td></tr>
          <tr><td style="padding:0 16px 0 0;color:#71717a;white-space:nowrap;">SWIFT/BIC</td><td style="padding:0;font-weight:600;">BBVAESMM</td></tr>
        </table>
        <p>Tambien puedes completar el pago de forma rapida mediante tarjeta a traves del siguiente enlace:</p>
        ${stripeCheckoutUrl ? `<p style="margin:16px 0;"><a href="${stripeCheckoutUrl}" style="display:inline-block;padding:14px 28px;background:#e9473f;color:white;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Pagar con tarjeta</a></p>` : ""}
        <p>Una vez recibido el pago, comenzaremos la produccion de inmediato y te mantendremos informado del avance del proyecto.</p>
        <p>Quedamos atentos a cualquier duda.</p>
      `,
      smtpConfig,
      attachments: pdfBuffer && pdfBuffer.length > 0
        ? [{ filename: `Proforma${proformaRef.replace(/\s/g, "-")}-Prototipalo.pdf`, content: pdfBuffer, contentType: "application/pdf" }]
        : undefined,
    }, { createdBy: profile.id });
  } catch {
    return { success: false, error: "Error al enviar el email" };
  }

  // Log activity
  await supabase.from("lead_activities").insert({
    lead_id: leadId,
    activity_type: "email_sent",
    content: `Proforma${proformaRef} enviada al cliente`,
    metadata: {
      email_to: lead.email,
      email_subject: "Proforma — Prototipalo",
      holded_proforma_id: proformaId,
    },
    created_by: profile.id,
  });

  revalidatePath(`/dashboard/crm/${leadId}`);
  return { success: true };
}

// ── Send Invoice to Client ──────────────────────────────

export async function sendInvoiceToClient(
  leadId: string,
): Promise<{ success: boolean; error?: string }> {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("email, full_name")
    .eq("id", leadId)
    .single();

  if (!lead?.email) {
    return { success: false, error: "El lead no tiene email" };
  }

  const { data: qr } = await supabase
    .from("quote_requests")
    .select("id, holded_contact_id, holded_invoice_id, items, notes")
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

  const ccString = await getCcString(qr.id, lead.email);

  if (!qr.holded_contact_id) {
    return { success: false, error: "No hay contacto de Holded vinculado" };
  }

  // Create invoice in Holded if it doesn't exist yet
  let invoiceId = qr.holded_invoice_id;
  if (!invoiceId) {
    try {
      const invoice = await createInvoice(qr.holded_contact_id, {
        items: items.map((item) => ({
          name: item.concept,
          units: item.units,
          subtotal: item.price,
          tax: item.tax,
        })),
        notes: qr.notes || undefined,
      });
      invoiceId = invoice.id;
      await supabase
        .from("quote_requests")
        .update({ holded_invoice_id: invoiceId })
        .eq("id", qr.id);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Error al crear la factura" };
    }
  }

  // Download PDF
  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await getDocumentPdf("invoice", invoiceId);
  } catch (err) {
    console.error("[sendInvoiceToClient] PDF download failed:", err);
    return { success: false, error: "Error al descargar el PDF de la factura" };
  }

  // Send email
  const smtpConfig = await getUserSmtpConfig(profile.id);
  try {
    await sendEmailOrSchedule({
      to: lead.email,
      cc: ccString,
      subject: "Factura — Prototipalo",
      text: `Hola ${lead.full_name},\n\nTe adjuntamos la factura correspondiente a tu proyecto.\n\nGracias,\nEl equipo de Prototipalo`,
      html: `<p>Hola ${lead.full_name},</p><p>Te adjuntamos la factura correspondiente a tu proyecto.</p><p>Gracias,<br>El equipo de Prototipalo</p>`,
      smtpConfig,
      attachments: pdfBuffer && pdfBuffer.length > 0
        ? [{ filename: "Factura-Prototipalo.pdf", content: pdfBuffer, contentType: "application/pdf" }]
        : undefined,
    }, { createdBy: profile.id });
  } catch {
    return { success: false, error: "Error al enviar el email" };
  }

  // Log activity
  await supabase.from("lead_activities").insert({
    lead_id: leadId,
    activity_type: "email_sent",
    content: "Factura enviada al cliente",
    metadata: {
      email_to: lead.email,
      email_subject: "Factura — Prototipalo",
      holded_invoice_id: invoiceId,
    },
    created_by: profile.id,
  });

  revalidatePath(`/dashboard/crm/${leadId}`);
  return { success: true };
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

// ── My Commission Preview (incentive widget per logged-in user) ─────
//
// Commission model:
//   - Captador (owned_by, flat config): e.g. 15% new / 7.5% returning
//   - Closer (assigned_to, tiered config): e.g. 6/7/8/9/10% by monthly volume
//   - When the closer's rate exceeds the base tier (6%), the excess is
//     deducted from the captador's rate on the same lead.
//     E.g. closer at 8% → captador gets 15% - (8%-6%) = 13%

export type CommissionPreview = {
  ownerId: string;
  ownerName: string;
  monthlyBilled: number;
  monthlyCommission: number;
  configType: "flat" | "tiered";
  /** Current effective commission rate */
  currentRate: number;
};

/**
 * For a closer with tiered config, get their monthly accumulated billing
 * so we can calculate what tier they're in (and how much to deduct from captador).
 */
async function getCloserAccumulated(
  supabase: any,
  closerId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const { data: closerLeads } = await supabase
    .from("leads")
    .select("id")
    .eq("status", "paid")
    .eq("assigned_to", closerId)
    .gte("updated_at", startDate)
    .lt("updated_at", endDate);

  if (!closerLeads || closerLeads.length === 0) return 0;

  const { data: quotes } = await supabase
    .from("quote_requests")
    .select("lead_id, items")
    .in("lead_id", closerLeads.map((l: any) => l.id));

  let total = 0;
  for (const q of quotes || []) {
    const items = (q.items || []) as unknown as ProformaLineItem[];
    total += items.reduce((s, i) => s + i.price * i.units, 0);
  }
  return total;
}

/**
 * Get the logged-in user's commission preview for the current month.
 */
export async function getMyCommissionPreview(): Promise<CommissionPreview | null> {
  const profile = await requireRole("comercial");
  const supabase = await createClient();

  const { data: config } = await (supabase as any)
    .from("commission_configs")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle();

  if (!config) return null;

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  // Tiered = closer (assigned_to), Flat = captador (owned_by)
  const roleField = config.type === "tiered" ? "assigned_to" : "owned_by";

  const { data: wonLeads } = await supabase
    .from("leads")
    .select("id, owned_by, assigned_to, email, created_at, payment_condition")
    .eq("status", "paid")
    .eq(roleField, profile.id)
    .gte("updated_at", startDate)
    .lt("updated_at", endDate)
    .order("updated_at", { ascending: true });

  const leadIds = (wonLeads || []).map((l) => l.id);
  const quoteMap = new Map<string, number>();
  if (leadIds.length > 0) {
    const { data: quotes } = await supabase
      .from("quote_requests")
      .select("lead_id, items")
      .in("lead_id", leadIds);
    for (const q of quotes || []) {
      const items = (q.items || []) as unknown as ProformaLineItem[];
      quoteMap.set(q.lead_id, items.reduce((sum, i) => sum + i.price * i.units, 0));
    }
  }

  // For flat captadores: we need to know if there's a closer with tiered config
  // on each lead, so we can deduct the closer's excess from our rate.
  let closerConfigs = new Map<string, any>();
  let closerAccumulatedMap = new Map<string, number>();

  if (config.type === "flat") {
    // Find all unique closers (assigned_to) on our won leads
    const closerIds = [...new Set(
      (wonLeads || []).map((l) => l.assigned_to).filter(Boolean)
    )] as string[];

    if (closerIds.length > 0) {
      const { data: configs } = await (supabase as any)
        .from("commission_configs")
        .select("*")
        .in("user_id", closerIds)
        .eq("type", "tiered");

      for (const c of configs || []) {
        closerConfigs.set(c.user_id, c);
      }

      // Get each closer's accumulated billing this month (for tier calculation)
      for (const closerId of closerIds) {
        if (closerConfigs.has(closerId)) {
          const acc = await getCloserAccumulated(supabase, closerId, startDate, endDate);
          closerAccumulatedMap.set(closerId, acc);
        }
      }
    }
  }

  // Sum total billing from quotes
  let monthlyBilled = 0;
  let monthlyPrepaidBonus = 0;
  for (const lead of wonLeads || []) {
    const qt = quoteMap.get(lead.id) ?? 0;
    if (qt === 0) continue;
    monthlyBilled += qt;
    const isPrepaid = lead.payment_condition === "100-5";
    if (isPrepaid) monthlyPrepaidBonus += qt * Number(config.prepaid_bonus ?? 0.01);
  }

  let monthlyCommission: number;
  let currentRate: number;

  if (config.type === "tiered") {
    // Closer: retroactive model — rate × total month billing
    const tiers = (config.tiers || []) as CommissionTier[];
    currentRate = getCurrentTierRate(tiers, monthlyBilled);
    monthlyCommission = monthlyBilled * currentRate + monthlyPrepaidBonus;
  } else {
    // Captador: per-lead calculation with closer deduction
    monthlyCommission = 0;
    currentRate = Number(config.new_rate);

    for (const lead of wonLeads || []) {
      const qt = quoteMap.get(lead.id) ?? 0;
      if (qt === 0) continue;

      const isPrepaid = lead.payment_condition === "100-5";
      const prepaidBonus = isPrepaid ? qt * Number(config.prepaid_bonus ?? 0.01) : 0;

      let isReturning = false;
      if (lead.email) {
        const { count } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .ilike("email", lead.email)
          .eq("status", "paid")
          .neq("id", lead.id)
          .lt("created_at", lead.created_at);
        isReturning = (count ?? 0) > 0;
      }

      let rate = isReturning ? Number(config.returning_rate) : Number(config.new_rate);

      // Deduct closer's excess above base tier
      const closerId = lead.assigned_to;
      if (closerId) {
        const closerConfig = closerConfigs.get(closerId);
        if (closerConfig) {
          const closerTiers = (closerConfig.tiers || []) as CommissionTier[];
          const closerBaseRate = getBaseTierRate(closerTiers);
          // Use the closer's TOTAL month accumulated to determine their tier
          const closerAcc = closerAccumulatedMap.get(closerId) ?? 0;
          const closerCurrentRate = getCurrentTierRate(closerTiers, closerAcc);
          const excess = closerCurrentRate - closerBaseRate;
          rate = Math.max(0, rate - excess);
        }
      }

      monthlyCommission += qt * rate + prepaidBonus;
    }

    // Adjust displayed current rate with closer deduction
    if (closerConfigs.size > 0) {
      const [firstCloserId, firstCloserConfig] = [...closerConfigs.entries()][0];
      const closerTiers = (firstCloserConfig.tiers || []) as CommissionTier[];
      const closerBaseRate = getBaseTierRate(closerTiers);
      const closerAcc = closerAccumulatedMap.get(firstCloserId) ?? 0;
      const closerCurrentRate = getCurrentTierRate(closerTiers, closerAcc);
      currentRate = Math.max(0, currentRate - (closerCurrentRate - closerBaseRate));
    }
  }

  return {
    ownerId: profile.id,
    ownerName: profile.email.split("@")[0],
    monthlyBilled,
    monthlyCommission,
    configType: config.type as "flat" | "tiered",
    currentRate,
  };
}

/**
 * Combined: get preview + estimate in a single call (avoids duplicate queries).
 * If estimatedValue is provided, also returns the incremental commission estimate.
 */
export async function getMyCommissionData(estimatedValue?: number | null): Promise<{
  preview: CommissionPreview;
  estimate: { commission: number; rate: number } | null;
} | null> {
  const profile = await requireRole("comercial");
  const supabase = await createClient();

  const { data: config } = await (supabase as any)
    .from("commission_configs")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle();

  if (!config) return null;

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const roleField = config.type === "tiered" ? "assigned_to" : "owned_by";

  const { data: wonLeads } = await supabase
    .from("leads")
    .select("id, owned_by, assigned_to, email, created_at, payment_condition")
    .eq("status", "paid")
    .eq(roleField, profile.id)
    .gte("updated_at", startDate)
    .lt("updated_at", endDate)
    .order("updated_at", { ascending: true });

  const leadIds = (wonLeads || []).map((l) => l.id);
  const quoteMap = new Map<string, number>();
  if (leadIds.length > 0) {
    const { data: quotes } = await supabase
      .from("quote_requests")
      .select("lead_id, items")
      .in("lead_id", leadIds);
    for (const q of quotes || []) {
      const items = (q.items || []) as unknown as ProformaLineItem[];
      quoteMap.set(q.lead_id, items.reduce((sum, i) => sum + i.price * i.units, 0));
    }
  }

  let closerConfigs = new Map<string, any>();
  let closerAccumulatedMap = new Map<string, number>();

  if (config.type === "flat") {
    const closerIds = [...new Set(
      (wonLeads || []).map((l) => l.assigned_to).filter(Boolean)
    )] as string[];

    if (closerIds.length > 0) {
      const { data: configs } = await (supabase as any)
        .from("commission_configs")
        .select("*")
        .in("user_id", closerIds)
        .eq("type", "tiered");

      for (const c of configs || []) closerConfigs.set(c.user_id, c);

      // Parallelize closer accumulated queries
      const closerAccResults = await Promise.all(
        closerIds
          .filter((cid) => closerConfigs.has(cid))
          .map(async (cid) => ({ id: cid, acc: await getCloserAccumulated(supabase, cid, startDate, endDate) }))
      );
      for (const r of closerAccResults) closerAccumulatedMap.set(r.id, r.acc);
    }
  }

  let monthlyBilled = 0;
  let monthlyPrepaidBonus = 0;
  for (const lead of wonLeads || []) {
    const qt = quoteMap.get(lead.id) ?? 0;
    if (qt === 0) continue;
    monthlyBilled += qt;
    const isPrepaid = lead.payment_condition === "100-5";
    if (isPrepaid) monthlyPrepaidBonus += qt * Number(config.prepaid_bonus ?? 0.01);
  }

  let monthlyCommission: number;
  let currentRate: number;

  if (config.type === "tiered") {
    const tiers = (config.tiers || []) as CommissionTier[];
    currentRate = getCurrentTierRate(tiers, monthlyBilled);
    monthlyCommission = monthlyBilled * currentRate + monthlyPrepaidBonus;
  } else {
    monthlyCommission = 0;
    currentRate = Number(config.new_rate);

    for (const lead of wonLeads || []) {
      const qt = quoteMap.get(lead.id) ?? 0;
      if (qt === 0) continue;

      const isPrepaid = lead.payment_condition === "100-5";
      const prepaidBonus = isPrepaid ? qt * Number(config.prepaid_bonus ?? 0.01) : 0;

      let isReturning = false;
      if (lead.email) {
        const { count } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .ilike("email", lead.email)
          .eq("status", "paid")
          .neq("id", lead.id)
          .lt("created_at", lead.created_at);
        isReturning = (count ?? 0) > 0;
      }

      let rate = isReturning ? Number(config.returning_rate) : Number(config.new_rate);

      const closerId = lead.assigned_to;
      if (closerId) {
        const closerConfig = closerConfigs.get(closerId);
        if (closerConfig) {
          const closerTiers = (closerConfig.tiers || []) as CommissionTier[];
          const closerBaseRate = getBaseTierRate(closerTiers);
          const closerAcc = closerAccumulatedMap.get(closerId) ?? 0;
          const closerCurrentRate = getCurrentTierRate(closerTiers, closerAcc);
          rate = Math.max(0, rate - (closerCurrentRate - closerBaseRate));
        }
      }

      monthlyCommission += qt * rate + prepaidBonus;
    }

    if (closerConfigs.size > 0) {
      const [firstCloserId, firstCloserConfig] = [...closerConfigs.entries()][0];
      const closerTiers = (firstCloserConfig.tiers || []) as CommissionTier[];
      const closerBaseRate = getBaseTierRate(closerTiers);
      const closerAcc = closerAccumulatedMap.get(firstCloserId) ?? 0;
      const closerCurrentRate = getCurrentTierRate(closerTiers, closerAcc);
      currentRate = Math.max(0, currentRate - (closerCurrentRate - closerBaseRate));
    }
  }

  const preview: CommissionPreview = {
    ownerId: profile.id,
    ownerName: profile.email.split("@")[0],
    monthlyBilled,
    monthlyCommission,
    configType: config.type as "flat" | "tiered",
    currentRate,
  };

  // Estimate for a specific lead value (reuses data already fetched)
  let estimate: { commission: number; rate: number } | null = null;
  if (estimatedValue && estimatedValue > 0) {
    if (config.type === "tiered") {
      const tiers = (config.tiers || []) as CommissionTier[];
      const { commission, effectiveRate } = calcTieredCommission(tiers, monthlyBilled, estimatedValue);
      estimate = { commission, rate: effectiveRate };
    } else {
      estimate = { commission: estimatedValue * currentRate, rate: currentRate };
    }
  }

  return { preview, estimate };
}

// ── Search & Link Holded Invoice ─────────────────────────

export async function searchHoldedInvoices(
  query: string,
): Promise<{ id: string; docNumber: string; contactName: string; total: number; date: number }[]> {
  await requireRole("manager");

  const invoices = await listDocuments("invoice");
  const q = query.toLowerCase();

  return invoices
    .filter((inv) =>
      inv.contactName?.toLowerCase().includes(q) ||
      inv.docNumber?.toLowerCase().includes(q)
    )
    .slice(0, 15)
    .map((inv) => ({
      id: inv.id,
      docNumber: inv.docNumber,
      contactName: inv.contactName,
      total: inv.total,
      date: inv.date,
    }));
}

export async function linkInvoiceToLead(
  leadId: string,
  invoiceId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  // Get the invoice from Holded
  const invoice = await getDocument("invoice", invoiceId);

  // Build items from invoice products
  const items = invoice.products.map((p) => ({
    concept: p.name,
    price: p.price,
    units: p.units,
    tax: p.tax,
  }));

  // Check if quote_request already exists for this lead
  const { data: existing } = await supabase
    .from("quote_requests")
    .select("id")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    // Update existing quote_request
    await supabase
      .from("quote_requests")
      .update({
        holded_invoice_id: invoiceId,
        holded_contact_id: invoice.contact,
        items: items as unknown as import("@/lib/supabase/database.types").Json,
        payment_status: "paid",
        paid_at: new Date(invoice.date * 1000).toISOString(),
        paid_amount: invoice.total,
      })
      .eq("id", existing.id);
  } else {
    // Create new quote_request
    await supabase.from("quote_requests").insert({
      lead_id: leadId,
      holded_invoice_id: invoiceId,
      holded_contact_id: invoice.contact,
      items: items as unknown as import("@/lib/supabase/database.types").Json,
      status: "submitted",
      payment_status: "paid",
      paid_at: new Date(invoice.date * 1000).toISOString(),
      paid_amount: invoice.total,
    });
  }

  // Update lead estimated_value with invoice total (subtotal without tax)
  await supabase
    .from("leads")
    .update({ estimated_value: invoice.subtotal })
    .eq("id", leadId);

  // Log activity
  await supabase.from("lead_activities").insert({
    lead_id: leadId,
    activity_type: "note",
    content: `Factura ${invoice.docNumber} vinculada (${invoice.total.toFixed(2)} €)`,
    metadata: { holded_invoice_id: invoiceId, doc_number: invoice.docNumber },
  });

  revalidatePath(`/dashboard/crm/${leadId}`);
  return { success: true };
}

// ── Stripe Checkout ─────────────────────────────────────

export async function createStripeCheckout(
  leadId: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  const { data: qr } = await supabase
    .from("quote_requests")
    .select("id, items, notes, payment_option, holded_contact_id, holded_proforma_id, stripe_checkout_session_id")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!qr) return { success: false, error: "No hay presupuesto" };

  const items = (qr.items || []) as unknown as ProformaLineItem[];
  if (items.length === 0) return { success: false, error: "Sin líneas de presupuesto" };

  const { data: lead } = await supabase
    .from("leads")
    .select("email, full_name")
    .eq("id", leadId)
    .single();

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const isFull = qr.payment_option === "full";
  const discountFactor = isFull ? 0.95 : 1;
  const isSplit = qr.payment_option === "split";

  // Calculate total in cents
  const subtotal = items.reduce((s, i) => s + i.price * i.units * discountFactor, 0);
  const chargeAmount = Math.round((isSplit ? subtotal * 0.5 : subtotal) * 100);

  const label = isSplit
    ? "Primer pago (50%) — Proyecto Prototipalo"
    : "Pago — Proyecto Prototipalo";

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://app.prototipalo.es";

  const baseParams = {
    mode: "payment" as const,
    line_items: [{
      price_data: { currency: "eur", product_data: { name: label }, unit_amount: chargeAmount },
      quantity: 1,
    }],
    metadata: { lead_id: leadId, quote_request_id: qr.id, payment_type: isSplit ? "split_50" : "full" },
    success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/payment/cancel`,
  };

  const existingCustomers = lead?.email
    ? await stripe.customers.list({ email: lead.email, limit: 1 })
    : { data: [] };
  const stripeCustomer = existingCustomers.data.length > 0
    ? existingCustomers.data[0]
    : await stripe.customers.create({ email: lead?.email || undefined, name: lead?.full_name || undefined });

  const session = await stripe.checkout.sessions.create({
    ...baseParams,
    customer: stripeCustomer.id,
  });

  await supabase
    .from("quote_requests")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", qr.id);

  revalidatePath(`/dashboard/crm/${leadId}`);
  return { success: true, url: session.url! };
}

// ── On Payment Confirmed (auto-pipeline) ────────────────

export async function onPaymentConfirmed(
  quoteRequestId: string,
  { useServiceRole = false }: { useServiceRole?: boolean } = {},
): Promise<{ success: boolean; error?: string; projectId?: string }> {
  const supabase = useServiceRole ? createServiceClient() : await createClient();

  // Get quote request with lead data
  const { data: qr } = await supabase
    .from("quote_requests")
    .select("*, leads(id, full_name, company, email, phone, attachments, message)")
    .eq("id", quoteRequestId)
    .single();

  if (!qr) return { success: false, error: "Quote request not found" };

  const lead = qr.leads as unknown as {
    id: string; full_name: string; company: string | null;
    email: string | null; phone: string | null; attachments: string | null; message: string | null;
  };

  const items = (qr.items || []) as unknown as ProformaLineItem[];

  // 1. Create invoice in Holded
  let invoiceId = qr.holded_invoice_id;
  if (!invoiceId && qr.holded_contact_id) {
    try {
      const invoice = await createInvoice(qr.holded_contact_id, {
        items: items.map((item) => ({
          name: item.concept,
          units: item.units,
          subtotal: item.price,
          tax: item.tax,
        })),
        notes: qr.notes || undefined,
      });
      invoiceId = invoice.id;
      await supabase
        .from("quote_requests")
        .update({ holded_invoice_id: invoiceId })
        .eq("id", qr.id);
    } catch (e) {
      console.error("[onPaymentConfirmed] Invoice creation failed:", e);
    }
  }

  // 2. Send invoice by email
  if (invoiceId && lead.email) {
    try {
      const pdfBuffer = await getDocumentPdf("invoice", invoiceId);
      await sendEmailOrSchedule({
        to: lead.email,
        subject: "Factura — Prototipalo",
        text: `Hola ${lead.full_name},\n\nTe adjuntamos la factura correspondiente a tu proyecto.\n\nGracias,\nEl equipo de Prototipalo`,
        html: `<p>Hola ${lead.full_name},</p><p>Te adjuntamos la factura correspondiente a tu proyecto.</p><p>Gracias,<br>El equipo de Prototipalo</p>`,
        attachments: pdfBuffer && pdfBuffer.length > 0
          ? [{ filename: "Factura-Prototipalo.pdf", content: pdfBuffer, contentType: "application/pdf" }]
          : undefined,
      });
    } catch (e) {
      console.error("[onPaymentConfirmed] Invoice email failed:", e);
    }
  }

  // 3. Create project
  const projectName = lead.company || lead.full_name;
  const { data: newProject, error: projectError } = await supabase
    .from("projects")
    .insert({
      name: projectName,
      description: lead.message || null,
      project_type: "confirmed",
      status: "pending",
      lead_id: lead.id,
      holded_contact_id: qr.holded_contact_id,
      holded_invoice_id: invoiceId,
      client_name: lead.full_name,
      client_email: lead.email,
    })
    .select("id")
    .single();

  if (projectError) {
    console.error("[onPaymentConfirmed] Project creation failed:", projectError);
    return { success: false, error: projectError.message };
  }

  // 4. Copy lead attachments to Briefing (fire-and-forget)
  if (lead.attachments && newProject) {
    copyLeadAttachmentsToBriefing(lead.id, newProject.id, supabase).catch((err) => {
      console.error("[onPaymentConfirmed] Attachment copy failed:", err);
    });
  }

  // 5. Change lead to "paid"
  await supabase
    .from("leads")
    .update({ status: "paid" })
    .eq("id", lead.id);

  // 6. Log activity
  await supabase.from("lead_activities").insert({
    lead_id: lead.id,
    activity_type: "status_change",
    content: "Pago confirmado. Factura enviada y proyecto creado automaticamente.",
    metadata: {
      old_status: "won",
      new_status: "paid",
      auto: true,
      project_id: newProject.id,
      holded_invoice_id: invoiceId,
    },
  });

  revalidatePath(`/dashboard/crm/${lead.id}`);
  revalidatePath("/dashboard");
  return { success: true, projectId: newProject.id };
}

// ── Mark as Paid (manual transfer) ──────────────────────

export async function markAsPaid(
  leadId: string,
): Promise<{ success: boolean; error?: string; projectId?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  const { data: qr } = await supabase
    .from("quote_requests")
    .select("id, items, payment_option")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!qr) return { success: false, error: "No hay presupuesto" };

  const items = (qr.items || []) as unknown as ProformaLineItem[];
  const isFull = qr.payment_option === "full";
  const discountFactor = isFull ? 0.95 : 1;
  const total = items.reduce((s, i) => s + i.price * i.units * discountFactor, 0);

  await supabase
    .from("quote_requests")
    .update({
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      paid_amount: total,
    })
    .eq("id", qr.id);

  const result = await onPaymentConfirmed(qr.id);
  return result;
}

// ── Update CC Emails on Quote Request ─────────────────────

export async function updateQuoteCcEmails(
  quoteRequestId: string,
  ccEmails: { email: string; label: string }[],
): Promise<{ success: boolean; error?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("quote_requests")
    .update({ cc_emails: ccEmails } as any)
    .eq("id", quoteRequestId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get CC email string from a quote request's cc_emails JSONB field.
 * Excludes the primary lead email to avoid duplicates.
 * Note: cc_emails column is not yet in generated types, so we query separately.
 */
async function getCcString(
  quoteRequestId: string,
  leadEmail: string,
): Promise<string | undefined> {
  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from("quote_requests")
    .select("cc_emails")
    .eq("id", quoteRequestId)
    .single();

  const raw = data?.cc_emails;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const emails = raw
    .map((e: { email: string }) => e.email?.trim().toLowerCase())
    .filter((e: string) => e && e !== leadEmail.toLowerCase());
  return emails.length > 0 ? emails.join(", ") : undefined;
}
