"use client";

import { useEffect, useState } from "react";
import type { PendingInvoice } from "@/lib/holded/api";

function formatEur(n: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatEurExact(n: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(ts: number) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("es-ES");
}

interface Props {
  total: number;
  invoices: PendingInvoice[];
}

export default function ReceivablesCard({ total, invoices }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const overdueCount = invoices.filter((i) => i.isOverdue).length;
  const draftCount = invoices.filter((i) => i.isDraft).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 rounded"
      >
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Nos deben</p>
        <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
          {formatEur(total)}
        </p>
        <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
          {invoices.length} factura{invoices.length !== 1 ? "s" : ""}
          {overdueCount > 0 && ` · ${overdueCount} vencida${overdueCount !== 1 ? "s" : ""}`}
        </p>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                  Cobros pendientes (Holded)
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {invoices.length} factura{invoices.length !== 1 ? "s" : ""} ·{" "}
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {formatEurExact(total)}
                  </span>
                  {draftCount > 0 && ` · ${draftCount} en efectivo`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                aria-label="Cerrar"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="max-h-[calc(85vh-72px)] overflow-y-auto">
              {invoices.length === 0 ? (
                <p className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  No hay facturas pendientes
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900/95">
                    <tr className="border-b border-zinc-200 dark:border-zinc-800">
                      <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500">Cliente</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500">Nº</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500">Pendiente</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500">Total</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500">Vencimiento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="px-4 py-2 text-zinc-900 dark:text-white">{inv.contactName}</td>
                        <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">
                          {inv.docNumber || (
                            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                              Borrador
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-amber-700 dark:text-amber-400">
                          {formatEurExact(inv.pending)}
                        </td>
                        <td className="px-4 py-2 text-right text-zinc-500 dark:text-zinc-400">
                          {formatEurExact(inv.total)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className={inv.isOverdue ? "font-medium text-red-500" : "text-zinc-500 dark:text-zinc-400"}>
                            {formatDate(inv.dueDate)}
                          </span>
                          {inv.isOverdue && (
                            <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              Vencida
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50">
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-right text-xs font-medium text-zinc-500">
                        Total pendiente
                      </td>
                      <td className="px-4 py-3 text-right text-base font-bold text-amber-700 dark:text-amber-400">
                        {formatEurExact(total)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
