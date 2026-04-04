"use client";

import { useState } from "react";

type Investor = {
  id: string;
  full_name: string;
  equity_pct: number;
  invested_amount: number;
  shares: number;
  join_date: string | null;
};

type InvestorSummary = {
  id: string;
  full_name: string;
  equity_pct: number;
  shares: number;
};

type ClientProject = { name: string; description: string; value: number };

type ReportClient = {
  id: string;
  client_name: string;
  quarter_value: number;
  lifetime_value: number;
  is_recurring: boolean;
  source: string;
  projects: ClientProject[] | string;
};

type ReportExpense = {
  id: string;
  category: string;
  amount: number;
  vendor_count: number;
};

type Report = {
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
  video_url: string | null;
  clients: ReportClient[];
  expenses_breakdown: ReportExpense[];
};

type TeamMember = {
  id: string;
  full_name: string | null;
  nickname: string | null;
  role: string;
};

type Printer = {
  id: string;
  name: string;
  model: string | null;
  online: boolean | null;
  gcode_state: string | null;
  print_percent: number | null;
  remaining_minutes: number | null;
  current_file: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Dirección",
  manager: "Manager",
  comercial: "Comercial",
  employee: "Producción",
};

const EXPENSE_LABELS: Record<string, string> = {
  materials: "Materiales", shipping: "Envíos", software: "Software",
  payroll: "Nóminas", financing: "Financiación", banking: "Banca",
  taxes: "Impuestos", rent: "Alquiler", utilities: "Suministros",
  telecom: "Telecomunicaciones", insurance: "Seguros", fuel: "Combustible",
  meals: "Comidas", travel: "Viajes", marketing: "Marketing",
  professional: "Servicios prof.", other: "Otros",
};

const EXPENSE_COLORS: Record<string, string> = {
  payroll: "bg-blue-500", rent: "bg-amber-500", materials: "bg-green-500",
  shipping: "bg-cyan-500", software: "bg-purple-500", financing: "bg-rose-500",
  banking: "bg-zinc-500", taxes: "bg-red-500", utilities: "bg-yellow-500",
  telecom: "bg-indigo-500", insurance: "bg-orange-500", fuel: "bg-lime-500",
  meals: "bg-pink-500", travel: "bg-teal-500", marketing: "bg-violet-500",
  professional: "bg-sky-500", other: "bg-zinc-400",
};

const PRINTER_STATES: Record<string, { label: string; color: string }> = {
  RUNNING: { label: "Imprimiendo", color: "bg-green-500" },
  PREPARE: { label: "Preparando", color: "bg-yellow-500" },
  IDLE: { label: "Libre", color: "bg-zinc-300 dark:bg-zinc-600" },
  PAUSE: { label: "Pausada", color: "bg-orange-500" },
  FINISH: { label: "Terminada", color: "bg-blue-500" },
  FAILED: { label: "Error", color: "bg-red-500" },
};

