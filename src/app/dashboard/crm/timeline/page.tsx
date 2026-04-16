import { createClient } from "@/lib/supabase/server";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TimelineView } from "./timeline-view";

export default async function TimelinePage() {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");
  if (!hasRole(profile.role, "comercial")) redirect("/dashboard");

  const isManager = hasRole(profile.role, "manager");
  const supabase = await createClient();

  // Only active leads (not won/lost)
  const { data: leads } = await supabase
    .from("leads")
    .select("id, full_name, company, email, phone, status, estimated_value, assigned_to, created_at, project_type_tag")
    .not("status", "in", "(won,paid,lost)")
    .order("created_at", { ascending: false });

  // Fetch assignee emails
  const userIds = [...new Set((leads || []).map((l) => l.assigned_to).filter(Boolean))] as string[];
  let userEmailMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("user_profiles")
      .select("id, email")
      .in("id", userIds);
    userEmailMap = new Map(users?.map((u) => [u.id, u.email]) || []);
  }

  // Fetch pending follow-ups for next 30 days
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysOut = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const { data: followUps } = await supabase
    .from("lead_follow_ups")
    .select("id, lead_id, scheduled_date, note, action_type, completed_at")
    .is("completed_at", null)
    .gte("scheduled_date", today)
    .lte("scheduled_date", thirtyDaysOut)
    .order("scheduled_date");

  // Also fetch overdue (past, not completed)
  const { data: overdueFollowUps } = await supabase
    .from("lead_follow_ups")
    .select("id, lead_id, scheduled_date, note, action_type, completed_at")
    .is("completed_at", null)
    .lt("scheduled_date", today)
    .order("scheduled_date");

  const allFollowUps = [...(overdueFollowUps || []), ...(followUps || [])];

  // Build a lead name map for follow-ups
  const followUpLeadIds = [...new Set(allFollowUps.map((f) => f.lead_id))];
  let leadNameMap = new Map<string, { name: string; company: string | null }>();
  if (followUpLeadIds.length > 0) {
    const { data: fLeads } = await supabase
      .from("leads")
      .select("id, full_name, company")
      .in("id", followUpLeadIds);
    if (fLeads) {
      for (const l of fLeads) {
        leadNameMap.set(l.id, { name: l.full_name, company: l.company });
      }
    }
  }

  // Build a map from lead_id → assigned_to (from all leads + follow-up leads)
  const leadAssigneeMap = new Map<string, string | null>();
  for (const l of leads || []) {
    leadAssigneeMap.set(l.id, l.assigned_to);
  }
  if (followUpLeadIds.length > 0) {
    const { data: fLeadsAssign } = await supabase
      .from("leads")
      .select("id, assigned_to")
      .in("id", followUpLeadIds);
    for (const l of fLeadsAssign || []) {
      leadAssigneeMap.set(l.id, l.assigned_to);
    }
  }

  const agendaItems = allFollowUps.map((f) => ({
    ...f,
    lead_name: leadNameMap.get(f.lead_id)?.name || "Lead",
    lead_company: leadNameMap.get(f.lead_id)?.company || null,
    assigned_to: leadAssigneeMap.get(f.lead_id) || null,
  }));

  // Fetch last activity + last activity type per lead
  const leadIds = (leads || []).map((l) => l.id);
  let activityMap = new Map<string, { last_at: string; activity_type: string }>();
  if (leadIds.length > 0) {
    const { data: activities } = await supabase
      .from("lead_activities")
      .select("lead_id, created_at, activity_type")
      .in("lead_id", leadIds)
      .order("created_at", { ascending: false });

    if (activities) {
      // Keep only the latest per lead
      for (const a of activities) {
        if (!activityMap.has(a.lead_id)) {
          activityMap.set(a.lead_id, { last_at: a.created_at, activity_type: a.activity_type });
        }
      }
    }
  }

  const timelineLeads = (leads || []).map((l) => {
    const activity = activityMap.get(l.id);
    return {
      id: l.id,
      full_name: l.full_name,
      company: l.company,
      email: l.email,
      phone: l.phone,
      status: l.status as "new" | "contacted" | "quoted" | "won",
      estimated_value: l.estimated_value,
      project_type_tag: l.project_type_tag,
      created_at: l.created_at,
      assigned_to: l.assigned_to as string | null,
      assignee_name: l.assigned_to ? userEmailMap.get(l.assigned_to)?.split("@")[0] || null : null,
      last_activity_at: activity?.last_at || null,
      last_activity_type: activity?.activity_type || null,
    };
  });

  // Fetch comerciales for the selector (managers see all, comerciales see only themselves)
  let comerciales: { id: string; name: string }[] = [];
  if (isManager) {
    const { data: comUsers } = await supabase
      .from("user_profiles")
      .select("id, email, full_name")
      .in("role", ["comercial", "manager", "super_admin"])
      .eq("is_active", true)
      .order("email");
    comerciales = (comUsers || []).map((u) => ({
      id: u.id,
      name: u.full_name || u.email.split("@")[0],
    }));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" render={<Link href="/dashboard/crm" />}>
            <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Tracker
          </Button>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Tracker</h1>
        </div>
      </div>

      <TimelineView
        leads={timelineLeads}
        agendaItems={agendaItems}
        comerciales={comerciales}
        currentUserId={profile.id}
        isManager={isManager}
      />
    </div>
  );
}
