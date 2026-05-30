"use server";

import Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { getDocument } from "@/lib/holded/api";

export interface PayoutCharge {
  chargeId: string;
  paymentIntentId: string | null;
  amount: number;       // gross, EUR
  fee: number;          // Stripe fee, EUR
  net: number;          // amount - fee
  created: number;      // unix seconds
  customerEmail: string | null;
  customerName: string | null;
  description: string | null;
  leadId: string | null;
  quoteRequestId: string | null;
  holdedInvoiceId: string | null;
  invoiceDocNumber: string | null;
  invoiceTotal: number | null;
}

export interface PayoutRow {
  id: string;
  arrivalDate: number;  // unix seconds
  amount: number;       // net amount deposited at BBVA, EUR
  status: string;       // paid | pending | in_transit | failed | canceled
  description: string | null;
  totalGross: number;
  totalFees: number;
  charges: PayoutCharge[];
  reconciled: boolean;
  reconciledAt: string | null;
  reconciledBy: string | null;
}

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!);

/** Convert Stripe minor units (cents) to EUR with 2 decimals. */
function cents(n: number | null | undefined): number {
  return n ? Math.round(n) / 100 : 0;
}

/**
 * Pulls Stripe payouts from the last `daysBack` days, expands each into the
 * charges it contains, and joins those charges with our quote_requests +
 * Holded invoice numbers so the reconciliation page has everything ready.
 */
