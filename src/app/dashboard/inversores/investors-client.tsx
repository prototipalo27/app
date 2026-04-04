"use client";

import { useState, useEffect, useCallback, useTransition, useRef } from "react";
import {
  createInvestor,
  updateInvestor,
  deleteInvestor,
  upsertQuarterlyReport,
  deleteQuarterlyReport,
  getReportClients,
  populateReportClients,
  updateReportClient,
  addReportClient,
  deleteReportClient,
  type ReportClient,
  type ClientProject,
} from "./actions";

type Investor = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  equity_pct: number;
  invested_amount: number;
  join_date: string | null;
  notes: string | null;
  is_active: boolean;
};

type QuarterlyReport = {
  id: string;
  quarter: number;
  year: number;
  revenue: number;
  expenses: number;
  net_profit: number;
  cash_balance: number;
  projects_completed: number;
  new_clients: number;
  summary: string | null;
  highlights: string | null;
  challenges: string | null;
  next_quarter_goals: string | null;
};

const inputClass =
  "mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500";

const labelClass = "block text-xs font-medium text-zinc-500 dark:text-zinc-400";

function formatCurrency(n: number) {
  return n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

export default function InvestorsClient({
  investors,
  reports,
}: {
  investors: Investor[];
  reports: QuarterlyReport[];
}) {
  const [tab, setTab] = useState<"investors" | "reports">("investors");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Inversores
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Gestión de equity e informes trimestrales para inversores.
        </p>
      </div>

      <div className="mb-6 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
        <button
          onClick={() => setTab("investors")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "investors"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          }`}
        >
          Socios & Equity
        </button>
        <button
          onClick={() => setTab("reports")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "reports"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          }`}
        >
          Informes trimestrales
        </button>
      </div>

      {tab === "investors" ? (
        <InvestorsTab investors={investors} />
      ) : (
        <ReportsTab reports={reports} />
      )}
    </div>
  );
}

// ─── Investors Tab ────────────────────────────────────────────────

