"use client";

import { useState } from "react";

interface BillingProject {
  name: string;
  client_name: string | null;
  price: number;
}

interface MonthData {
  label: string;
  total: number;
  projects: BillingProject[];
}

interface BillingBreakdownProps {
  currentMonth: MonthData;
  previousMonth: MonthData;
  delta: number;
}

function formatEur(n: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function BreakdownModal({ month, onClose }: { month: MonthData; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="mx-4 max-h-[80vh] w-full max-w-md overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Facturacion {month.label}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-3">
          {month.projects.length === 0 ? (
            <p className="py-4 text-center text-sm text-zinc-400">Sin facturas con fecha en {month.label}</p>
          ) : (
            <div className="space-y-2">
              {month.projects
                .sort((a, b) => b.price - a.price)
                .map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">{p.client_name || p.name}</p>
                      {p.client_name && p.name !== p.client_name && (
                        <p className="truncate text-xs text-zinc-400">{p.name}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-900 dark:text-white">
                      {formatEur(p.price)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="border-t border-zinc-200 px-5 py-3 dark:border-zinc-700">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total</span>
            <span className="text-lg font-bold text-zinc-900 dark:text-white">{formatEur(month.total)}</span>
          </div>
          <p className="text-xs text-zinc-400">{month.projects.length} facturas</p>
        </div>
      </div>
    </div>
  );
}

export function BillingBreakdown({ currentMonth, previousMonth, delta }: BillingBreakdownProps) {
  const [showModal, setShowModal] = useState<"current" | "previous" | null>(null);
  const isUp = delta > 0;

  return (
    <>
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Facturacion</h2>

        {/* Current month */}
        <button
          type="button"
          onClick={() => setShowModal("current")}
          className="w-full text-left"
        >
          <p className="text-2xl font-bold text-zinc-900 hover:text-brand dark:text-white dark:hover:text-brand">
            {formatEur(currentMonth.total)}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">{currentMonth.label} · {currentMonth.projects.length} facturas</span>
            {delta !== 0 && (
              <span className={`flex items-center gap-0.5 text-xs font-medium ${isUp ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={isUp ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                </svg>
                {Math.abs(delta).toFixed(0)}%
              </span>
            )}
          </div>
        </button>

        {/* Previous month */}
        <button
          type="button"
          onClick={() => setShowModal("previous")}
          className="mt-3 w-full border-t border-zinc-100 pt-3 text-left dark:border-zinc-800"
        >
          <p className="text-sm font-medium text-zinc-500 hover:text-brand dark:text-zinc-400 dark:hover:text-brand">
            {formatEur(previousMonth.total)}
          </p>
          <span className="text-xs text-zinc-400">{previousMonth.label} · {previousMonth.projects.length} facturas</span>
        </button>
      </div>

      {showModal === "current" && (
        <BreakdownModal month={currentMonth} onClose={() => setShowModal(null)} />
      )}
      {showModal === "previous" && (
        <BreakdownModal month={previousMonth} onClose={() => setShowModal(null)} />
      )}
    </>
  );
}
