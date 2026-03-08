import { createClient } from "@/lib/supabase/server";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CrmKanban } from "./crm-kanban";
import type { LeadWithAssignee } from "./crm-card";
import PricingConfig from "./pricing-config";
import { getBasePrices } from "./actions";
import { Button } from "@/components/ui/button";
import { generateMissingSummaries } from "@/lib/ai-summary";
import { PullToRefresh } from "@/components/pull-to-refresh";

export default async function CrmPage() {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");
  if (!hasRole(profile.role, "manager")) redirect("/dashboard");

  const supabase = await createClient();

  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch managers for filter
  const { data: allManagers } = await supabase
    .from("user_profiles")
    .select("id, email")
    .in("role", ["manager", "super_admin"])
    .eq("is_active", true);

  const basePrices = await getBasePrices();

  const managers = (allManagers || []).map((m) => ({
    id: m.id,
    name: m.email.split("@")[0],
  }));

  // Fetch assignee + owner emails
  const userIds = [
    ...new Set([
      ...(leads || []).map((l) => l.assigned_to),
      ...(leads || []).map((l) => l.owned_by),
    ].filter(Boolean)),
  ] as string[];

  let userEmailMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("user_profiles")
      .select("id, email")
      .in("id", userIds);
    userEmailMap = new Map(users?.map((u) => [u.id, u.email]) || []);
  }

  // Generate AI summaries for new leads that don't have one (fire-and-forget for speed)
  const leadsWithoutSummary = (leads || [])
    .filter((l) => l.status === "new" && !l.ai_summary && l.message);
  if (leadsWithoutSummary.length > 0) {
    generateMissingSummaries(leadsWithoutSummary).then((summaryMap) => {
      // Summaries are saved to DB by the function itself
      // They'll appear on next page load
    });
  }

  const leadsWithAssignee: LeadWithAssignee[] = (leads || []).map((l) => ({
    ...l,
    assignee_email: l.assigned_to ? userEmailMap.get(l.assigned_to) || null : null,
    owner_email: l.owned_by ? userEmailMap.get(l.owned_by) || null : null,
  }));

  return (
    <PullToRefresh>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Leads</h1>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">Gestiona tu pipeline comercial</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="sm" render={<Link href="/dashboard/crm/comisiones" />}>
              Comisiones
            </Button>
            <Button variant="ghost" size="sm" render={<Link href="/dashboard/crm/list" />}>
              <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Lista
            </Button>
            <Button render={<Link href="/dashboard/crm/new" />} className="bg-brand text-white hover:bg-brand-dark">
              + Nuevo lead
            </Button>
          </div>
        </div>

        <CrmKanban initialLeads={leadsWithAssignee} managers={managers} />

        <PricingConfig basePrices={basePrices} />
      </div>
    </PullToRefresh>
  );
}
