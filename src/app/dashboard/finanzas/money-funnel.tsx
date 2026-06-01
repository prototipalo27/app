"use client";

import { useState } from "react";
import type { MoneyFunnel, FunnelProject } from "./actions";

function formatEur(n: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

const STATE_STYLES = {
  blue: "text-blue-600 dark:text-blue-400",
  green: "text-green-600 dark:text-green-400",
  amber: "text-amber-600 dark:text-amber-400",
  zinc: "text-zinc-900 dark:text-white",
} as const;

function FunnelCol({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number;
  sub: string;
  color: keyof typeof STATE_STYLES;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${STATE_STYLES[color]}`}>{formatEur(value)}</p>
      <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{sub}</p>
    </div>
  );
}

const GAP_ACCENTS = {
  amber: {
    border: "border-amber-200 dark:border-amber-800/60",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-400",
  },
  blue: {
    border: "border-blue-200 dark:border-blue-800/60",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-700 dark:text-blue-400",
  },
  red: {
    border: "border-red-200 dark:border-red-800/60",
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-400",
  },
  green: {
    border: "border-green-200 dark:border-green-800/60",
    bg: "bg-green-50 dark:bg-green-900/20",
    text: "text-green-700 dark:text-green-400",
  },
} as const;

function GapCard({
  label,
  hint,
  total,
  projects,
  accent,
}: {
  label: string;
  hint: string;
  total: number;
  projects: FunnelProject[];
  accent: keyof typeof GAP_ACCENTS;
}) {
  const [open, setOpen] = useState(false);
  const c = GAP_ACCENTS[accent];
  const disabled = projects.length === 0;

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} overflow-hidden`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className="flex w-full items-start justify-between gap-2 p-4 text-left disabled:cursor-default"
      >
        <div>
          <p className={`text-sm font-semibold ${c.text}`}>{label}</p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
        </div>
        <div className="text-right">
          <p className={`text-xl font-bold ${c.text}`}>{formatEur(total)}</p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            {projects.length} {projects.length === 1 ? "proyecto" : "proyectos"}
            {!disabled && <span className="ml-1">{open ? "▲" : "▼"}</span>}
          </p>
        </div>
      </button>

      {open && !disabled && (
        <div className="border-t border-zinc-200/60 bg-white/60 dark:border-zinc-800/60 dark:bg-zinc-900/40">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {projects.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 text-zinc-900 dark:text-white">
                    {p.client_name || p.name}
                    {p.client_name && (
                      <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">{p.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-zinc-400 dark:text-zinc-500">
                    {p.doc_number || "—"}
                  </td>
                  <td className={`px-4 py-2 text-right font-medium ${c.text}`}>
                    {formatEur(p.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function MoneyFunnel({ data }: { data: MoneyFunnel }) {
  const { facturado, cobrado, producido, entregado, buckets, projectCount, holdedOk } = data;
  const forgotten = buckets.cobradoSinCalendarizar;

  return (
    <section className="space-y-4">
      {/* ── Alerta crítica: cobrado pero sin calendarizar (riesgo de olvido) ── */}
      {forgotten.projects.length > 0 && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-900/20">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-red-700 dark:text-red-400">
                ⚠️ {forgotten.projects.length} proyecto{forgotten.projects.length === 1 ? "" : "s"} cobrado
                {forgotten.projects.length === 1 ? "" : "s"} SIN calendarizar
              </p>
              <p className="mt-0.5 text-xs text-red-600 dark:text-red-300">
                Pagados pero sin fecha de entrega ni kickoff — riesgo de que se queden olvidados
              </p>
            </div>
            <p className="text-xl font-bold text-red-700 dark:text-red-400">{formatEur(forgotten.total)}</p>
          </div>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-red-200/60 dark:divide-red-800/40">
              {forgotten.projects.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 text-zinc-900 dark:text-white">
                    {p.client_name || p.name}
                    {p.client_name && (
                      <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">{p.name}</span>
                    )}
                  </td>
                  <td className="py-2 text-right text-xs text-zinc-400 dark:text-zinc-500">
                    {p.doc_number || "—"}
                  </td>
                  <td className="py-2 text-right font-medium text-red-700 dark:text-red-400">
                    {formatEur(p.amount)}
                  </td>
                  <td className="py-2 pl-3 text-right">
                    <a
                      href={`/dashboard/projects/${p.id}`}
                      className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                    >
                      Calendarizar
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Dinero en el aire</h2>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            {projectCount} proyectos abiertos (no entregados o no cobrados al 100%)
          </p>
        </div>
        {!holdedOk && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Holded no disponible — cobrado puede estar incompleto
          </span>
        )}
      </div>

      {/* Embudo: los 4 estados */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <FunnelCol label="Facturado" value={facturado} sub="Facturas emitidas" color="zinc" />
        <FunnelCol label="Cobrado" value={cobrado} sub="Pagos recibidos (Holded)" color="green" />
        <FunnelCol label="Producido" value={producido} sub="En envío o entregado" color="blue" />
        <FunnelCol label="Entregado" value={entregado} sub="Pieza en manos del cliente" color="amber" />
      </div>

      {/* Saldos en el aire (gaps) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GapCard
          label="Pendiente de cobro"
          hint="Facturado pero aún no cobrado — dinero que viene"
          total={buckets.pendienteCobro.total}
          projects={buckets.pendienteCobro.projects}
          accent="amber"
        />
        <GapCard
          label="Entregado sin cobrar"
          hint="Ya entregado y todavía no pagado — riesgo de impago"
          total={buckets.entregadoSinCobrar.total}
          projects={buckets.entregadoSinCobrar.projects}
          accent="red"
        />
        <GapCard
          label="Producido sin entregar"
          hint="Listo o en tránsito, aún no entregado"
          total={buckets.produciendoSinEntregar.total}
          projects={buckets.produciendoSinEntregar.projects}
          accent="blue"
        />
        <GapCard
          label="Cobrado por adelantado"
          hint="Cobrado pero aún sin entregar — trabajo que debes"
          total={buckets.cobradoSinEntregar.total}
          projects={buckets.cobradoSinEntregar.projects}
          accent="green"
        />
      </div>
    </section>
  );
}
