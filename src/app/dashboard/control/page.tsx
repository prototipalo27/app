import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { COLUMNS } from "@/lib/kanban-config";
import { getNextTaxDeadline } from "@/lib/finance/tax-calendar";
import Link from "next/link";
import { BillingBreakdown } from "./billing-breakdown";
import { LeadsChart } from "../leads-chart";

/* ── helpers ── */

function formatEur(n: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatMinutes(m: number) {
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  if (h === 0) return `${min}m`;
  return min > 0 ? `${h}h ${min}m` : `${h}h`;
}

function isThisMonth(dateStr: string | null) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function isLastMonth(dateStr: string | null) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
}

/* ── KPI Card ── */

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{sub}</p>}
    </div>
  );
}

/* ── Printer dot ── */

function PrinterDot({ state, online }: { state: string | null; online: boolean | null }) {
  let color = "bg-zinc-400"; // IDLE / unknown
  if (!online) color = "bg-red-500";
  else if (state === "RUNNING") color = "bg-green-500";
  else if (state === "PAUSE") color = "bg-yellow-500";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}

export default async function ControlPage() {
  await requireRole("manager");
  const supabase = await createClient();

  // Date ranges for billing using invoice_date
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();
  const curStart = `${curYear}-${String(curMonth + 1).padStart(2, "0")}-01`;
  const nextM = new Date(curYear, curMonth + 1, 1);
  const nextStart = `${nextM.getFullYear()}-${String(nextM.getMonth() + 1).padStart(2, "0")}-01`;
  const prevM = new Date(curYear, curMonth - 1, 1);
  const prevStart = `${prevM.getFullYear()}-${String(prevM.getMonth() + 1).padStart(2, "0")}-01`;

  // Leads: last 30 days
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

  const [
    { data: projects },
    { data: projectItems },
    { data: printJobs },
    { data: printers },
    { data: leads },
    { data: shipments },
    { data: purchaseItems },
    { data: fixedExpenses },
    { data: taxPayments },
    { data: curBillingProjects },
    { data: prevBillingProjects },
    { data: leadsRaw },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, status, project_type, price, deadline, client_name, created_at, invoice_date")
      .neq("project_type", "discarded"),
    supabase.from("project_items").select("id, project_id, quantity, completed, print_time_minutes"),
    supabase.from("print_jobs").select("id, status, estimated_minutes, printer_id, started_at, completed_at"),
    supabase.from("printers").select("id, name, online, gcode_state, print_percent, remaining_minutes, current_file").order("name"),
    supabase.from("leads").select("id, status, source, created_at"),
    supabase
      .from("shipping_info")
      .select("id, shipment_status, shipped_at, delivered_at, price, project_id, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("purchase_items").select("id, status, actual_price, estimated_price"),
    supabase.from("fixed_expenses").select("id, amount, frequency").eq("is_active", true),
    supabase.from("tax_payments").select("model, period, due_date, status").order("due_date"),
    supabase
      .from("projects")
      .select("id, name, client_name, price, invoice_date")
      .not("price", "is", null)
      .not("invoice_date", "is", null)
      .gte("invoice_date", curStart)
      .lt("invoice_date", nextStart),
    supabase
      .from("projects")
      .select("id, name, client_name, price, invoice_date")
      .not("price", "is", null)
      .not("invoice_date", "is", null)
      .gte("invoice_date", prevStart)
      .lt("invoice_date", curStart),
    supabase
      .from("leads")
      .select("created_at")
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: true }),
  ]);

  const allProjects = projects ?? [];
  const allItems = projectItems ?? [];
  const allJobs = printJobs ?? [];
  const allPrinters = printers ?? [];
  const allLeads = leads ?? [];
  const allShipments = shipments ?? [];
  const allPurchases = purchaseItems ?? [];

  /* ── KPI calculations ── */

  const confirmedProjects = allProjects.filter(
    (p) => p.project_type === "confirmed" && p.status !== "delivered"
  );
  const activePrinters = allPrinters.filter(
    (p) => p.online && (p.gcode_state === "RUNNING" || p.gcode_state === "PAUSE")
  );
  const queuedJobs = allJobs.filter((j) => j.status === "queued");
  const openLeads = allLeads.filter((l) => l.status !== "won" && l.status !== "lost");
  const pendingShipments = allShipments.filter(
    (s) => s.shipment_status && s.shipment_status !== "delivered" && !s.shipment_status.includes("transit")
  );

  /* ── Production: active jobs (printing first, then queued) ── */

  const printerMap = new Map(allPrinters.map((p) => [p.id, p.name]));
  const activeJobs = allJobs
    .filter((j) => j.status === "printing" || j.status === "queued")
    .sort((a, b) => {
      if (a.status === "printing" && b.status !== "printing") return -1;
      if (a.status !== "printing" && b.status === "printing") return 1;
      return 0;
    })
    .slice(0, 8);

  /* ── Pipeline ── */

  const pipelineCounts: Record<string, number> = {};
  for (const col of COLUMNS) pipelineCounts[col.id] = 0;
  for (const p of confirmedProjects) {
    if (pipelineCounts[p.status] !== undefined) pipelineCounts[p.status]++;
  }
  const pipelineTotal = confirmedProjects.length || 1;

  const upcomingProjects = allProjects.filter((p) => p.project_type === "upcoming");
  const upcomingValue = upcomingProjects.reduce((s, p) => s + (p.price ?? 0), 0);
  const confirmedValue = confirmedProjects.reduce((s, p) => s + (p.price ?? 0), 0);
  const overdueProjects = confirmedProjects.filter(
    (p) => p.deadline && new Date(p.deadline) < new Date() && p.status !== "delivered"
  );

  /* ── Ingresos y gastos (basado en invoice_date) ── */

  const MONTH_NAMES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  const curBillingList = curBillingProjects ?? [];
  const prevBillingList = prevBillingProjects ?? [];
  const revenueThisMonth = curBillingList.reduce((s, p) => s + (p.price ?? 0), 0);
  const revenueLastMonth = prevBillingList.reduce((s, p) => s + (p.price ?? 0), 0);
  const revenueDelta =
    revenueLastMonth > 0 ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100 : 0;

  // Leads per day (last 30 days)
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

  const pendingPurchases = allPurchases.filter((p) => p.status === "pending");
  const receivedPurchases = allPurchases.filter((p) => p.status === "received");
  const pendingPurchasesCost = pendingPurchases.reduce((s, p) => s + (p.actual_price ?? p.estimated_price ?? 0), 0);
  const receivedPurchasesCost = receivedPurchases.reduce((s, p) => s + (p.actual_price ?? p.estimated_price ?? 0), 0);
  const shippingCosts = allShipments
    .filter((s) => isThisMonth(s.created_at))
    .reduce((s, sh) => s + (sh.price ?? 0), 0);

  const allFixed = fixedExpenses ?? [];
  const monthlyFixedCost = allFixed.reduce((sum, e) => {
    if (e.frequency === "monthly") return sum + e.amount;
    if (e.frequency === "quarterly") return sum + e.amount / 3;
    if (e.frequency === "annual") return sum + e.amount / 12;
    return sum + e.amount;
  }, 0);

  const totalExpenses = receivedPurchasesCost + shippingCosts + monthlyFixedCost;
  const balance = revenueThisMonth - totalExpenses;

  const nextTax = getNextTaxDeadline(taxPayments ?? []);

  /* ── Leads funnel ── */

  const leadStatuses = ["new", "contacted", "quoted", "won"] as const;
  const leadStatusLabels: Record<string, string> = {
    new: "Nuevos",
    contacted: "Contactados",
    quoted: "Presupuestados",
    won: "Ganados",
  };
  const leadCounts: Record<string, number> = {};
  for (const s of [...leadStatuses, "lost" as const]) leadCounts[s] = 0;
  for (const l of allLeads) {
    if (leadCounts[l.status] !== undefined) leadCounts[l.status]++;
  }
  const funnelMax = Math.max(...leadStatuses.map((s) => leadCounts[s]), 1);
  const wonLost = leadCounts["won"] + leadCounts["lost"];
  const conversionRate = wonLost > 0 ? Math.round((leadCounts["won"] / wonLost) * 100) : 0;

  /* ── Shipments ── */

  const shipmentsInTransit = allShipments.filter(
    (s) => s.shipment_status?.toLowerCase().includes("transit")
  );
  const shipmentsDelivered = allShipments.filter(
    (s) => s.shipment_status === "delivered" && isThisMonth(s.delivered_at)
  );
  const shipmentsPending = allShipments.filter(
    (s) =>
      s.shipment_status &&
      s.shipment_status !== "delivered" &&
      !s.shipment_status.toLowerCase().includes("transit")
  );
  const recentShipments = allShipments.slice(0, 5);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Panel de Control</h1>

      {/* ── 1. KPI Cards ── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Proyectos activos" value={confirmedProjects.length} />
        <KpiCard label="Impresoras activas" value={`${activePrinters.length}/${allPrinters.length}`} />
        <KpiCard label="Jobs en cola" value={queuedJobs.length} />
        <KpiCard label="Facturación mes" value={formatEur(revenueThisMonth)} />
        <KpiCard label="Leads abiertos" value={openLeads.length} />
        <KpiCard label="Envíos pendientes" value={pendingShipments.length} />
      </div>

      {/* ── 2. Producción ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Printers grid */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">Impresoras</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {allPrinters.map((printer) => {
              const isRunning = printer.gcode_state === "RUNNING";
              return (
                <div
                  key={printer.id}
                  className="rounded-lg border border-zinc-100 p-2.5 dark:border-zinc-800"
                >
                  <div className="flex items-center gap-1.5">
                    <PrinterDot state={printer.gcode_state} online={printer.online} />
                    <span className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      {printer.name}
                    </span>
                  </div>
                  {isRunning && printer.print_percent != null && (
                    <div className="mt-1.5">
                      <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-1.5 rounded-full bg-green-500 transition-all"
                          style={{ width: `${printer.print_percent}%` }}
                        />
                      </div>
                      <p className="mt-0.5 text-[10px] text-zinc-400">
                        {printer.print_percent}%
                        {printer.remaining_minutes != null && ` · ${formatMinutes(printer.remaining_minutes)}`}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Active jobs */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">Jobs activos</h2>
          {activeJobs.length === 0 ? (
            <p className="text-sm text-zinc-400">No hay jobs activos</p>
          ) : (
            <div className="space-y-2">
              {activeJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        job.status === "printing" ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-600"
                      }`}
                    />
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">
                      {job.printer_id ? printerMap.get(job.printer_id) ?? "—" : "Sin asignar"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        job.status === "printing"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {job.status === "printing" ? "Imprimiendo" : "En cola"}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {formatMinutes(job.estimated_minutes)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Pipeline de proyectos ── */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">Pipeline de producción</h2>

        {/* Segmented bar */}
        <div className="flex h-6 w-full overflow-hidden rounded-full">
          {COLUMNS.map((col) => {
            const pct = (pipelineCounts[col.id] / pipelineTotal) * 100;
            if (pct === 0) return null;
            return (
              <div
                key={col.id}
                className={`${col.accent} flex items-center justify-center transition-all`}
                style={{ width: `${pct}%` }}
              >
                {pct > 8 && (
                  <span className="text-[10px] font-medium text-white">{pipelineCounts[col.id]}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Labels */}
        <div className="mt-2 flex flex-wrap gap-3">
          {COLUMNS.map((col) => (
            <div key={col.id} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${col.accent}`} />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {col.label}: {pipelineCounts[col.id]}
              </span>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-4 flex flex-wrap gap-6 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <div>
            <p className="text-xs text-zinc-400">Upcoming</p>
            <p className="text-sm font-medium text-zinc-900 dark:text-white">
              {upcomingProjects.length} · {formatEur(upcomingValue)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Confirmados</p>
            <p className="text-sm font-medium text-zinc-900 dark:text-white">
              {confirmedProjects.length} · {formatEur(confirmedValue)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Overdue</p>
            <p className={`text-sm font-medium ${overdueProjects.length > 0 ? "text-red-500" : "text-zinc-900 dark:text-white"}`}>
              {overdueProjects.length}
            </p>
          </div>
        </div>
      </div>

      {/* ── 4. Facturacion + Leads ── */}
      <div className="grid gap-4 md:grid-cols-2">
        <BillingBreakdown
          currentMonth={{
            label: MONTH_NAMES[curMonth],
            total: revenueThisMonth,
            projects: curBillingList.map((p) => ({ name: p.name, client_name: p.client_name, price: p.price ?? 0 })),
          }}
          previousMonth={{
            label: MONTH_NAMES[prevM.getMonth()],
            total: revenueLastMonth,
            projects: prevBillingList.map((p) => ({ name: p.name, client_name: p.client_name, price: p.price ?? 0 })),
          }}
          delta={revenueDelta}
        />
        <LeadsChart data={leadsPerDay} />
      </div>

      {/* ── 5. Gastos ── */}
      <div className="grid gap-4 md:grid-cols-2">

        {/* Gastos */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Gastos</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Compras pendientes</span>
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {formatEur(pendingPurchasesCost)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Compras recibidas</span>
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {formatEur(receivedPurchasesCost)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Costes envío</span>
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {formatEur(shippingCosts)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-zinc-100 pt-2 dark:border-zinc-800">
              <span className="text-xs text-zinc-400">Gastos fijos (mensual)</span>
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {formatEur(monthlyFixedCost)}
              </span>
            </div>
          </div>
        </div>

        {/* Balance */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Balance</h2>
          <p
            className={`text-2xl font-bold ${
              balance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"
            }`}
          >
            {formatEur(balance)}
          </p>
          <p className="text-xs text-zinc-400">Ingresos - Gastos variables - Gastos fijos</p>
        </div>
      </div>

      {/* ── Alerta fiscal ── */}
      {nextTax && (
        <div
          className={`rounded-xl border p-4 ${
            nextTax.daysLeft <= 7
              ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
              : nextTax.daysLeft <= 30
                ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
                : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className={`text-sm font-semibold ${
                  nextTax.daysLeft <= 7
                    ? "text-red-700 dark:text-red-400"
                    : nextTax.daysLeft <= 30
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-zinc-700 dark:text-zinc-300"
                }`}
              >
                Proximo impuesto: {nextTax.name}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Vence el {new Date(nextTax.dueDate).toLocaleDateString("es-ES")} ({nextTax.daysLeft} dias)
              </p>
            </div>
            <Link
              href="/dashboard/finanzas"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Ver finanzas
            </Link>
          </div>
        </div>
      )}

      {/* ── 5. Embudo de leads ── */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">Embudo de leads</h2>
        <div className="space-y-2">
          {leadStatuses.map((s) => (
            <div key={s} className="flex items-center gap-3">
              <span className="w-28 text-xs text-zinc-500 dark:text-zinc-400">{leadStatusLabels[s]}</span>
              <div className="flex-1">
                <div
                  className="h-5 rounded bg-green-500/80 transition-all dark:bg-green-600/60"
                  style={{ width: `${(leadCounts[s] / funnelMax) * 100}%`, minWidth: leadCounts[s] > 0 ? "20px" : "0" }}
                />
              </div>
              <span className="w-8 text-right text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {leadCounts[s]}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <span className="text-xs text-zinc-400">Perdidos: {leadCounts["lost"]}</span>
          <span className="text-xs text-zinc-400">Conversión: {conversionRate}%</span>
        </div>
      </div>

      {/* ── 6. Envíos ── */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">Pendientes</h2>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{shipmentsPending.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">En tránsito</h2>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{shipmentsInTransit.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">Entregados este mes</h2>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{shipmentsDelivered.length}</p>
        </div>
      </div>

      {/* Recent shipments */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">Envíos recientes</h2>
        {recentShipments.length === 0 ? (
          <p className="text-sm text-zinc-400">No hay envíos</p>
        ) : (
          <div className="space-y-2">
            {recentShipments.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
              >
                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                  {s.created_at ? new Date(s.created_at).toLocaleDateString("es-ES") : "—"}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    s.shipment_status === "delivered"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : s.shipment_status?.toLowerCase().includes("transit")
                        ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {s.shipment_status ?? "—"}
                </span>
                {s.price != null && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatEur(s.price)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
