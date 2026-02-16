import { createClient } from "@/lib/supabase/server";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CrmKanban } from "./crm-kanban";
import type { LeadWithAssignee } from "./crm-card";

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

  const managers = (allManagers || []).map((m) => ({
    id: m.id,
    name: m.email.split("@")[0],
  }));

  // Fetch assignee emails
  const assigneeIds = [
    ...new Set((leads || []).map((l) => l.assigned_to).filter(Boolean)),
  ] as string[];

  let assigneeMap = new Map<string, string>();
  if (assigneeIds.length > 0) {
    const { data: users } = await supabase
      .from("user_profiles")
      .select("id, email")
      .in("id", assigneeIds);
    assigneeMap = new Map(users?.map((u) => [u.id, u.email]) || []);
  }

  const leadsWithAssignee: LeadWithAssignee[] = (leads || []).map((l) => ({
    ...l,
    assignee_email: l.assigned_to ? assigneeMap.get(l.assigned_to) || null : null,
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          CRM — Leads
        </h1>
        <div className="flex gap-2">
          <Link
            href="/dashboard/crm/list"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <svg className="mr-1.5 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Lista
          </Link>
          <Link
            href="/dashboard/crm/new"
            className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            + Nuevo lead
          </Link>
        </div>
      </div>

      <CrmKanban initialLeads={leadsWithAssignee} managers={managers} />
    </div>
  );
}
