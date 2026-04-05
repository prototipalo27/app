import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CrmKanban } from "./crm-kanban-wrapper";
import type { LeadWithAssignee } from "./crm-card";
import PricingConfig from "./pricing-config";
import { getMyCommissionData } from "./actions";
import { NewOrderButton } from "./new-order-button";
import { generateMissingSummaries } from "@/lib/ai-summary";
import {
  getSharedUserProfiles,
  getSharedBasePrices,
  getCachedLeadsWithActivity,
} from "@/lib/supabase/cached-queries";

export default async function CrmPage() {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");
  if (!hasRole(profile.role, "manager")) redirect("/dashboard");

  // Cached queries: leads+activity (minutes), profiles (hours), base prices (hours)
  const [
    { leads, lastActivityMap },
    sharedProfiles,
    basePrices,
    myCommissionData,
  ] = await Promise.all([
    getCachedLeadsWithActivity(),     // cached: minutes
    getSharedUserProfiles(),          // cached: hours
    getSharedBasePrices(),            // cached: hours
    getMyCommissionData(),            // not cached (uses cookies for auth)
  ]);
  const myCommission = myCommissionData?.preview ?? null;

  const managers = sharedProfiles
    .filter((m) => m.role === "manager" || m.role === "super_admin")
    .map((m) => ({ id: m.id, name: m.email.split("@")[0] }));

  // Build unique owners (captadores) list from leads + current user
  const ownerIdsFromLeads = leads.map((l) => l.owned_by).filter(Boolean) as string[];
  const myId = myCommission?.ownerId;
  const ownerIds = [...new Set([...ownerIdsFromLeads, ...(myId ? [myId] : [])])];

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

  const leadsWithAssignee: LeadWithAssignee[] = leads.map((l) => ({
    ...l,
    assignee_email: l.assigned_to ? userEmailMap.get(l.assigned_to) || null : null,
    owner_email: l.owned_by ? userEmailMap.get(l.owned_by) || null : null,
    last_activity_at: lastActivityMap[l.id] || null,
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Leads</h1>
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

      <CrmKanban initialLeads={leadsWithAssignee} managers={managers} owners={owners} myCommission={myCommission} />

      <PricingConfig basePrices={basePrices} />
    </div>
  );
}
