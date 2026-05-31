"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { setPayoutReconciled, type PayoutRow } from "./actions";

function formatEur(n: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDay(unixSec: number) {
  return new Date(unixSec * 1000).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const STATUS_LABEL: Record<string, { label: string; classes: string }> = {
  paid: { label: "En BBVA", classes: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  in_transit: { label: "En camino", classes: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  pending: { label: "Pendiente", classes: "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300" },
  failed: { label: "Fallido", classes: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  canceled: { label: "Cancelado", classes: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

interface Props {
  payouts: PayoutRow[];
}

export default function PayoutsList({ payouts }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showReconciled, setShowReconciled] = useState(false);
  // Override local: { [payoutId]: true|false } se aplica encima del prop
  // para evitar tener que re-tirar de Stripe + Holded en cada click.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  // Si el server nos manda datos frescos donde el estado ya coincide con
  // nuestro override, podemos limpiarlo. Si difiere, el server gana.
  useEffect(() => {
    setOverrides((prev) => {
      const next: Record<string, boolean> = {};
      for (const [id, value] of Object.entries(prev)) {
        const serverRow = payouts.find((p) => p.id === id);
        if (serverRow && serverRow.reconciled !== value) {
          next[id] = value;
        }
      }
      return next;
    });
  }, [payouts]);

  const effective = useMemo(() => {
    return payouts.map((p) => ({
      ...p,
      reconciled: overrides[p.id] ?? p.reconciled,
    }));
  }, [payouts, overrides]);

  const { pending, reconciled } = useMemo(() => {
    const pending: PayoutRow[] = [];
    const reconciled: PayoutRow[] = [];
    for (const p of effective) {
      if (p.reconciled) reconciled.push(p);
      else pending.push(p);
    }
    return { pending, reconciled };
  }, [effective]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleReconciled = (id: string, currently: boolean) => {
    const target = !currently;
    // Optimistic: pintamos el cambio ya y persistimos en segundo plano.
    setOverrides((prev) => ({ ...prev, [id]: target }));
    setSavingIds((prev) => new Set(prev).add(id));
    setPayoutReconciled(id, target).then((res) => {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (!res.success) {
        // Rollback en error.
        setOverrides((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });
  };

  if (payouts.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No hay payouts de Stripe en los últimos 60 días.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Section
        title="Pendientes de conciliar"
        payouts={pending}
        emptyText="Todo conciliado. ✓"
        expanded={expanded}
        toggleExpand={toggleExpand}
        toggleReconciled={toggleReconciled}
        savingIds={savingIds}
      />

      <div>
        <button
          type="button"
          onClick={() => setShowReconciled((v) => !v)}
          className="mb-2 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          {showReconciled ? "▾" : "▸"} Conciliados ({reconciled.length})
        </button>
        {showReconciled && (
          <Section
            title=""
            payouts={reconciled}
            emptyText="Aún no has marcado ninguno."
            expanded={expanded}
            toggleExpand={toggleExpand}
            toggleReconciled={toggleReconciled}
            isPending={isPending}
            pendingId={pendingId}
            dimmed
          />
        )}
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  payouts: PayoutRow[];
  emptyText: string;
  expanded: Set<string>;
  toggleExpand: (id: string) => void;
  toggleReconciled: (id: string, currently: boolean) => void;
  savingIds: Set<string>;
  dimmed?: boolean;
}

function Section({ title, payouts, emptyText, expanded, toggleExpand, toggleReconciled, savingIds, dimmed }: SectionProps) {
  return (
    <div>
      {title && (
        <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          {title}
        </h2>
      )}
      {payouts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-200 px-4 py-6 text-center text-xs text-zinc-400 dark:border-zinc-700">
          {emptyText}
        </p>
      ) : (
        <div className={`space-y-2 ${dimmed ? "opacity-70" : ""}`}>
          {payouts.map((p) => {
            const status = STATUS_LABEL[p.status] ?? STATUS_LABEL.pending;
            const isOpen = expanded.has(p.id);
            return (
              <div
                key={p.id}
                className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => toggleExpand(p.id)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-400">{isOpen ? "▾" : "▸"}</span>
                      <div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                          {formatDay(p.arrivalDate)}
                          <span className={`ml-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${status.classes}`}>
                            {status.label}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-zinc-400">
                          {p.charges.length} cobro{p.charges.length === 1 ? "" : "s"}
                          {p.totalFees > 0 && ` · comisión ${formatEur(p.totalFees)}`}
                        </p>
                      </div>
                    </div>
                  </button>
                  <div className="text-right">
                    <p className="text-lg font-bold tabular-nums text-green-600 dark:text-green-400">
                      {formatEur(p.amount)}
                    </p>
                    {p.totalGross !== p.amount && (
                      <p className="text-[10px] text-zinc-400 tabular-nums">
                        bruto {formatEur(p.totalGross)}
                      </p>
                    )}
                  </div>
                  <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                    <input
                      type="checkbox"
                      checked={p.reconciled}
                      onChange={() => toggleReconciled(p.id, p.reconciled)}
                      disabled={savingIds.has(p.id)}
                      className="h-3.5 w-3.5"
                    />
                    {p.reconciled ? "Conciliado" : "Conciliar"}
                  </label>
                </div>

                {isOpen && (
                  <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
                    {p.charges.length === 0 ? (
                      <p className="text-xs text-zinc-400">
                        Este payout no contiene charges (puede ser un ajuste o reembolso).
                      </p>
                    ) : (
                      <table className="w-full text-left text-xs">
                        <thead className="text-[10px] uppercase text-zinc-400">
                          <tr>
                            <th className="pb-2 font-medium">Cliente</th>
                            <th className="pb-2 font-medium">Factura</th>
                            <th className="pb-2 text-right font-medium">Bruto</th>
                            <th className="pb-2 text-right font-medium">Comisión</th>
                            <th className="pb-2 text-right font-medium">Neto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.charges.map((c) => (
                            <tr key={c.chargeId} className="border-t border-zinc-50 dark:border-zinc-800">
                              <td className="py-2 pr-2">
                                {c.leadId ? (
                                  <Link
                                    href={`/dashboard/crm/${c.leadId}`}
                                    className="font-medium text-brand hover:underline"
                                  >
                                    {c.customerName || c.customerEmail || "—"}
                                  </Link>
                                ) : (
                                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                                    {c.customerName || c.customerEmail || "—"}
                                  </span>
                                )}
                                {c.customerEmail && c.customerName && (
                                  <p className="text-[10px] text-zinc-400">{c.customerEmail}</p>
                                )}
                              </td>
                              <td className="py-2 pr-2">
                                {c.invoiceDocNumber ? (
                                  <span className="font-mono text-zinc-700 dark:text-zinc-300">
                                    {c.invoiceDocNumber}
                                  </span>
                                ) : c.holdedInvoiceId ? (
                                  <span className="text-amber-600 dark:text-amber-400">borrador</span>
                                ) : (
                                  <span className="text-red-500">sin factura</span>
                                )}
                              </td>
                              <td className="py-2 pr-2 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                                {formatEur(c.amount)}
                              </td>
                              <td className="py-2 pr-2 text-right tabular-nums text-red-500">
                                -{formatEur(c.fee)}
                              </td>
                              <td className="py-2 text-right tabular-nums font-semibold text-zinc-900 dark:text-white">
                                {formatEur(c.net)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
