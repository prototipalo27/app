import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { KanbanBoard } from "./kanban-board";
import { RealtimeProjectsListener } from "./realtime-projects";
import { SyncHoldedButton } from "./sync-holded-button";
import { AutoSync } from "./auto-sync";
import { classifyTrafficSource, SOURCE_COLORS, ALL_SOURCES, type TrafficSource } from "@/lib/utm-utils";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const now = new Date();
  const curMonth = now.getMonth();
  const curYear = now.getFullYear();

  const [
    { data: confirmedProjects },
    { data: syncMeta },
    { data: zoneAssignments },
    { data: userProfiles },
    { data: allLeads },
    { data: utmRows },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("*, project_items(id, name, quantity, completed)")
      .eq("project_type", "confirmed")
      .order("created_at", { ascending: false }),
    supabase
      .from("app_metadata")
      .select("value")
      .eq("key", "last_holded_sync")
      .single(),
    supabase.from("zone_assignments").select("user_id, zone"),
    supabase.from("user_profiles").select("id, full_name, nickname, email").eq("is_active", true),
    supabase.from("leads").select("id, source, status, created_at"),
    supabase.from("lead_utm_data").select("lead_id, utm_source, utm_medium, utm_campaign, gclid, fbclid, msclkid, ttclid, referrer"),
  ]);

  // Build zone → responsible names map
  const userMap = new Map((userProfiles ?? []).map((u) => [u.id, u.nickname || u.full_name || u.email.split("@")[0]]));
  const zoneResponsibles: Record<string, string[]> = {};
  for (const za of zoneAssignments ?? []) {
    const name = userMap.get(za.user_id);
    if (name) {
      if (!zoneResponsibles[za.zone]) zoneResponsibles[za.zone] = [];
      zoneResponsibles[za.zone].push(name);
    }
  }

  // Build userId → name map for PM display
  const pmNames: Record<string, string> = {};
  for (const [id, name] of userMap) {
    pmNames[id] = name;
  }

  // Build holded invoice id → docNumber map from persisted data
  const invoiceDocNumbers: Record<string, string> = {};
  for (const p of (confirmedProjects ?? [])) {
    if (p.holded_invoice_id && p.invoice_doc_number) {
      invoiceDocNumbers[p.holded_invoice_id] = p.invoice_doc_number;
    }
  }

  /* ── Lead source analytics ── */
  const utmByLeadId = new Map(
    (utmRows ?? []).map((u) => [u.lead_id, u])
  );

  const prevMonth = curMonth === 0 ? 11 : curMonth - 1;
  const prevMonthYear = curMonth === 0 ? curYear - 1 : curYear;

  type SourceRow = { source: TrafficSource; total: number; thisMonth: number; lastMonth: number; won: number };
  const sourceMap = new Map<TrafficSource, SourceRow>();

  for (const l of allLeads ?? []) {
    const ts = classifyTrafficSource(l.source, utmByLeadId.get(l.id) ?? null);
    let row = sourceMap.get(ts);
    if (!row) {
      row = { source: ts, total: 0, thisMonth: 0, lastMonth: 0, won: 0 };
      sourceMap.set(ts, row);
    }
    row.total++;
    const d = new Date(l.created_at);
    if (d.getMonth() === curMonth && d.getFullYear() === curYear) row.thisMonth++;
    if (d.getMonth() === prevMonth && d.getFullYear() === prevMonthYear) row.lastMonth++;
    if (l.status === "won" || l.status === "paid") row.won++;
  }

  const leadSourceRows = ALL_SOURCES
    .filter((s) => sourceMap.has(s))
    .map((s) => sourceMap.get(s)!)
    .sort((a, b) => b.total - a.total);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
      <AutoSync lastSyncAt={syncMeta?.value ?? null} />
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-white">
            Proyectos
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Gestiona tus proyectos de produccion
          </p>
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <SyncHoldedButton />
          <Link
            href="/dashboard/projects/new"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-black"
          >
            Nuevo proyecto
          </Link>
        </div>
      </div>

      {/* ── Lead source table ── */}
      {leadSourceRows.length > 0 && (
        <div className="mb-4 shrink-0 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
            Origen de leads
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="pb-2 font-medium text-zinc-500 dark:text-zinc-400">Fuente</th>
                  <th className="pb-2 text-right font-medium text-zinc-500 dark:text-zinc-400">Total</th>
                  <th className="pb-2 text-right font-medium text-zinc-500 dark:text-zinc-400">Este mes</th>
                  <th className="pb-2 text-right font-medium text-zinc-500 dark:text-zinc-400">Mes anterior</th>
                  <th className="pb-2 text-right font-medium text-zinc-500 dark:text-zinc-400">Ganados</th>
                  <th className="pb-2 text-right font-medium text-zinc-500 dark:text-zinc-400">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {leadSourceRows.map((row) => {
                  const rate = row.total > 0 ? Math.round((row.won / row.total) * 100) : 0;
                  return (
                    <tr key={row.source} className="border-b border-zinc-50 last:border-0 dark:border-zinc-800/50">
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: SOURCE_COLORS[row.source] }}
                          />
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">{row.source}</span>
                        </div>
                      </td>
                      <td className="py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{row.total}</td>
                      <td className="py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{row.thisMonth}</td>
                      <td className="py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{row.lastMonth}</td>
                      <td className="py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{row.won}</td>
                      <td className="py-2 text-right">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            rate >= 20
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : rate >= 10
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <RealtimeProjectsListener />

      {!confirmedProjects || confirmedProjects.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No hay proyectos. Crea tu primer proyecto para empezar.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <KanbanBoard initialProjects={confirmedProjects} zoneResponsibles={zoneResponsibles} invoiceDocNumbers={invoiceDocNumbers} pmNames={pmNames} />
        </div>
      )}
    </div>
  );
}