export async function getPayoutsWithCharges(daysBack = 60): Promise<PayoutRow[]> {
  await requireRole("manager");

  const sinceSec = Math.floor((Date.now() - daysBack * 86400_000) / 1000);

  // 1. List payouts in window.
  const payouts: Stripe.Payout[] = [];
  let starting_after: string | undefined;
  // Cap iterations to avoid runaway loops in case of API anomalies.
  for (let i = 0; i < 10; i++) {
    const page = await stripeClient.payouts.list({
      limit: 100,
      arrival_date: { gte: sinceSec },
      ...(starting_after ? { starting_after } : {}),
    });
    payouts.push(...page.data);
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1]?.id;
    if (!starting_after) break;
  }

  if (payouts.length === 0) return [];

  // 2. For each payout, list its balance transactions (with the source Charge
  //    expanded) so we can read payment_intent + fee per charge.
  const payoutRows: PayoutRow[] = [];
  const paymentIntentIds = new Set<string>();
  const chargeBuckets = new Map<string, PayoutCharge[]>();
  for (const p of payouts) {
    const txns: Stripe.BalanceTransaction[] = [];
    let txAfter: string | undefined;
    for (let i = 0; i < 10; i++) {
      const page = await stripeClient.balanceTransactions.list({
        payout: p.id,
        limit: 100,
        expand: ["data.source"],
        ...(txAfter ? { starting_after: txAfter } : {}),
      });
      txns.push(...page.data);
      if (!page.has_more) break;
      txAfter = page.data[page.data.length - 1]?.id;
      if (!txAfter) break;
    }

    const charges: PayoutCharge[] = [];
    for (const tx of txns) {
      // The payout itself shows up as a `payout` type — skip it.
      if (tx.type !== "charge" && tx.type !== "payment") continue;
      const source = tx.source as Stripe.Charge | string | null;
      if (!source || typeof source === "string") continue;

      const paymentIntent = typeof source.payment_intent === "string"
        ? source.payment_intent
        : source.payment_intent?.id ?? null;
      if (paymentIntent) paymentIntentIds.add(paymentIntent);

      charges.push({
        chargeId: source.id,
        paymentIntentId: paymentIntent,
        amount: cents(tx.amount),
        fee: cents(tx.fee),
        net: cents(tx.net),
        created: tx.created,
        customerEmail: source.billing_details?.email ?? source.receipt_email ?? null,
        customerName: source.billing_details?.name ?? null,
        description: source.description ?? null,
        leadId: null,
        quoteRequestId: null,
        holdedInvoiceId: null,
        invoiceDocNumber: null,
        invoiceTotal: null,
      });
    }
    chargeBuckets.set(p.id, charges);

    payoutRows.push({
      id: p.id,
      arrivalDate: p.arrival_date,
      amount: cents(p.amount),
      status: p.status,
      description: p.description ?? null,
      totalGross: charges.reduce((s, c) => s + c.amount, 0),
      totalFees: charges.reduce((s, c) => s + c.fee, 0),
      charges,
      reconciled: false,
      reconciledAt: null,
      reconciledBy: null,
    });
  }

  // 3. Join charges with quote_requests by payment_intent_id.
  const intentArr = Array.from(paymentIntentIds);
  if (intentArr.length > 0) {
    const supabase = await createClient();
    const { data: qrs } = await supabase
      .from("quote_requests")
      .select("id, lead_id, stripe_payment_intent_id, holded_invoice_id, leads(full_name, email, company)")
      .in("stripe_payment_intent_id", intentArr);

    const byIntent = new Map<string, {
      qrId: string;
      leadId: string | null;
      holdedInvoiceId: string | null;
      customerName: string | null;
      customerEmail: string | null;
    }>();
    for (const qr of qrs ?? []) {
      const piid = qr.stripe_payment_intent_id;
      if (!piid) continue;
      const lead = qr.leads as { full_name: string | null; email: string | null; company: string | null } | null;
      byIntent.set(piid, {
        qrId: qr.id,
        leadId: qr.lead_id,
        holdedInvoiceId: qr.holded_invoice_id,
        customerName: lead?.company || lead?.full_name || null,
        customerEmail: lead?.email ?? null,
      });
    }

    for (const row of payoutRows) {
      for (const c of row.charges) {
        if (!c.paymentIntentId) continue;
        const match = byIntent.get(c.paymentIntentId);
        if (!match) continue;
        c.quoteRequestId = match.qrId;
        c.leadId = match.leadId;
        c.holdedInvoiceId = match.holdedInvoiceId;
        if (match.customerName) c.customerName = match.customerName;
        if (match.customerEmail) c.customerEmail = match.customerEmail;
      }
    }
  }

  // 4. Fetch Holded invoice numbers + totals (deduped). Best-effort: if Holded
  //    falls over we still return the page, just without the number column.
  const invoiceIds = Array.from(new Set(
    payoutRows.flatMap((r) => r.charges.map((c) => c.holdedInvoiceId).filter((id): id is string => !!id)),
  ));
  const invoiceCache = new Map<string, { docNumber: string | null; total: number | null }>();
  await Promise.all(invoiceIds.map(async (id) => {
    try {
      const doc = await getDocument("invoice", id);
      invoiceCache.set(id, {
        docNumber: doc.docNumber ?? null,
        total: typeof doc.total === "number" ? doc.total : null,
      });
    } catch {
      invoiceCache.set(id, { docNumber: null, total: null });
    }
  }));
  for (const row of payoutRows) {
    for (const c of row.charges) {
      if (!c.holdedInvoiceId) continue;
      const inv = invoiceCache.get(c.holdedInvoiceId);
      if (!inv) continue;
      c.invoiceDocNumber = inv.docNumber;
      c.invoiceTotal = inv.total;
    }
  }

  // 5. Layer in reconciliation state.
  const supabase = await createClient();
  const { data: recs } = await supabase
    .from("stripe_payout_reconciliations")
    .select("payout_id, reconciled_at, reconciled_by")
    .in("payout_id", payoutRows.map((r) => r.id));

  const recMap = new Map(recs?.map((r) => [r.payout_id, r]) ?? []);
  for (const row of payoutRows) {
    const r = recMap.get(row.id);
    if (r) {
      row.reconciled = true;
      row.reconciledAt = r.reconciled_at;
      row.reconciledBy = r.reconciled_by;
    }
  }

  return payoutRows.sort((a, b) => b.arrivalDate - a.arrivalDate);
}

export async function setPayoutReconciled(
  payoutId: string,
  reconciled: boolean,
): Promise<{ success: boolean; error?: string }> {
  const profile = await requireRole("manager");
  // Usamos service client porque la API de Stripe valida; aquí solo
  // necesitamos persistir el flag de forma idempotente.
  const supabase = createServiceClient();

  if (reconciled) {
    const { error } = await supabase
      .from("stripe_payout_reconciliations")
      .upsert({
        payout_id: payoutId,
        reconciled_at: new Date().toISOString(),
        reconciled_by: profile.id,
      });
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("stripe_payout_reconciliations")
      .delete()
      .eq("payout_id", payoutId);
    if (error) return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/finanzas/stripe-payouts");
  return { success: true };
}