function fmt(n: number) {
  return n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

export default function InvestorPortalClient({
  investor,
  allInvestors,
  reports,
  team,
  printers,
}: {
  investor: Investor;
  allInvestors: InvestorSummary[];
  reports: Report[];
  team: TeamMember[];
  printers: Printer[];
}) {
  return (
    <main className="mx-auto max-w-5xl space-y-10 px-6 py-8">
      {/* ── Welcome ── */}
      <section>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
          Hola, {investor.full_name.split(" ")[0]}
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Bienvenido al portal de inversores de Prototipalo. Aquí puedes ver el estado de la empresa, tu participación y los informes trimestrales.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card label="Tu equity" value={`${Number(investor.equity_pct).toFixed(2)}%`} />
          <Card label="Participaciones" value={String(investor.shares)} />
          <Card label="Capital invertido" value={fmt(Number(investor.invested_amount))} />
          <Card label="Socio desde" value={investor.join_date ? new Date(investor.join_date).toLocaleDateString("es-ES", { month: "long", year: "numeric" }) : "—"} />
        </div>
      </section>

      {/* ── Cap Table ── */}
      <section>
        <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-white">Distribución de equity</h2>

        {/* Bar */}
        <div className="mb-4 flex h-8 overflow-hidden rounded-full">
          {allInvestors.filter((i) => i.equity_pct > 0).map((inv, idx) => {
            const colors = ["bg-green-500", "bg-blue-500", "bg-purple-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-indigo-500"];
            const isMe = inv.id === investor.id;
            return (
              <div
                key={inv.id}
                className={`${colors[idx % colors.length]} flex items-center justify-center text-[10px] font-bold text-white ${isMe ? "ring-2 ring-white ring-offset-1 dark:ring-offset-black" : ""}`}
                style={{ width: `${inv.equity_pct}%` }}
                title={`${inv.full_name}: ${inv.equity_pct}%`}
              >
                {inv.equity_pct >= 8 ? `${inv.full_name.split(" ")[0]} ${Number(inv.equity_pct).toFixed(1)}%` : ""}
              </div>
            );
          })}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2 text-left">Socio</th>
                <th className="px-4 py-2 text-right">Participaciones</th>
                <th className="px-4 py-2 text-right">Equity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {allInvestors.map((inv) => (
                <tr key={inv.id} className={inv.id === investor.id ? "bg-green-50 dark:bg-green-900/10" : ""}>
                  <td className="px-4 py-2 font-medium text-zinc-900 dark:text-white">
                    {inv.full_name}
                    {inv.id === investor.id && <span className="ml-2 text-xs text-green-600">(tú)</span>}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400">{inv.shares.toLocaleString("es-ES")}</td>
                  <td className="px-4 py-2 text-right font-bold text-zinc-900 dark:text-white">{Number(inv.equity_pct).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Team ── */}
      <section>
        <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-white">Equipo ({team.length})</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {team.map((member) => (
            <div key={member.id} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                {(member.nickname || member.full_name || "?")[0].toUpperCase()}
              </div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">
                {member.nickname || member.full_name || "—"}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {ROLE_LABELS[member.role] || member.role}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Printers ── */}
      <section>
        <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-white">Maquinaria ({printers.length} impresoras)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {printers.map((printer) => {
            const state = PRINTER_STATES[printer.gcode_state || ""] || PRINTER_STATES.IDLE;
            const isOnline = printer.online;
            return (
              <div key={printer.id} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-bold text-zinc-900 dark:text-white">{printer.name}</p>
                  <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? state.color : "bg-zinc-300 dark:bg-zinc-700"}`} title={isOnline ? state.label : "Offline"} />
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{printer.model || "—"}</p>
                {isOnline && printer.gcode_state === "RUNNING" && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span>{printer.print_percent}%</span>
                      {printer.remaining_minutes != null && (
                        <span>{Math.floor(printer.remaining_minutes / 60)}h {printer.remaining_minutes % 60}m</span>
                      )}
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                      <div className="h-full rounded-full bg-green-500" style={{ width: `${printer.print_percent}%` }} />
                    </div>
                  </div>
                )}
                {!isOnline && (
                  <p className="mt-1 text-[10px] text-zinc-400">Offline</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Quarterly Reports ── */}
      {reports.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-white">Informes trimestrales</h2>
          <div className="space-y-6">
            {reports.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-400 dark:border-zinc-800">
        Prototipalo &copy; {new Date().getFullYear()} — Información confidencial para inversores
      </footer>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">{value}</p>
    </div>
  );
}

function ReportCard({ report }: { report: Report }) {
  const [expanded, setExpanded] = useState(false);
  const [showExpenses, setShowExpenses] = useState(false);
  const clients = report.clients || [];
  const expensesBreakdown = report.expenses_breakdown || [];
  const recurring = clients.filter((c) => c.is_recurring).length;
  const totalExpenses = expensesBreakdown.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <span className="rounded-lg bg-green-100 px-3 py-1 text-sm font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Q{report.quarter} {report.year}
          </span>
          <div className="flex gap-6 text-sm">
            <span className="text-zinc-500">Facturación: <span className="font-bold text-zinc-900 dark:text-white">{fmt(Number(report.revenue))}</span></span>
            <span className="text-zinc-500">Beneficio: <span className={`font-bold ${Number(report.net_profit) >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(Number(report.net_profit))}</span></span>
          </div>
        </div>
      </div>

      {/* Video */}
      {report.video_url && (
        <div className="border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <div className="aspect-video overflow-hidden rounded-lg">
            <iframe
              src={report.video_url}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-4 border-b border-zinc-100 px-6 py-4 sm:grid-cols-5 dark:border-zinc-800">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Facturación</p>
          <p className="text-sm font-bold text-zinc-900 dark:text-white">{fmt(Number(report.revenue))}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Gastos</p>
          <p className="text-sm font-bold text-zinc-900 dark:text-white">{fmt(Number(report.expenses))}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Beneficio neto</p>
          <p className={`text-sm font-bold ${Number(report.net_profit) >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(Number(report.net_profit))}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Saldo en caja</p>
          <p className="text-sm font-bold text-zinc-900 dark:text-white">{fmt(Number(report.cash_balance))}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Clientes</p>
          <p className="text-sm font-bold text-zinc-900 dark:text-white">{clients.length} ({recurring} rec.)</p>
        </div>
      </div>

      {/* Text sections */}
      <div className="space-y-4 px-6 py-4">
        {report.summary && <TextBlock label="Resumen" text={report.summary} />}
        {report.highlights && <TextBlock label="Hitos destacados" text={report.highlights} />}
        {report.challenges && <TextBlock label="Retos" text={report.challenges} />}
        {report.next_quarter_goals && <TextBlock label="Objetivos próximo trimestre" text={report.next_quarter_goals} />}
      </div>

      {/* Expenses breakdown */}
      {expensesBreakdown.length > 0 && (
        <div className="border-t border-zinc-100 px-6 py-3 dark:border-zinc-800">
          <button
            onClick={() => setShowExpenses(!showExpenses)}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
          >
            <svg className={`h-3 w-3 transition-transform ${showExpenses ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Desglose de gastos ({fmt(totalExpenses)})
          </button>

          {showExpenses && (
            <div className="mt-3 space-y-3">
              {/* Category bar */}
              {totalExpenses > 0 && (
                <div className="flex h-5 overflow-hidden rounded-full">
                  {expensesBreakdown.map((exp) => {
                    const pct = (Number(exp.amount) / totalExpenses) * 100;
                    if (pct < 0.5) return null;
                    return (
                      <div
                        key={exp.id}
                        className={`${EXPENSE_COLORS[exp.category] || "bg-zinc-400"} flex items-center justify-center text-[9px] font-bold text-white`}
                        style={{ width: `${pct}%` }}
                        title={`${EXPENSE_LABELS[exp.category] || exp.category}: ${fmt(Number(exp.amount))}`}
                      >
                        {pct >= 12 ? EXPENSE_LABELS[exp.category] || exp.category : ""}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Table */}
              <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-[11px] uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                    <tr>
                      <th className="px-3 py-2 text-left">Categoría</th>
                      <th className="px-3 py-2 text-right">Importe</th>
                      <th className="px-3 py-2 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                    {expensesBreakdown.map((exp) => (
                      <tr key={exp.id}>
                        <td className="px-3 py-2 font-medium text-zinc-900 dark:text-white">
                          <span className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${EXPENSE_COLORS[exp.category] || "bg-zinc-400"}`} />
                            {EXPENSE_LABELS[exp.category] || exp.category}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-zinc-900 dark:text-white">{fmt(Number(exp.amount))}</td>
                        <td className="px-3 py-2 text-right text-zinc-500">
                          {totalExpenses > 0 ? ((Number(exp.amount) / totalExpenses) * 100).toFixed(1) : "0"}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-zinc-50 dark:bg-zinc-900">
                    <tr>
                      <td className="px-3 py-2 text-sm font-bold text-zinc-900 dark:text-white">Total</td>
                      <td className="px-3 py-2 text-right text-sm font-bold text-zinc-900 dark:text-white">{fmt(totalExpenses)}</td>
                      <td className="px-3 py-2 text-right text-xs text-zinc-500">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Clients toggle */}
      {clients.length > 0 && (
        <div className="border-t border-zinc-100 px-6 py-3 dark:border-zinc-800">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
          >
            <svg className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Clientes del trimestre ({clients.length})
          </button>

          {expanded && (
            <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-[11px] uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 text-left">Cliente</th>
                    <th className="px-3 py-2 text-center">Tipo</th>
                    <th className="px-3 py-2 text-right">Trimestre</th>
                    <th className="px-3 py-2 text-right">Lifetime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                  {clients.map((client) => (
                    <tr key={client.id}>
                      <td className="px-3 py-2 font-medium text-zinc-900 dark:text-white">{client.client_name}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                          client.is_recurring
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        }`}>
                          {client.is_recurring ? "Recurrente" : "Nuevo"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-zinc-900 dark:text-white">{fmt(Number(client.quarter_value))}</td>
                      <td className="px-3 py-2 text-right text-zinc-500">{fmt(Number(client.lifetime_value))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TextBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{text}</p>
    </div>
  );
}