function InvestorsTab({ investors }: { investors: Investor[] }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Investor | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalEquity = investors.reduce((sum, i) => sum + Number(i.equity_pct), 0);
  const totalInvested = investors.reduce((sum, i) => sum + Number(i.invested_amount), 0);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      if (editing) {
        await updateInvestor(editing.id, formData);
        setEditing(null);
      } else {
        await createInvestor(formData);
      }
      setShowForm(false);
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Eliminar este inversor?")) return;
    startTransition(async () => {
      await deleteInvestor(id);
    });
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Socios activos</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
            {investors.filter((i) => i.is_active).length}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Equity asignado</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
            {totalEquity.toFixed(2)}%
          </p>
          {totalEquity < 100 && (
            <p className="text-xs text-zinc-400">{(100 - totalEquity).toFixed(2)}% sin asignar</p>
          )}
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total invertido</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
            {formatCurrency(totalInvested)}
          </p>
        </div>
      </div>

      {/* Equity bar */}
      {investors.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">Distribución de equity</p>
          <div className="flex h-8 overflow-hidden rounded-full">
            {investors
              .filter((i) => i.is_active && i.equity_pct > 0)
              .map((investor, idx) => {
                const colors = [
                  "bg-green-500", "bg-blue-500", "bg-purple-500",
                  "bg-amber-500", "bg-rose-500", "bg-cyan-500",
                  "bg-indigo-500", "bg-orange-500",
                ];
                return (
                  <div
                    key={investor.id}
                    className={`${colors[idx % colors.length]} flex items-center justify-center text-[10px] font-bold text-white`}
                    style={{ width: `${investor.equity_pct}%` }}
                    title={`${investor.full_name}: ${investor.equity_pct}%`}
                  >
                    {investor.equity_pct >= 8 ? `${investor.full_name.split(" ")[0]} ${investor.equity_pct}%` : ""}
                  </div>
                );
              })}
            {totalEquity < 100 && (
              <div
                className="flex items-center justify-center bg-zinc-200 text-[10px] font-medium text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
                style={{ width: `${100 - totalEquity}%` }}
              >
                {100 - totalEquity >= 8 ? `Sin asignar ${(100 - totalEquity).toFixed(2)}%` : ""}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Investors table */}
      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Socios</h2>
          <button
            onClick={() => { setEditing(null); setShowForm(!showForm); }}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
          >
            + Añadir socio
          </button>
        </div>

        {(showForm || editing) && (
          <InvestorForm
            investor={editing}
            isPending={isPending}
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        )}

        {investors.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-400">No hay inversores registrados.</p>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {investors.map((investor) => (
              <div
                key={investor.id}
                className={`flex items-center gap-4 px-4 py-3 ${!investor.is_active ? "opacity-50" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">
                    {investor.full_name}
                    {!investor.is_active && (
                      <span className="ml-2 text-xs text-zinc-400">(inactivo)</span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {investor.email}
                    {investor.join_date && ` · Desde ${new Date(investor.join_date).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-zinc-900 dark:text-white">{Number(investor.equity_pct).toFixed(2)}%</p>
                  <p className="text-xs text-zinc-500">{formatCurrency(Number(investor.invested_amount))}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditing(investor); setShowForm(false); }}
                    className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                    title="Editar"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(investor.id)}
                    className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                    title="Eliminar"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InvestorForm({
  investor,
  isPending,
  onSubmit,
  onCancel,
}: {
  investor: Investor | null;
  isPending: boolean;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
}) {
  return (
    <form action={onSubmit} className="border-b border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Nombre completo *</label>
          <input name="full_name" required defaultValue={investor?.full_name} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input name="email" type="email" defaultValue={investor?.email ?? ""} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Teléfono</label>
          <input name="phone" defaultValue={investor?.phone ?? ""} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Fecha de entrada</label>
          <input name="join_date" type="date" defaultValue={investor?.join_date ?? ""} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Equity (%)</label>
          <input name="equity_pct" type="number" step="0.01" min="0" max="100" defaultValue={investor?.equity_pct ?? 0} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Capital invertido (EUR)</label>
          <input name="invested_amount" type="number" step="0.01" min="0" defaultValue={investor?.invested_amount ?? 0} className={inputClass} />
        </div>
        <div className="col-span-2">
          <label className={labelClass}>Notas</label>
          <textarea name="notes" rows={2} defaultValue={investor?.notes ?? ""} className={inputClass} />
        </div>
        {investor && (
          <div>
            <label className={labelClass}>Activo</label>
            <select name="is_active" defaultValue={investor.is_active ? "true" : "false"} className={inputClass}>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </div>
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {isPending ? "Guardando..." : investor ? "Guardar cambios" : "Añadir socio"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────

function ReportsTab({ reports }: { reports: QuarterlyReport[] }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<QuarterlyReport | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [clientRevenue, setClientRevenue] = useState<Record<string, number>>({});

  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await upsertQuarterlyReport(formData);
      setShowForm(false);
      setEditing(null);
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Eliminar este informe?")) return;
    startTransition(async () => {
      await deleteQuarterlyReport(id);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Informes trimestrales
        </h2>
        <button
          onClick={() => { setEditing(null); setShowForm(!showForm); }}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
        >
          + Nuevo informe
        </button>
      </div>

      {(showForm || editing) && (
        <ReportForm
          report={editing}
          defaultQuarter={currentQuarter}
          defaultYear={currentYear}
          isPending={isPending}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {reports.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-400">No hay informes trimestrales todavía.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            >
              {/* Header */}
              <button
                onClick={() => setExpanded(expanded === report.id ? null : report.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-green-100 px-2.5 py-1 text-sm font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Q{report.quarter} {report.year}
                  </span>
                  <div className="flex gap-4 text-sm">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      Facturación: <span className="font-medium text-zinc-900 dark:text-white">{formatCurrency(clientRevenue[report.id] ?? Number(report.revenue))}</span>
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400">
                      Beneficio: <span className={`font-medium ${Number(report.net_profit) >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(Number(report.net_profit))}</span>
                    </span>
                  </div>
                </div>
                <svg
                  className={`h-5 w-5 text-zinc-400 transition-transform ${expanded === report.id ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded content */}
              {expanded === report.id && (
                <div className="border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">
                  {/* Financial metrics */}
                  <div className="mb-4 grid grid-cols-3 gap-4 sm:grid-cols-5">
                    <Metric label="Facturación" value={formatCurrency(clientRevenue[report.id] ?? Number(report.revenue))} />
                    <Metric label="Gastos" value={formatCurrency(Number(report.expenses))} />
                    <Metric label="Beneficio neto" value={formatCurrency(Number(report.net_profit))} color={Number(report.net_profit) >= 0 ? "green" : "red"} />
                    <Metric label="Saldo en caja" value={formatCurrency(Number(report.cash_balance))} />
                    <Metric label="Nuevos clientes" value={String(report.new_clients)} />
                  </div>

                  {/* Text sections */}
                  <div className="space-y-3">
                    {report.summary && (
                      <TextSection label="Resumen" content={report.summary} />
                    )}
                    {report.highlights && (
                      <TextSection label="Hitos destacados" content={report.highlights} />
                    )}
                    {report.challenges && (
                      <TextSection label="Retos" content={report.challenges} />
                    )}
                    {report.next_quarter_goals && (
                      <TextSection label="Objetivos próximo trimestre" content={report.next_quarter_goals} />
                    )}
                  </div>

                  {/* Clients section (editable) */}
                  <QuarterClientsSection
                    reportId={report.id}
                    quarter={report.quarter}
                    year={report.year}
                    onRevenueChange={(total) => setClientRevenue((prev) => {
                      if (prev[report.id] === total) return prev;
                      return { ...prev, [report.id]: total };
                    })}
                  />

                  {/* Actions */}
                  <div className="mt-4 flex gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    <button
                      onClick={() => { setEditing(report); setShowForm(false); }}
                      className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(report.id)}
                      className="text-xs font-medium text-red-500 hover:text-red-700"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: "green" | "red" }) {
  const valueColor = color === "green"
    ? "text-green-600 dark:text-green-400"
    : color === "red"
      ? "text-red-600 dark:text-red-400"
      : "text-zinc-900 dark:text-white";

  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`text-sm font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}

function TextSection({ label, content }: { label: string; content: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">{content}</p>
    </div>
  );
}

function SortHeader({ label, sortKey: sk, currentKey, asc, onSort, className }: {
  label: string;
  sortKey: "name" | "source" | "quarter" | "lifetime";
  currentKey: string;
  asc: boolean;
  onSort: (key: "name" | "source" | "quarter" | "lifetime") => void;
  className?: string;
}) {
  const active = currentKey === sk;
  return (
    <button onClick={() => onSort(sk)} className={`flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-300 ${className ?? ""}`}>
      {label}
      {active && (
        <svg className={`h-3 w-3 transition-transform ${asc ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      )}
    </button>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  webflow: "Web", email: "Email", whatsapp: "WhatsApp", phone: "Teléfono",
  referral: "Referido", instagram: "Instagram", linkedin: "LinkedIn",
  directo: "Directo", manual: "Manual",
};
const SOURCE_OPTIONS = Object.entries(SOURCE_LABELS);

function QuarterClientsSection({ reportId, quarter, year, onRevenueChange }: { reportId: string; quarter: number; year: number; onRevenueChange: (total: number) => void }) {
  const [clients, setClients] = useState<ReportClient[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [shown, setShown] = useState(false);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [sortKey, setSortKey] = useState<"name" | "source" | "quarter" | "lifetime">("quarter");
  const [sortAsc, setSortAsc] = useState(false);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === "name"); }
  }

  async function loadClients() {
    if (clients) { setShown(!shown); return; }
    setLoading(true);
    const result = await getReportClients(reportId);
    setClients((result.data ?? []) as ReportClient[]);
    setShown(true);
    setLoading(false);
  }

  function handlePopulate() {
    startTransition(async () => {
      const result = await populateReportClients(reportId, quarter, year);
      if (result.error) { alert(result.error); return; }
      const fresh = await getReportClients(reportId);
      setClients((fresh.data ?? []) as ReportClient[]);
    });
  }

  function handleAddClient() {
    startTransition(async () => {
      await addReportClient(reportId);
      const fresh = await getReportClients(reportId);
      setClients((fresh.data ?? []) as ReportClient[]);
    });
  }

  function handleDeleteClient(id: string) {
    if (!confirm("Eliminar este cliente?")) return;
    startTransition(async () => {
      await deleteReportClient(id);
      setClients((prev) => prev?.filter((c) => c.id !== id) ?? null);
    });
  }

  function handleUpdateClient(id: string, updates: Parameters<typeof updateReportClient>[1]) {
    // Optimistic
    setClients((prev) =>
      prev?.map((c) => (c.id === id ? { ...c, ...updates } as ReportClient : c)) ?? null
    );
    startTransition(async () => {
      await updateReportClient(id, updates);
    });
  }

  function sortedClients(list: ReportClient[]) {
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = a.client_name.localeCompare(b.client_name); break;
        case "source": cmp = (a.source || "").localeCompare(b.source || ""); break;
        case "quarter": cmp = Number(a.quarter_value) - Number(b.quarter_value); break;
        case "lifetime": cmp = Number(a.lifetime_value) - Number(b.lifetime_value); break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }

  const recurring = clients?.filter((c) => c.is_recurring).length ?? 0;
  const totalQuarterValue = clients?.reduce((s, c) => s + Number(c.quarter_value), 0) ?? 0;

  const onRevenueRef = useRef(onRevenueChange);
  onRevenueRef.current = onRevenueChange;
  const prevRevenue = useRef<number | null>(null);

  useEffect(() => {
    if (clients && totalQuarterValue !== prevRevenue.current) {
      prevRevenue.current = totalQuarterValue;
      onRevenueRef.current(totalQuarterValue);
    }
  }, [clients, totalQuarterValue]);
  const sourceCounts: Record<string, number> = {};
  if (clients) {
    for (const c of clients) sourceCounts[c.source || "directo"] = (sourceCounts[c.source || "directo"] || 0) + 1;
  }

  return (
    <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
      <button
        onClick={loadClients}
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
      >
        <svg className={`h-3 w-3 transition-transform ${shown ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Clientes del trimestre
        {loading && <span className="text-zinc-400">cargando...</span>}
      </button>

      {shown && clients !== null && (
        <div className={`mt-3 space-y-3 ${isPending ? "opacity-70 pointer-events-none" : ""}`}>
          {/* Summary */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{clients.length} clientes</span>
            <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">{clients.length - recurring} nuevos</span>
            {recurring > 0 && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{recurring} recurrentes</span>}
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{formatCurrency(totalQuarterValue)} trimestre</span>
            {Object.entries(sourceCounts).map(([src, n]) => (
              <span key={src} className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                {SOURCE_LABELS[src] || src}: {n}
              </span>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {clients.length === 0 && (
              <button onClick={handlePopulate} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                Cargar desde proyectos
              </button>
            )}
            <button onClick={handleAddClient} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
              + Añadir cliente
            </button>
          </div>

          {/* Client table */}
          {clients.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <div className="w-4 shrink-0" />
                <SortHeader label="Cliente" sortKey="name" currentKey={sortKey} asc={sortAsc} onSort={toggleSort} className="min-w-0 flex-1" />
                <SortHeader label="Canal" sortKey="source" currentKey={sortKey} asc={sortAsc} onSort={toggleSort} className="w-20 text-center" />
                <div className="w-[72px] text-center">Tipo</div>
                <SortHeader label="Trimestre" sortKey="quarter" currentKey={sortKey} asc={sortAsc} onSort={toggleSort} className="w-24 text-right" />
                <SortHeader label="Lifetime" sortKey="lifetime" currentKey={sortKey} asc={sortAsc} onSort={toggleSort} className="w-24 text-right" />
                <div className="w-8 shrink-0" />
              </div>

              {/* Rows */}
              {sortedClients(clients).map((client) => {
                const rawProjects = client.projects;
                const projects: ClientProject[] = Array.isArray(rawProjects)
                  ? rawProjects
                  : typeof rawProjects === "string"
                    ? JSON.parse(rawProjects)
                    : [];
                const isExpanded = expandedClient === client.id;

                return (
                  <div key={client.id} className={`border-b border-zinc-100 last:border-b-0 dark:border-zinc-800 ${isExpanded ? "bg-zinc-50/50 dark:bg-zinc-950/50" : ""}`}>
                    {/* Client row */}
                    <div className="flex items-center gap-3 px-4 py-2.5">
                      <button
                        onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                        className="shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                      >
                        <svg className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <input
                            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-zinc-900 focus:outline-none dark:text-white"
                            defaultValue={client.client_name}
                            onBlur={(e) => handleUpdateClient(client.id, { client_name: e.target.value })}
                          />
                          {projects.length > 1 && (
                            <span className="shrink-0 text-[10px] text-zinc-400">{projects.length} fact.</span>
                          )}
                        </div>
                      </div>

                      <select
                        className="w-20 rounded border border-zinc-200 bg-transparent px-1.5 py-0.5 text-[11px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                        value={client.source}
                        onChange={(e) => handleUpdateClient(client.id, { source: e.target.value })}
                      >
                        {SOURCE_OPTIONS.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                      </select>

                      <button
                        onClick={() => handleUpdateClient(client.id, { is_recurring: !client.is_recurring })}
                        className={`w-[72px] shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-medium ${
                          client.is_recurring
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        }`}
                      >
                        {client.is_recurring ? "Recurrente" : "Nuevo"}
                      </button>

                      <input
                        type="number" step="0.01"
                        className="w-24 bg-transparent text-right text-sm font-bold text-zinc-900 focus:outline-none dark:text-white"
                        defaultValue={Number(client.quarter_value)}
                        onBlur={(e) => handleUpdateClient(client.id, { quarter_value: parseFloat(e.target.value) || 0 })}
                      />

                      <input
                        type="number" step="0.01"
                        className="w-24 bg-transparent text-right text-sm text-zinc-500 focus:outline-none dark:text-zinc-400"
                        defaultValue={Number(client.lifetime_value)}
                        onBlur={(e) => handleUpdateClient(client.id, { lifetime_value: parseFloat(e.target.value) || 0 })}
                      />

                      <button onClick={() => handleDeleteClient(client.id)} className="shrink-0 text-zinc-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Expanded: invoices/projects */}
                    {isExpanded && (
                      <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-2 pl-11 dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="space-y-1.5">
                          {projects.map((proj, idx) => (
                            <div key={`${client.id}-${idx}-${projects.length}`} className="flex items-center gap-2 rounded border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
                              <input
                                className="min-w-0 flex-1 bg-transparent text-xs text-zinc-700 focus:outline-none dark:text-zinc-300"
                                defaultValue={proj.name}
                                placeholder="Factura / proyecto"
                                onBlur={(e) => {
                                  const updated = [...projects];
                                  updated[idx] = { ...updated[idx], name: e.target.value };
                                  handleUpdateClient(client.id, { projects: updated });
                                }}
                              />
                              <input
                                className="w-48 bg-transparent text-xs text-zinc-400 placeholder-zinc-300 focus:outline-none dark:placeholder-zinc-600"
                                defaultValue={proj.description}
                                placeholder="Descripción..."
                                onBlur={(e) => {
                                  const updated = [...projects];
                                  updated[idx] = { ...updated[idx], description: e.target.value };
                                  handleUpdateClient(client.id, { projects: updated });
                                }}
                              />
                              <input
                                type="number" step="0.01"
                                className="w-20 bg-transparent text-right text-xs font-medium text-zinc-900 focus:outline-none dark:text-white"
                                defaultValue={proj.value}
                                onBlur={(e) => {
                                  const updated = [...projects];
                                  updated[idx] = { ...updated[idx], value: parseFloat(e.target.value) || 0 };
                                  handleUpdateClient(client.id, { projects: updated });
                                }}
                              />
                              <button
                                onClick={() => {
                                  const updated = projects.filter((_, i) => i !== idx);
                                  handleUpdateClient(client.id, { projects: updated });
                                }}
                                className="shrink-0 text-zinc-300 hover:text-red-500 dark:text-zinc-600"
                              >
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        const updated = [...projects, { name: "Nuevo proyecto", description: "", value: 0 }];
                        handleUpdateClient(client.id, { projects: updated });
                      }}
                      className="mt-2 text-xs font-medium text-green-600 hover:text-green-700 dark:text-green-400"
                    >
                      + Añadir factura
                    </button>
                  </div>
                )}
              </div>
            );
          })}

            {/* Footer with total */}
            <div className="flex items-center gap-3 border-t border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="w-4 shrink-0" />
              <div className="min-w-0 flex-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Total ({clients.length} clientes)
              </div>
              <div className="w-20" />
              <div className="w-[72px]" />
              <div className="w-24 text-right text-sm font-bold text-zinc-900 dark:text-white">
                {formatCurrency(totalQuarterValue)}
              </div>
              <div className="w-24" />
              <div className="w-8 shrink-0" />
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReportForm({
  report,
  defaultQuarter,
  defaultYear,
  isPending,
  onSubmit,
  onCancel,
}: {
  report: QuarterlyReport | null;
  defaultQuarter: number;
  defaultYear: number;
  isPending: boolean;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
}) {
  return (
    <form action={onSubmit} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
      {report && <input type="hidden" name="id" value={report.id} />}

      <p className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
        {report ? `Editar Q${report.quarter} ${report.year}` : "Nuevo informe trimestral"}
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <label className={labelClass}>Trimestre *</label>
          <select name="quarter" defaultValue={report?.quarter ?? defaultQuarter} className={inputClass} required>
            <option value={1}>Q1 (Ene-Mar)</option>
            <option value={2}>Q2 (Abr-Jun)</option>
            <option value={3}>Q3 (Jul-Sep)</option>
            <option value={4}>Q4 (Oct-Dic)</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Año *</label>
          <input name="year" type="number" min={2020} max={2040} defaultValue={report?.year ?? defaultYear} className={inputClass} required />
        </div>
        <div>
          <label className={labelClass}>Gastos (EUR)</label>
          <input name="expenses" type="number" step="0.01" defaultValue={report?.expenses ?? 0} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Beneficio neto (EUR)</label>
          <input name="net_profit" type="number" step="0.01" defaultValue={report?.net_profit ?? 0} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Saldo en caja (EUR)</label>
          <input name="cash_balance" type="number" step="0.01" defaultValue={report?.cash_balance ?? 0} className={inputClass} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Resumen</label>
          <textarea name="summary" rows={3} defaultValue={report?.summary ?? ""} className={inputClass} placeholder="Resumen general del trimestre..." />
        </div>
        <div>
          <label className={labelClass}>Hitos destacados</label>
          <textarea name="highlights" rows={3} defaultValue={report?.highlights ?? ""} className={inputClass} placeholder="Logros y avances clave..." />
        </div>
        <div>
          <label className={labelClass}>Retos</label>
          <textarea name="challenges" rows={3} defaultValue={report?.challenges ?? ""} className={inputClass} placeholder="Problemas o dificultades encontradas..." />
        </div>
        <div>
          <label className={labelClass}>Objetivos próximo trimestre</label>
          <textarea name="next_quarter_goals" rows={3} defaultValue={report?.next_quarter_goals ?? ""} className={inputClass} placeholder="Metas para el siguiente trimestre..." />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {isPending ? "Guardando..." : report ? "Guardar cambios" : "Crear informe"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          Cancelar
        </button>
      </div>
    </form>
  );
}
