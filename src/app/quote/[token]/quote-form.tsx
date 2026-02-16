"use client";

import { useState, useTransition } from "react";
import { submitBillingData } from "./actions";

export default function QuoteForm({ token }: { token: string }) {
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
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
          Datos enviados correctamente
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Gracias. Nos pondremos en contacto contigo con el presupuesto.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-white";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
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
        className="mt-6 w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        {isPending ? "Enviando..." : "Enviar datos de facturación"}
      </button>
    </form>
  );
}
