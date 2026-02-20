"use client";

import { useState, useTransition } from "react";
import { acceptProforma } from "./actions";

interface ProformaLine {
  name: string;
  units: number;
  price: number;
  tax: number;
}

interface ProformaFormProps {
  token: string;
  lines: ProformaLine[];
  subtotal: number;
  totalTax: number;
  total: number;
}

export default function ProformaForm({
  token,
  lines,
  subtotal,
  totalTax,
  total,
}: ProformaFormProps) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await acceptProforma(
        token,
        {
          billing_name: fd.get("billing_name") as string,
          tax_id: fd.get("tax_id") as string,
          billing_address: fd.get("billing_address") as string,
          billing_postal_code: fd.get("billing_postal_code") as string,
          billing_city: fd.get("billing_city") as string,
          billing_province: fd.get("billing_province") as string,
          billing_country: (fd.get("billing_country") as string) || "España",
        },
        {
          recipient_name: fd.get("shipping_recipient_name") as string,
          recipient_phone: fd.get("shipping_recipient_phone") as string,
          address: fd.get("shipping_address") as string,
          city: fd.get("shipping_city") as string,
          postal_code: fd.get("shipping_postal_code") as string,
          province: fd.get("shipping_province") as string,
          country: (fd.get("shipping_country") as string) || "España",
        },
      );

      if (result.success) {
        setDone(true);
      } else {
        setError(result.error || "Error al aceptar el presupuesto");
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
          Presupuesto aceptado
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Gracias por confirmar. Nos pondremos en marcha con tu proyecto. Te mantendremos informado del progreso por email.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-white";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section 1: Proforma summary */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
          Resumen del presupuesto
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="pb-2 text-left font-medium text-zinc-500 dark:text-zinc-400">Concepto</th>
                <th className="pb-2 text-right font-medium text-zinc-500 dark:text-zinc-400">Uds</th>
                <th className="pb-2 text-right font-medium text-zinc-500 dark:text-zinc-400">Precio</th>
                <th className="pb-2 text-right font-medium text-zinc-500 dark:text-zinc-400">IVA</th>
                <th className="pb-2 text-right font-medium text-zinc-500 dark:text-zinc-400">Importe</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-2 text-zinc-900 dark:text-white">{line.name}</td>
                  <td className="py-2 text-right text-zinc-600 dark:text-zinc-300">{line.units}</td>
                  <td className="py-2 text-right text-zinc-600 dark:text-zinc-300">{line.price.toFixed(2)} €</td>
                  <td className="py-2 text-right text-zinc-600 dark:text-zinc-300">{line.tax}%</td>
                  <td className="py-2 text-right font-medium text-zinc-900 dark:text-white">
                    {(line.price * line.units).toFixed(2)} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 space-y-1 border-t border-zinc-200 pt-3 dark:border-zinc-700">
          <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-300">
            <span>Subtotal</span>
            <span>{subtotal.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-300">
            <span>IVA</span>
            <span>{totalTax.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between text-sm font-semibold text-zinc-900 dark:text-white">
            <span>Total</span>
            <span>{total.toFixed(2)} €</span>
          </div>
        </div>
      </div>

      {/* Section 2: Billing data */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
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
              Dirección fiscal *
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
      </div>

      {/* Section 3: Shipping address */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
          Dirección de envío
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Nombre del destinatario *
              </label>
              <input name="shipping_recipient_name" type="text" required className={inputClass} placeholder="Juan García" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Teléfono *
              </label>
              <input name="shipping_recipient_phone" type="tel" required className={inputClass} placeholder="+34 600 000 000" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Dirección (calle y número) *
            </label>
            <input name="shipping_address" type="text" required className={inputClass} placeholder="Calle Mayor, 1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Código postal *
              </label>
              <input name="shipping_postal_code" type="text" required className={inputClass} placeholder="28001" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Ciudad *
              </label>
              <input name="shipping_city" type="text" required className={inputClass} placeholder="Madrid" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Provincia *
              </label>
              <input name="shipping_province" type="text" required className={inputClass} placeholder="Madrid" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                País
              </label>
              <input name="shipping_country" type="text" defaultValue="España" className={inputClass} />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {isPending ? "Procesando..." : "Aceptar presupuesto"}
      </button>
    </form>
  );
}
