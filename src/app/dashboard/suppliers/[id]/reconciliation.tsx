"use client";

import { useState, useMemo } from "react";

interface Payment {
  id: string;
  payment_date: string;
  amount: number;
  description: string | null;
  has_invoice: boolean | null;
  invoice_number: string | null;
}

export default function Reconciliation({
  payments,
  supplierName,
  supplierEmail,
}: {
  payments: Payment[];
  supplierName: string;
  supplierEmail: string | null;
}) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
  const [copied, setCopied] = useState(false);

  // Generate month options from payment dates
  const months = useMemo(() => {
    const set = new Set<string>();
    // Always include current month
    set.add(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    );
    payments.forEach((p) => {
      const d = new Date(p.payment_date);
      set.add(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      );
    });
    return Array.from(set).sort().reverse();
  }, [payments]);

  const monthPayments = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    return payments.filter((p) => {
      const d = new Date(p.payment_date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
  }, [payments, selectedMonth]);

  const pendingPayments = monthPayments.filter((p) => !p.has_invoice);
  const totalPending = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

  const monthLabel = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const d = new Date(year, month - 1);
    return d.toLocaleString("es-ES", { month: "long", year: "numeric" });
  }, [selectedMonth]);

  function formatDate(dateStr: string) {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  }

  function formatAmount(amount: number) {
    return amount.toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function generateClaimText() {
    const lines = [
      `Hola ${supplierName},`,
      "",
      "Estoy ayudando en Prototipalo a recopilar las facturas de los últimos gastos para poder cerrar la conciliación contable.",
      "",
      "He visto estos cargos realizados con tarjeta y no tengo todavía la factura correspondiente:",
      "",
    ];

    pendingPayments.forEach((p) => {
      lines.push(
        `${formatDate(p.payment_date)} — ${formatAmount(p.amount)} €${p.description ? ` — ${p.description}` : ""}`
      );
    });

    lines.push("");
    lines.push(`Total: ${formatAmount(totalPending)} €`);
    lines.push("");
    lines.push("¿Podríais enviarnos las facturas, por favor?");
    lines.push("Como siempre, deberían ir a nombre de:");
    lines.push("");
    lines.push("Prototipalo SL");
    lines.push("Calle Viriato 27");
    lines.push("28010 Madrid");
    lines.push("B72410665");
    lines.push("");
    lines.push("Muchas gracias por la ayuda 😊");
    lines.push("");
    lines.push("Un saludo,");
    lines.push("Manu");

    return lines.join("\n");
  }

  async function handleCopyReclamation() {
    const text = generateClaimText();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
        Conciliacion mensual
      </h2>

      {/* Month selector */}
      <div className="mb-4">
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
        >
          {months.map((m) => {
            const [y, mo] = m.split("-").map(Number);
            const d = new Date(y, mo - 1);
            return (
              <option key={m} value={m}>
                {d.toLocaleString("es-ES", {
                  month: "long",
                  year: "numeric",
                })}
              </option>
            );
          })}
        </select>
      </div>

      {monthPayments.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No hay pagos en este mes.
        </p>
      ) : (
        <>
          {/* Month payments summary */}
          <div className="mb-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                <tr>
                  <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                    Fecha
                  </th>
                  <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                    Importe
                  </th>
                  <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                    Concepto
                  </th>
                  <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                    Factura
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {monthPayments.map((p) => (
                  <tr
                    key={p.id}
                    className={
                      !p.has_invoice
                        ? "bg-amber-50 dark:bg-amber-900/10"
                        : ""
                    }
                  >
                    <td className="px-3 py-2 text-zinc-900 dark:text-white">
                      {p.payment_date}
                    </td>
                    <td className="px-3 py-2 font-medium text-zinc-900 dark:text-white">
                      {p.amount.toFixed(2)}&euro;
                    </td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                      {p.description || "—"}
                    </td>
                    <td className="px-3 py-2">
                      {p.has_invoice ? (
                        <span className="text-green-600 dark:text-green-400">
                          {p.invoice_number || "Si"}
                        </span>
                      ) : (
                        <span className="font-medium text-amber-600 dark:text-amber-400">
                          Pendiente
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Claim button */}
          {pendingPayments.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCopyReclamation}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
              >
                {copied ? "Copiado!" : "Generar reclamacion"}
              </button>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {pendingPayments.length} pago(s) sin factura —{" "}
                {totalPending.toFixed(2)}&euro;
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
