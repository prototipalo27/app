import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getUserProfile, hasRole } from "@/lib/rbac";
import LeadActions from "./lead-actions";
import {
  LEAD_COLUMNS,
  STATUS_LABELS,
  ACTIVITY_COLORS,
  ACTIVITY_LABELS,
  type LeadStatus,
  type ActivityType,
} from "@/lib/crm-config";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");
  if (!hasRole(profile.role, "manager")) redirect("/dashboard");

  const { id } = await params;
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();

  if (!lead) notFound();

  // Fetch activities
  const { data: activities } = await supabase
    .from("lead_activities")
    .select("*")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  // Fetch managers for assignment dropdown
  const { data: managers } = await supabase
    .from("user_profiles")
    .select("id, email")
    .in("role", ["manager", "super_admin"])
    .eq("is_active", true);

  // Fetch user names for activities & assignee
  const userIds = [
    ...new Set([
      lead.assigned_to,
      ...(activities || []).map((a) => a.created_by),
    ].filter(Boolean)),
  ] as string[];

  let userMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("user_profiles")
      .select("id, email")
      .in("id", userIds);
    userMap = new Map(users?.map((u) => [u.id, u.email.split("@")[0]]) || []);
  }

  const statusColumn = LEAD_COLUMNS.find((c) => c.id === lead.status);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <Link
          href="/dashboard/crm"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Volver a CRM
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left panel: lead info + timeline */}
        <div className="space-y-4 md:col-span-2">
          {/* Lead info card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {statusColumn && (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColumn.badge}`}
                >
                  {statusColumn.label}
                </span>
              )}
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {lead.source}
              </span>
            </div>

            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
              {lead.full_name}
            </h1>

            {lead.company && (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {lead.company}
              </p>
            )}

            <div className="mt-4 space-y-2">
              {lead.email && (
                <div className="flex items-center gap-2 text-sm">
                  <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a
                    href={`mailto:${lead.email}`}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {lead.email}
                  </a>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <a
                    href={`tel:${lead.phone}`}
                    className="text-zinc-700 hover:underline dark:text-zinc-300"
                  >
                    {lead.phone}
                  </a>
                </div>
              )}
              {lead.assigned_to && (
                <div className="flex items-center gap-2 text-sm">
                  <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {userMap.get(lead.assigned_to) || "—"}
                  </span>
                </div>
              )}
            </div>

            {lead.message && (
              <div className="mt-4 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
                <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Mensaje original
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                  {lead.message}
                </p>
              </div>
            )}

            {lead.lost_reason && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/10">
                <p className="text-xs font-semibold uppercase text-red-700 dark:text-red-400">
                  Motivo de perdida
                </p>
                <p className="mt-1 text-sm text-red-600 dark:text-red-300">
                  {lead.lost_reason}
                </p>
              </div>
            )}

            <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
              Creado el{" "}
              {new Date(lead.created_at).toLocaleDateString("es-ES", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          {/* Activity timeline */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">
              Actividad ({activities?.length || 0})
            </h3>

            {(!activities || activities.length === 0) ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Sin actividad registrada.
              </p>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => {
                  const actType = activity.activity_type as ActivityType;
                  const metadata = activity.metadata as Record<string, unknown> | null;

                  return (
                    <div key={activity.id} className="flex gap-3">
                      <div className="mt-0.5">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${ACTIVITY_COLORS[actType] || ""}`}
                        >
                          {actType === "note" && "N"}
                          {actType === "email_sent" && "E"}
                          {actType === "status_change" && "S"}
                          {actType === "call" && "C"}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            {ACTIVITY_LABELS[actType] || actType}
                          </span>
                          {activity.created_by && (
                            <span className="text-xs text-zinc-400 dark:text-zinc-500">
                              por {userMap.get(activity.created_by) || "—"}
                            </span>
                          )}
                          <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
                            {new Date(activity.created_at).toLocaleDateString(
                              "es-ES",
                              {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </span>
                        </div>

                        {actType === "email_sent" && metadata && (
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                            Para: {String(metadata.email_to || "")} — Asunto:{" "}
                            {String(metadata.email_subject || "")}
                          </p>
                        )}

                        {actType === "status_change" && metadata && (
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                            {STATUS_LABELS[metadata.old_status as LeadStatus] || String(metadata.old_status)}
                            {" → "}
                            {STATUS_LABELS[metadata.new_status as LeadStatus] || String(metadata.new_status)}
                          </p>
                        )}

                        {activity.content && (
                          <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
                            {activity.content}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right panel: actions */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <LeadActions
            leadId={lead.id}
            currentStatus={lead.status as LeadStatus}
            leadEmail={lead.email}
            managers={managers || []}
            assignedTo={lead.assigned_to}
          />
        </div>
      </div>
    </div>
  );
}
