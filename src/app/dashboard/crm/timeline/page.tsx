import { createClient } from "@/lib/supabase/server";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TimelineView } from "./timeline-view";

export default async function TimelinePage() {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");
  if (!hasRole(profile.role, "manager")) redirect("/dashboard");

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
      assignee_name: l.assigned_to ? userEmailMap.get(l.assigned_to)?.split("@")[0] || null : null,
      last_activity_at: activity?.last_at || null,
      last_activity_type: activity?.activity_type || null,
    };
  });

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

      <TimelineView leads={timelineLeads} />
    </div>
  );
}
