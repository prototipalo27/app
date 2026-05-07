"use client";

import { useState, useTransition } from "react";
import { payStudioProforma } from "./actions";

function formatEur(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export default function StudioProformaPay({
  token,
  label,
  subtotal,
  taxAmount,
  taxRate,
  total,
  docNumber,
}: {
  token: string;
  label: string;
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  total: number;
  docNumber: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handlePay = () => {
    setError(null);
    startTransition(async () => {
      const result = await payStudioProforma(token);
      if (result.success && result.redirectUrl) {
        window.location.href = result.redirectUrl;
      } else {
        setError(result.error || "No pudimos preparar el pago. Inténtalo de nuevo.");
      }
    });
  };

  const conceptoLine = docNumber ? `${docNumber} – Prototipalo` : "Prototipalo – Studio";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{label}</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">1 ud × {formatEur(subtotal)}</p>
          </div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{formatEur(subtotal)}</p>
        </div>

        <div className="mt-4 space-y-1 border-t border-zinc-100 pt-4 text-sm dark:border-zinc-800">
          <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
            <span>Subtotal</span>
            <span>{formatEur(subtotal)}</span>
          </div>
          {taxAmount > 0 && (
            <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
              <span>IVA ({taxRate}%)</span>
              <span>{formatEur(taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 text-base font-semibold text-zinc-900 dark:text-white">
            <span>Total</span>
            <span>{formatEur(total)}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handlePay}
        disabled={isPending}
        className="block w-full rounded-xl bg-[#e9473f] px-6 py-3 text-center text-base font-semibold text-white transition hover:bg-[#d63d36] disabled:opacity-50"
      >
        {isPending ? "Preparando pago…" : "Pagar con tarjeta"}
      </button>

      {error && (
        <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">
          También puedes pagar por transferencia bancaria
        </p>
        <table className="mt-3 w-full text-sm">
          <tbody className="text-zinc-500 dark:text-zinc-400">
            <tr><td className="py-0.5 pr-4 whitespace-nowrap">Banco</td><td className="font-medium text-zinc-900 dark:text-white">BBVA</td></tr>
            <tr><td className="py-0.5 pr-4 whitespace-nowrap">Titular</td><td className="font-medium text-zinc-900 dark:text-white">Prototipalo</td></tr>
            <tr><td className="py-0.5 pr-4 whitespace-nowrap">IBAN</td><td className="font-medium text-zinc-900 dark:text-white">ES24 0182 4010 3502 0181 5556</td></tr>
            <tr><td className="py-0.5 pr-4 whitespace-nowrap">SWIFT/BIC</td><td className="font-medium text-zinc-900 dark:text-white">BBVAESMM</td></tr>
            <tr><td className="py-0.5 pr-4 whitespace-nowrap">Concepto</td><td className="font-medium text-zinc-900 dark:text-white">{conceptoLine}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
