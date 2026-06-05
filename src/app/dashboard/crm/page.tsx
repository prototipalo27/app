import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CrmKanban } from "./crm-kanban-wrapper";
import type { LeadWithAssignee } from "./crm-card";
import PricingConfig from "./pricing-config";

import { NewOrderButton } from "./new-order-button";
import { generateMissingSummaries } from "@/lib/ai-summary";
import {
  getSharedUserProfiles,
  getSharedBasePrices,
  getCachedLeadsWithActivity,
} from "@/lib/supabase/cached-queries";
import { createServiceClient } from "@/lib/supabase/server";

export default async function CrmPage() {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");
  if (!hasRole(profile.role, "manager")) redirect("/dashboard");

  // Cached queries: leads+activity (minutes), profiles (hours), base prices (hours)
  const [
    { leads, lastActivityMap },
    sharedProfiles,
    basePrices,
  ] = await Promise.all([
    getCachedLeadsWithActivity(),     // cached: minutes
    getSharedUserProfiles(),          // cached: hours
    getSharedBasePrices(),            // cached: hours
  ]);

  const managers = sharedProfiles
    .filter((m) => m.role === "manager" || m.role === "super_admin")
    .map((m) => ({ id: m.id, name: m.email.split("@")[0] }));

  // Build unique owners (captadores) list from leads + current user
  const ownerIdsFromLeads = leads.map((l) => l.owned_by).filter(Boolean) as string[];
  const ownerIds = [...new Set([...ownerIdsFromLeads, profile.id])];

  // Build email map from cached shared profiles (no extra query needed)
  const userEmailMap = new Map(sharedProfiles.map((u) => [u.id, u.email]));

  const owners = ownerIds
    .filter((id) => userEmailMap.has(id))
    .map((id) => ({ id, name: userEmailMap.get(id)!.split("@")[0] }));

  // Generate AI summaries for new leads that don't have one (fire-and-forget for speed)
  const leadsWithoutSummary = leads
    .filter((l) => l.status === "new" && !l.ai_summary && l.message);
  if (leadsWithoutSummary.length > 0) {
    generateMissingSummaries(leadsWithoutSummary).then((summaryMap) => {
      // Summaries are saved to DB by the function itself
      // They'll appear on next page load
    });
  }

  // Map of lead_id → most recent paid_at (for filtering Pagados column by month)
  const supabase = createServiceClient();
  const { data: paidQuotes } = await supabase
    .from("quote_requests")
    .select("lead_id, paid_at, shipping_address, first_paid_at, second_paid_at, payment_option, pickup_in_person")
    .or("payment_status.eq.paid,first_paid_at.not.is.null")
    .order("created_at", { ascending: false });
  const paidAtMap: Record<string, string> = {};
  const shippingAddressMap: Record<string, string | null> = {};
  const pickupMap: Record<string, boolean> = {};
  const pendingSecondHalfMap: Record<string, boolean> = {};
  for (const q of paidQuotes || []) {
    if (!q.lead_id) continue;
    if (q.paid_at && !paidAtMap[q.lead_id]) paidAtMap[q.lead_id] = q.paid_at;
    if (!(q.lead_id in shippingAddressMap)) {
      shippingAddressMap[q.lead_id] = q.shipping_address ?? null;
      pickupMap[q.lead_id] = Boolean(q.pickup_in_person);
      pendingSecondHalfMap[q.lead_id] =
        q.payment_option === "split" && !!q.first_paid_at && !q.second_paid_at;
    }
  }

  // Fallback: any paid lead without a shipping_address from quote_requests
  // (either filtered out by payment_status or never written) should still
  // resolve its address — otherwise the kanban "falta dirección" alert stays
  // red even when the address is set.
  const missingAddress = (id: string) => {
    const v = shippingAddressMap[id];
    return !v || !String(v).trim();
  };
  const paidLeadIds = leads.filter((l) => l.status === "paid").map((l) => l.id);

  // First fallback: read shipping_address straight from quote_requests, ignoring
  // the paid filter above. A lead can sit in the "Pagados" column (lead.status =
  // 'paid') while its quote_request still has payment_status 'pending' — in that
  // case the address was written but the paid filter dropped it from the map.
  const stillMissingFromQuotes = paidLeadIds.filter(missingAddress);
  if (stillMissingFromQuotes.length > 0) {
    const { data: anyQuotes } = await supabase
      .from("quote_requests")
      .select("lead_id, shipping_address, pickup_in_person")
      .in("lead_id", stillMissingFromQuotes)
      .order("created_at", { ascending: false });
    for (const q of anyQuotes || []) {
      if (!q.lead_id || !missingAddress(q.lead_id)) continue;
      if (q.shipping_address && String(q.shipping_address).trim()) {
        shippingAddressMap[q.lead_id] = q.shipping_address;
      }
      if (q.pickup_in_person) pickupMap[q.lead_id] = true;
    }
  }

  // Second fallback: resolve via client_addresses for any lead still missing.
  const leadsMissingAddress = paidLeadIds.filter(missingAddress);
  if (leadsMissingAddress.length > 0) {
    const { data: projectsForLeads } = await supabase
      .from("projects")
      .select("lead_id, holded_contact_id")
      .in("lead_id", leadsMissingAddress)
      .not("holded_contact_id", "is", null);

    const contactIds = Array.from(
      new Set((projectsForLeads ?? []).map((p) => p.holded_contact_id).filter((id): id is string => !!id)),
    );

    if (contactIds.length > 0) {
      const { data: defaultAddresses } = await supabase
        .from("client_addresses")
        .select("holded_contact_id, address_line, is_default, created_at")
        .in("holded_contact_id", contactIds)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      const addressByContact = new Map<string, string>();
      for (const a of defaultAddresses ?? []) {
        if (a.address_line && !addressByContact.has(a.holded_contact_id)) {
          addressByContact.set(a.holded_contact_id, a.address_line);
        }
      }

      for (const p of projectsForLeads ?? []) {
        if (!p.lead_id || !p.holded_contact_id) continue;
        const addr = addressByContact.get(p.holded_contact_id);
        if (addr && !shippingAddressMap[p.lead_id]) {
          shippingAddressMap[p.lead_id] = addr;
        }
      }
    }
  }

  const leadsWithAssignee: LeadWithAssignee[] = leads.map((l) => ({
    ...l,
    assignee_email: l.assigned_to ? userEmailMap.get(l.assigned_to) || null : null,
    owner_email: l.owned_by ? userEmailMap.get(l.owned_by) || null : null,
    last_activity_at: lastActivityMap[l.id] || null,
    shipping_address: shippingAddressMap[l.id] ?? null,
    pickup_in_person: pickupMap[l.id] ?? false,
    pending_second_half: pendingSecondHalfMap[l.id] ?? false,
  }));

  const activeLeadsCount = leads.filter(
    (l) => l.status !== "lost" && l.status !== "finished"
  ).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Leads</h1>
          <span
            className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-sm font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            title="Total de leads sin contar los perdidos ni terminados"
          >
            {activeLeadsCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/crm/timeline" className="hidden sm:inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Tracker
          </Link>
          <Link href="/dashboard/crm/comisiones" className="hidden sm:inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground">
            Comisiones
          </Link>
          <Link href="/dashboard/crm/list" className="hidden sm:inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Lista
          </Link>
          <NewOrderButton />
          <Link href="/dashboard/crm/new" className="inline-flex items-center rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark">
            + Nuevo lead
          </Link>
        </div>
      </div>

      <CrmKanban initialLeads={leadsWithAssignee} managers={managers} owners={owners} myCommission={null} paidAtMap={paidAtMap} />

      <PricingConfig basePrices={basePrices} />
    </div>
  );
}
