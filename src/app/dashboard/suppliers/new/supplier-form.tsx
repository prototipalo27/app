"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function SupplierForm({
  action,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  children: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [autofilled, setAutofilled] = useState(false);

  // Watch for hidden autofill fields and populate visible inputs
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const form = formRef.current;
      if (!form) return;

      const autofillName = form.querySelector<HTMLInputElement>(
        'input[name="autofill_name"]'
      );
      if (autofillName && autofillName.value) {
        const fields = [
          "name",
          "email",
          "phone",
          "nif_cif",
          "address",
          "city",
          "country",
        ];
        fields.forEach((field) => {
          const hidden = form.querySelector<HTMLInputElement>(
            `input[name="autofill_${field}"]`
          );
          const visible = form.querySelector<HTMLInputElement>(
            `[name="${field}"]`
          );
          if (hidden && visible && hidden.value) {
            visible.value = hidden.value;
          }
        });
        setAutofilled(true);
      } else if (autofilled) {
        setAutofilled(false);
      }
    });

    if (formRef.current) {
      observer.observe(formRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["value"],
      });
    }

    return () => observer.disconnect();
  }, [autofilled]);

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {/* Holded selector */}
      {children}

      {/* Name */}
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Nombre *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
          placeholder="Nombre del proveedor"
        />
      </div>

      {/* Email + Phone */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
          />
        </div>
        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Telefono
          </label>
          <input
            type="text"
            id="phone"
            name="phone"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
          />
        </div>
      </div>

      {/* NIF/CIF */}
      <div className="max-w-xs">
        <label
          htmlFor="nif_cif"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          NIF/CIF
        </label>
        <input
          type="text"
          id="nif_cif"
          name="nif_cif"
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
        />
      </div>

      {/* Address */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label
            htmlFor="address"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Direccion
          </label>
          <input
            type="text"
            id="address"
            name="address"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
          />
        </div>
        <div>
          <label
            htmlFor="city"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Ciudad
          </label>
          <input
            type="text"
            id="city"
            name="city"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
          />
        </div>
      </div>

      {/* Country */}
      <div className="max-w-xs">
        <label
          htmlFor="country"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Pais
        </label>
        <input
          type="text"
          id="country"
          name="country"
          defaultValue="ES"
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
        />
      </div>

      {/* Notes */}
      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Notas
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <Link
          href="/dashboard/suppliers"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-zinc-900"
        >
          Crear proveedor
        </button>
      </div>
    </form>
  );
}
