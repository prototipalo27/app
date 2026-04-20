"use client";

import { useState, useTransition, useRef } from "react";
import { acceptProforma } from "./actions";
import { DISCOUNT_THRESHOLD_EUR, type PaymentCondition } from "./constants";
import AddressAutocomplete, { type AddressComponents } from "@/components/address-autocomplete";

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

function formatEur(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export default function ProformaForm({
  token,
  lines,
  subtotal,
  totalTax,
  total,
}: ProformaFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const billingPostalRef = useRef<HTMLInputElement>(null);
  const billingCityRef = useRef<HTMLInputElement>(null);
  const billingProvinceRef = useRef<HTMLInputElement>(null);
  const billingCountryRef = useRef<HTMLInputElement>(null);
  const shippingPostalRef = useRef<HTMLInputElement>(null);
  const shippingCityRef = useRef<HTMLInputElement>(null);
  const shippingProvinceRef = useRef<HTMLInputElement>(null);
  const shippingCountryRef = useRef<HTMLInputElement>(null);

  const canChoose = subtotal >= DISCOUNT_THRESHOLD_EUR;
  const [paymentCondition, setPaymentCondition] = useState<PaymentCondition>(
    canChoose ? "50-50" : "100-0"
  );

  const chargeAmount =
    paymentCondition === "100-5"
      ? total * 0.95
      : paymentCondition === "50-50"
        ? total * 0.5
        : total;

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
        paymentCondition,
      );

      if (result.success) {
        if (result.redirectUrl) {
          window.location.href = result.redirectUrl;
        } else {
          setError("No se pudo generar el enlace de pago. Contacta con nosotros.");
        }
      } else {
        setError(result.error || "Error al aceptar el presupuesto");
      }
    });
  };

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
      </div>

      {/* Section 4: Payment method */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
          Método de pago
        </h2>

        {canChoose ? (
          <div className="space-y-2">
            <PaymentOption
              value="50-50"
              current={paymentCondition}
              onSelect={setPaymentCondition}
              title="Pago 50 / 50"
              description="Paga el 50% ahora para arrancar la producción y el 50% restante al entregar."
              amountLabel={`Pagas ahora ${formatEur(total * 0.5)}`}
              total={formatEur(total)}
            />
            <PaymentOption
              value="100-5"
              current={paymentCondition}
              onSelect={setPaymentCondition}
              title="Pago completo con 5% de descuento"
              description="Paga el total ahora y te aplicamos un 5% de descuento por anticipado."
              amountLabel={`Pagas ahora ${formatEur(total * 0.95)}`}
              total={`${formatEur(total)} (ahorras ${formatEur(total * 0.05)})`}
              highlight
            />
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800">
            <p className="text-zinc-700 dark:text-zinc-300">
              Pago único del total: <strong>{formatEur(total)}</strong>
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {isPending ? "Procesando..." : `Aceptar y pagar ${formatEur(chargeAmount)}`}
      </button>
      <p className="text-center text-xs text-zinc-400">
        Al pulsar se abre la pasarela de pago segura (Stripe). También puedes pagar por transferencia; consulta los datos en el email.
      </p>
    </form>
  );
}

function PaymentOption({
  value,
  current,
  onSelect,
  title,
  description,
  amountLabel,
  total,
  highlight,
}: {
  value: PaymentCondition;
  current: PaymentCondition;
  onSelect: (v: PaymentCondition) => void;
  title: string;
  description: string;
  amountLabel: string;
  total: string;
  highlight?: boolean;
}) {
  const selected = current === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`w-full rounded-lg border p-4 text-left transition ${
        selected
          ? "border-brand bg-brand/5 dark:bg-brand/10"
          : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
              selected ? "border-brand" : "border-zinc-300 dark:border-zinc-600"
            }`}
          >
            {selected && <div className="h-2 w-2 rounded-full bg-brand" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">
              {title}
              {highlight && (
                <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Recomendado
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{amountLabel}</p>
          <p className="text-[10px] text-zinc-400">Total {total}</p>
        </div>
      </div>
    </button>
  );
}
