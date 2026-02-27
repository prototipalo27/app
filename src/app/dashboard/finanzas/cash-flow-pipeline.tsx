"use client";

import Link from "next/link";
import type { CashFlowStage } from "./actions";

function formatEur(n: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

const colorConfig = {
  zinc: {
    border: "border-l-zinc-400 dark:border-l-zinc-500",
    header: "text-zinc-600 dark:text-zinc-400",
    bg: "",
  },
  amber: {
    border: "border-l-amber-400 dark:border-l-amber-500",
    header: "text-amber-600 dark:text-amber-400",
    bg: "",
  },
  green: {
    border: "border-l-green-500 dark:border-l-green-400",
    header: "text-green-600 dark:text-green-400",
    bg: "",
  },
  red: {
    border: "border-l-red-500",
    header: "text-red-500",
    bg: "bg-red-50/50 dark:bg-red-900/10",
  },
};

export default function CashFlowPipeline({ stages }: { stages: CashFlowStage[] }) {
  const totalProjects = stages.reduce((s, st) => s + st.projects.length, 0);

  if (totalProjects === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">Flujo de cobros</h2>
        <p className="text-sm text-zinc-400">No hay proyectos en el pipeline de cobros</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">Flujo de cobros</h2>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        {stages.map((stage) => {
          const cfg = colorConfig[stage.color];
          return (
            <div key={stage.key} className={`rounded-lg border border-zinc-200 dark:border-zinc-800 ${cfg.bg}`}>
              {/* Header */}
              <div className="border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
                <p className={`text-xs font-semibold ${cfg.header}`}>{stage.label}</p>
                <p className="mt-0.5 text-lg font-bold text-zinc-900 dark:text-white">{formatEur(stage.total)}</p>
                <p className="text-[11px] text-zinc-400">
                  {stage.projects.length} {stage.projects.length === 1 ? "proyecto" : "proyectos"}
                </p>
              </div>

              {/* Cards */}
              <div className="space-y-2 p-2">
                {stage.projects.length === 0 ? (
                  <p className="px-1 py-3 text-center text-xs text-zinc-300 dark:text-zinc-600">—</p>
                ) : (
                  stage.projects.map((proj) => (
                    <Link
                      key={proj.id}
                      href={`/dashboard/projects/${proj.id}`}
                      className={`block rounded-md border-l-3 bg-white p-2.5 shadow-xs transition-colors hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/80 ${cfg.border}`}
                    >
                      <p className="text-xs font-medium text-zinc-900 dark:text-white truncate">{proj.name}</p>
                      {proj.client_name && (
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{proj.client_name}</p>
                      )}
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          {formatEur(proj.price)}
                        </span>
                        {proj.holded_doc_number && (
                          <span className="text-[10px] text-zinc-400">{proj.holded_doc_number}</span>
                        )}
                      </div>
                      {proj.days_overdue !== null && proj.days_overdue > 0 && (
                        <p className="mt-1 text-[11px] font-medium text-red-500">
                          Vencida hace {proj.days_overdue} dias
                        </p>
                      )}
                      {proj.holded_due_date && proj.days_overdue === null && (
                        <p className="mt-1 text-[10px] text-zinc-400">
                          Vence {new Date(proj.holded_due_date * 1000).toLocaleDateString("es-ES")}
                        </p>
                      )}
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
