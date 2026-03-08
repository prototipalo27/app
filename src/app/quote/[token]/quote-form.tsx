"use client";

import { useState, useTransition, useRef } from "react";
import { submitBillingData } from "./actions";
import AddressAutocomplete, { type AddressComponents } from "@/components/address-autocomplete";

interface QuoteItem {
  concept: string;
  price: number;
  units: number;
  tax: number;
}

export default function QuoteForm({
  token,
  items: initialItems,
  notes,
}: {
  token: string;
  items: QuoteItem[];
  notes: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsShipping, setNeedsShipping] = useState(false);
  const [items, setItems] = useState<QuoteItem[]>(initialItems);
  const [paymentOption, setPaymentOption] = useState<"full" | "split">("full");
  const billingPostalRef = useRef<HTMLInputElement>(null);
  const billingCityRef = useRef<HTMLInputElement>(null);
  const billingProvinceRef = useRef<HTMLInputElement>(null);
  const billingCountryRef = useRef<HTMLInputElement>(null);
  const shippingPostalRef = useRef<HTMLInputElement>(null);
  const shippingCityRef = useRef<HTMLInputElement>(null);
  const shippingProvinceRef = useRef<HTMLInputElement>(null);
  const shippingCountryRef = useRef<HTMLInputElement>(null);

  const fillBillingAddress = (c: AddressComponents) => {
    if (billingPostalRef.current) billingPostalRef.current.value = c.postalCode;
    if (billingCityRef.current) billingCityRef.current.value = c.city;
    if (billingProvinceRef.current) billingProvinceRef.current.value = c.province;
    if (billingCountryRef.current) billingCountryRef.current.value = c.country;
  };

  const fillShippingAddress = (c: AddressComponents) => {
    if (shippingPostalRef.current) shippingPostalRef.current.value = c.postalCode;
    if (shippingCityRef.current) shippingCityRef.current.value = c.city;
    if (shippingProvinceRef.current) shippingProvinceRef.current.value = c.province;
    if (shippingCountryRef.current) shippingCountryRef.current.value = c.country;
  };

  const updateUnits = (index: number, value: string) => {
    const parsed = parseInt(value);
    const units = isNaN(parsed) || parsed < 1 ? 1 : parsed;
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, units } : item)));
  };

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
        needs_shipping: needsShipping,
        shipping_recipient_name: needsShipping ? (fd.get("shipping_recipient_name") as string) || null : null,
        shipping_recipient_phone: needsShipping ? (fd.get("shipping_recipient_phone") as string) || null : null,
        shipping_address: needsShipping ? (fd.get("shipping_address") as string) || null : null,
        shipping_postal_code: needsShipping ? (fd.get("shipping_postal_code") as string) || null : null,
        shipping_city: needsShipping ? (fd.get("shipping_city") as string) || null : null,
        shipping_province: needsShipping ? (fd.get("shipping_province") as string) || null : null,
        shipping_country: needsShipping ? ((fd.get("shipping_country") as string) || "España") : null,
        items,
        payment_option: paymentOption,
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
          Gracias. Recibirás la proforma por email en breve para proceder con el pago.
        </p>
      </div>
    );
  }

  // Quote items calculations
  const discountFactor = paymentOption === "full" ? 0.95 : 1;
  const subtotal = items.reduce((sum, i) => sum + i.price * i.units, 0);
  const discountedSubtotal = Math.round(subtotal * discountFactor * 100) / 100;
  const taxBreakdown = items.reduce<Record<number, number>>((acc, i) => {
    const lineSubtotal = i.price * i.units * discountFactor;
    const taxAmount = lineSubtotal * (i.tax / 100);
    acc[i.tax] = (acc[i.tax] || 0) + taxAmount;
    return acc;
  }, {});
  const totalTax = Object.values(taxBreakdown).reduce((s, v) => s + v, 0);
  const total = discountedSubtotal + totalTax;

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
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            Puedes ajustar las unidades de cada línea si lo necesitas.
          </p>

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
                    <td className="py-2.5 pr-4 text-right">
                      <input
                        type="number"
                        min="1"
                        value={item.units}
                        onChange={(e) => updateUnits(i, e.target.value)}
                        className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 text-right text-sm tabular-nums text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                      />
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{item.price.toFixed(2)} €</td>
                    <td className="py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{(item.price * item.units).toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Payment option */}
          <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <p className="mb-3 text-sm font-medium text-zinc-900 dark:text-white">Forma de pago</p>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3 transition-colors has-[:checked]:border-brand has-[:checked]:bg-brand/5 dark:border-zinc-700 dark:has-[:checked]:border-brand">
                <input
                  type="radio"
                  name="payment_option"
                  value="full"
                  checked={paymentOption === "full"}
                  onChange={() => setPaymentOption("full")}
                  className="mt-0.5 h-4 w-4 text-brand focus:ring-brand"
                />
                <div>
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">Pago único — 5% de descuento</span>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Paga el 100% ahora y recibe un 5% de descuento sobre el total.</p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3 transition-colors has-[:checked]:border-brand has-[:checked]:bg-brand/5 dark:border-zinc-700 dark:has-[:checked]:border-brand">
                <input
                  type="radio"
                  name="payment_option"
                  value="split"
                  checked={paymentOption === "split"}
                  onChange={() => setPaymentOption("split")}
                  className="mt-0.5 h-4 w-4 text-brand focus:ring-brand"
                />
                <div>
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">Pago 50% — 50%</span>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">50% al aceptar el presupuesto, 50% a la entrega del proyecto.</p>
                </div>
              </label>
            </div>
          </div>

          {/* Totals */}
          <div className="mt-4 space-y-1 border-t border-zinc-200 pt-3 dark:border-zinc-700">
            <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
              <span>Subtotal</span>
              <span className="tabular-nums">{subtotal.toFixed(2)} €</span>
            </div>
            {paymentOption === "full" && (
              <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                <span>Descuento 5%</span>
                <span className="tabular-nums">-{(subtotal * 0.05).toFixed(2)} €</span>
              </div>
            )}
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
            {paymentOption === "split" && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Primer pago: {(total / 2).toFixed(2)} € · Segundo pago: {(total / 2).toFixed(2)} €
              </p>
            )}
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
            <AddressAutocomplete name="billing_address" required className={inputClass} onAddressSelect={fillBillingAddress} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Código postal *
              </label>
              <input ref={billingPostalRef} name="billing_postal_code" type="text" required className={inputClass} placeholder="28001" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Ciudad *
              </label>
              <input ref={billingCityRef} name="billing_city" type="text" required className={inputClass} placeholder="Madrid" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Provincia *
              </label>
              <input ref={billingProvinceRef} name="billing_province" type="text" required className={inputClass} placeholder="Madrid" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                País
              </label>
              <input ref={billingCountryRef} name="billing_country" type="text" defaultValue="España" className={inputClass} />
            </div>
          </div>
        </div>

        {/* Shipping toggle */}
        <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={needsShipping}
              onChange={(e) => setNeedsShipping(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-brand focus:ring-brand dark:border-zinc-600 dark:bg-zinc-900"
            />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Necesito que me enviéis el producto
            </span>
          </label>
        </div>

        {/* Shipping fields */}
        {needsShipping && (
          <div className="mt-4 space-y-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Dirección de envío
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Nombre del destinatario *
                </label>
                <input name="shipping_recipient_name" type="text" required className={inputClass} placeholder="Juan Pérez" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Teléfono de contacto *
                </label>
                <input name="shipping_recipient_phone" type="tel" required className={inputClass} placeholder="612 345 678" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Dirección (calle y número) *
              </label>
              <AddressAutocomplete name="shipping_address" required className={inputClass} onAddressSelect={fillShippingAddress} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Código postal *
                </label>
                <input ref={shippingPostalRef} name="shipping_postal_code" type="text" required className={inputClass} placeholder="28001" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Ciudad *
                </label>
                <input ref={shippingCityRef} name="shipping_city" type="text" required className={inputClass} placeholder="Madrid" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Provincia *
                </label>
                <input ref={shippingProvinceRef} name="shipping_province" type="text" required className={inputClass} placeholder="Madrid" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  País
                </label>
                <input ref={shippingCountryRef} name="shipping_country" type="text" defaultValue="España" className={inputClass} />
              </div>
            </div>
          </div>
        )}

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
