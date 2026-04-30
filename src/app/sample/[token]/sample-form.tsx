"use client";

import { useRef, useState, useTransition } from "react";
import { submitSampleAddress } from "./actions";
import AddressAutocomplete, { type AddressComponents } from "@/components/address-autocomplete";

export default function SampleForm({
  token,
  defaults,
}: {
  token: string;
  defaults: {
    recipient_name: string;
    recipient_phone: string;
    recipient_email: string;
  };
}) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const postalRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const provinceRef = useRef<HTMLInputElement>(null);
  const countryRef = useRef<HTMLInputElement>(null);

  const fillAddress = (c: AddressComponents) => {
    if (postalRef.current) postalRef.current.value = c.postalCode;
    if (cityRef.current) cityRef.current.value = c.city;
    if (provinceRef.current) provinceRef.current.value = c.province;
    if (countryRef.current) countryRef.current.value = c.country;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const payload = {
      recipient_name: String(formData.get("recipient_name") || ""),
      recipient_phone: String(formData.get("recipient_phone") || ""),
      recipient_email: String(formData.get("recipient_email") || ""),
      street: String(formData.get("street") || ""),
      postal_code: String(formData.get("postal_code") || ""),
      city: String(formData.get("city") || ""),
      province: String(formData.get("province") || ""),
      country: String(formData.get("country") || "España"),
      notes: String(formData.get("notes") || ""),
    };

    if (!payload.recipient_name.trim() || !payload.street.trim() || !payload.postal_code.trim() || !payload.city.trim()) {
      setError("Por favor, rellena nombre, dirección, código postal y ciudad");
      return;
    }

    startTransition(async () => {
      const result = await submitSampleAddress(token, payload);
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
          ¡Datos recibidos!
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Preparamos tu muestra y te avisamos con el tracking en cuanto salga.
        </p>
      </div>
    );
  }

  const inputClass =
    "block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white";

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Datos de contacto</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            name="recipient_name"
            placeholder="Nombre y apellidos"
            defaultValue={defaults.recipient_name}
            required
            className={inputClass + " sm:col-span-2"}
          />
          <input
            type="email"
            name="recipient_email"
            placeholder="Email"
            defaultValue={defaults.recipient_email}
            className={inputClass}
          />
          <input
            type="tel"
            name="recipient_phone"
            placeholder="Teléfono"
            defaultValue={defaults.recipient_phone}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Dirección de envío</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <AddressAutocomplete
              name="street"
              placeholder="Calle, número, piso..."
              required
              className={inputClass}
              onAddressSelect={fillAddress}
            />
          </div>
          <input
            ref={postalRef}
            type="text"
            name="postal_code"
            placeholder="Código postal"
            required
            className={inputClass}
          />
          <input
            ref={cityRef}
            type="text"
            name="city"
            placeholder="Ciudad"
            required
            className={inputClass}
          />
          <input
            ref={provinceRef}
            type="text"
            name="province"
            placeholder="Provincia"
            className={inputClass}
          />
          <input
            ref={countryRef}
            type="text"
            name="country"
            placeholder="País"
            defaultValue="España"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Notas (opcional)</p>
        <textarea
          name="notes"
          rows={3}
          placeholder="Horario de entrega, indicaciones para el repartidor, etc."
          className={inputClass + " resize-none"}
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 dark:focus:ring-offset-black"
      >
        {isPending ? "Enviando..." : "Enviar mis datos"}
      </button>
    </form>
  );
}
