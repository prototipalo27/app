import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { KanbanBoard } from "./kanban-board";
import { UpcomingProjects } from "./upcoming-projects";
import { RealtimeProjectsListener } from "./realtime-projects";
import { SyncHoldedButton } from "./sync-holded-button";
import { AutoSync } from "./auto-sync";
import { BillingCards } from "./billing-cards";
import { LeadsChart } from "./leads-chart";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  // Date ranges for billing
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth(); // 0-indexed
  const curStart = `${curYear}-${String(curMonth + 1).padStart(2, "0")}-01`;
  const nextMonthDate = new Date(curYear, curMonth + 1, 1);
  const nextStart = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
  const prevDate = new Date(curYear, curMonth - 1, 1);
  const prevStart = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-01`;

  // Leads: last 30 days
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const leadsStart = thirtyDaysAgo.toISOString();

  const [
    { data: upcomingProjects },
    { data: confirmedProjects },
    { data: syncMeta },
    { data: curBilling },
    { data: prevBilling },
    { data: leadsRaw },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("*, project_items(id, name, quantity, completed)")
      .eq("project_type", "upcoming")
      .order("created_at", { ascending: false }),
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
    supabase
      .from("projects")
      .select("price, invoice_date")
      .not("price", "is", null)
      .gte("invoice_date", curStart)
      .lt("invoice_date", nextStart),
    supabase
      .from("projects")
      .select("price, invoice_date")
      .not("price", "is", null)
      .gte("invoice_date", prevStart)
      .lt("invoice_date", curStart),
    supabase
      .from("leads")
      .select("created_at")
      .gte("created_at", leadsStart)
      .order("created_at", { ascending: true }),
  ]);

  // Aggregate billing
  const currentMonthBilling = {
    total: (curBilling ?? []).reduce((s, p) => s + (p.price ?? 0), 0),
    count: (curBilling ?? []).length,
    label: MONTH_NAMES[curMonth],
  };
  const previousMonthBilling = {
    total: (prevBilling ?? []).reduce((s, p) => s + (p.price ?? 0), 0),
    count: (prevBilling ?? []).length,
    label: MONTH_NAMES[prevDate.getMonth()],
  };

  // Aggregate leads per day
  const leadsPerDay: { date: string; count: number }[] = [];
  const dayMap = new Map<string, number>();
  for (const lead of leadsRaw ?? []) {
    const day = lead.created_at.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    leadsPerDay.push({ date: key, count: dayMap.get(key) ?? 0 });
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
      <AutoSync lastSyncAt={syncMeta?.value ?? null} />
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Proyectos
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Gestiona tus proyectos de produccion
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SyncHoldedButton />
          <Link
            href="/dashboard/projects/new"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-black"
          >
            Nuevo proyecto
          </Link>
        </div>
      </div>

      <RealtimeProjectsListener />

      {/* Billing + Leads */}
      <div className="mb-4 grid shrink-0 gap-3 sm:grid-cols-2">
        <BillingCards currentMonth={currentMonthBilling} previousMonth={previousMonthBilling} />
        <LeadsChart data={leadsPerDay} />
      </div>

      <UpcomingProjects projects={upcomingProjects ?? []} />

      {!confirmedProjects || confirmedProjects.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No hay proyectos. Crea tu primer proyecto para empezar.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <KanbanBoard initialProjects={confirmedProjects} />
        </div>
      )}
    </div>
  );
}
