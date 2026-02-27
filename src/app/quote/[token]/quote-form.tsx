"use client";

import { useState, useTransition } from "react";
import { submitBillingData } from "./actions";

interface QuoteItem {
  concept: string;
  price: number;
  units: number;
  tax: number;
}

export default function QuoteForm({
  token,
  items,
  notes,
}: {
  token: string;
  items: QuoteItem[];
  notes: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await submitBillingData(token, {
        billing_name: fd.get("billing_name") as string,
        tax_id: fd.get("tax_id") as string,
        billing_address: fd.get("billing_address") as string,
        billing_postal_code: fd.get("billing_postal_code") as string,
        billing_city: fd.get("billing_city") as string,
        billing_province: fd.get("billing_province") as string,
        billing_country: (fd.get("billing_country") as string) || "España",
      });

      if (result.success) {
        setDone(true);
      } else {
        setError(result.error || "Error al enviar los datos");
      }
    });
  };

  if (done) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-light dark:bg-brand/20">
          <svg className="h-6 w-6 text-brand dark:text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
          Datos enviados correctamente
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Gracias. Nos pondremos en contacto contigo pronto.
        </p>
      </div>
    );
  }

  // Quote items calculations
  const subtotal = items.reduce((sum, i) => sum + i.price * i.units, 0);
  const taxBreakdown = items.reduce<Record<number, number>>((acc, i) => {
    const taxAmount = i.price * i.units * (i.tax / 100);
    acc[i.tax] = (acc[i.tax] || 0) + taxAmount;
    return acc;
  }, {});
  const totalTax = Object.values(taxBreakdown).reduce((s, v) => s + v, 0);
  const total = subtotal + totalTax;

  const inputClass =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-white";

  return (
    <div className="space-y-4">
      {/* Quote items table */}
      {items.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">
            Detalle del presupuesto
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="pb-2 pr-4 font-medium text-zinc-500 dark:text-zinc-400">Concepto</th>
                  <th className="pb-2 pr-4 text-right font-medium text-zinc-500 dark:text-zinc-400">Uds</th>
                  <th className="pb-2 pr-4 text-right font-medium text-zinc-500 dark:text-zinc-400">Precio</th>
                  <th className="pb-2 text-right font-medium text-zinc-500 dark:text-zinc-400">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-2.5 pr-4 text-zinc-900 dark:text-white">{item.concept}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{item.units}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{item.price.toFixed(2)} €</td>
                    <td className="py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{(item.price * item.units).toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-4 space-y-1 border-t border-zinc-200 pt-3 dark:border-zinc-700">
            <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
              <span>Subtotal</span>
              <span className="tabular-nums">{subtotal.toFixed(2)} €</span>
            </div>
            {Object.entries(taxBreakdown)
              .filter(([, amount]) => amount > 0)
              .map(([rate, amount]) => (
                <div key={rate} className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
                  <span>IVA {rate}%</span>
                  <span className="tabular-nums">{amount.toFixed(2)} €</span>
                </div>
              ))}
            <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold text-zinc-900 dark:border-zinc-700 dark:text-white">
              <span>Total</span>
              <span className="tabular-nums">{total.toFixed(2)} €</span>
            </div>
          </div>

          {notes && (
            <div className="mt-4 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Notas</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Billing data form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">
          Datos de facturación
        </h2>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Razón social / Nombre fiscal *
            </label>
            <input name="billing_name" type="text" required className={inputClass} placeholder="Empresa S.L." />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              NIF / CIF *
            </label>
            <input name="tax_id" type="text" required className={inputClass} placeholder="B12345678" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Dirección (calle y número) *
            </label>
            <input name="billing_address" type="text" required className={inputClass} placeholder="Calle Mayor, 1" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Código postal *
              </label>
              <input name="billing_postal_code" type="text" required className={inputClass} placeholder="28001" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Ciudad *
              </label>
              <input name="billing_city" type="text" required className={inputClass} placeholder="Madrid" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Provincia *
              </label>
              <input name="billing_province" type="text" required className={inputClass} placeholder="Madrid" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                País
              </label>
              <input name="billing_country" type="text" defaultValue="España" className={inputClass} />
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="mt-6 w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {isPending ? "Enviando..." : "Confirmar y enviar datos"}
        </button>
      </form>
    </div>
  );
}
