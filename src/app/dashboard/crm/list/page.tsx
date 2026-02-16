import { createClient } from "@/lib/supabase/server";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LEAD_COLUMNS,
  STATUS_LABELS,
  type LeadStatus,
} from "@/lib/crm-config";

export default async function CrmListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");
  if (!hasRole(profile.role, "manager")) redirect("/dashboard");

  const { status: filterStatus } = await searchParams;

  const supabase = await createClient();

  let query = supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (
    filterStatus &&
    LEAD_COLUMNS.some((c) => c.id === filterStatus)
  ) {
    query = query.eq("status", filterStatus);
  }

  const { data: leads } = await query;

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
    assigneeMap = new Map(
      users?.map((u) => [u.id, u.email.split("@")[0]]) || []
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          CRM — Lista de Leads
        </h1>
        <div className="flex gap-2">
          <Link
            href="/dashboard/crm"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <svg className="mr-1.5 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
            Kanban
          </Link>
          <Link
            href="/dashboard/crm/new"
            className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            + Nuevo lead
          </Link>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/dashboard/crm/list"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            !filterStatus
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          Todos
        </Link>
        {LEAD_COLUMNS.map((col) => (
          <Link
            key={col.id}
            href={`/dashboard/crm/list?status=${col.id}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              filterStatus === col.id
                ? col.badge
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {col.label}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                  Nombre
                </th>
                <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                  Empresa
                </th>
                <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                  Email
                </th>
                <th className="hidden px-4 py-3 font-semibold text-zinc-700 md:table-cell dark:text-zinc-300">
                  Telefono
                </th>
                <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                  Estado
                </th>
                <th className="hidden px-4 py-3 font-semibold text-zinc-700 md:table-cell dark:text-zinc-300">
                  Asignado
                </th>
                <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                  Fecha
                </th>
              </tr>
            </thead>
            <tbody>
              {(!leads || leads.length === 0) ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400"
                  >
                    No hay leads
                    {filterStatus ? ` con estado "${STATUS_LABELS[filterStatus as LeadStatus] || filterStatus}"` : ""}.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const col = LEAD_COLUMNS.find((c) => c.id === lead.status);
                  return (
                    <tr
                      key={lead.id}
                      className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/crm/${lead.id}`}
                          className="font-medium text-zinc-900 hover:underline dark:text-white"
                        >
                          {lead.full_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {lead.company || "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {lead.email || "—"}
                      </td>
                      <td className="hidden px-4 py-3 text-zinc-600 md:table-cell dark:text-zinc-400">
                        {lead.phone || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {col && (
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${col.badge}`}
                          >
                            {col.label}
                          </span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-zinc-600 md:table-cell dark:text-zinc-400">
                        {lead.assigned_to
                          ? assigneeMap.get(lead.assigned_to) || "—"
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                        {new Date(lead.created_at).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
