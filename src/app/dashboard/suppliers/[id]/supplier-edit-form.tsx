"use client";

import { useState, useRef } from "react";
import { updateSupplier } from "../actions";

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  nif_cif: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  holded_contact_id: string | null;
}

const inputClass =
  "mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500";

export default function SupplierEditForm({
  supplier,
  deleteForm,
}: {
  supplier: Supplier;
  deleteForm: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    try {
      await updateSupplier(formData);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {supplier.name}
            </h1>
            {supplier.holded_contact_id && (
              <span className="mt-1 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                Holded vinculado
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Editar
            </button>
            {deleteForm}
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 md:grid-cols-3">
          {supplier.email && (
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Email: </span>
              <span className="text-zinc-900 dark:text-white">
                {supplier.email}
              </span>
            </div>
          )}
          {supplier.phone && (
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Tel: </span>
              <a
                href={`tel:${supplier.phone}`}
                className="text-zinc-900 hover:text-green-600 dark:text-white dark:hover:text-green-400"
              >
                {supplier.phone}
              </a>
            </div>
          )}
          {supplier.nif_cif && (
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">
                NIF/CIF:{" "}
              </span>
              <span className="text-zinc-900 dark:text-white">
                {supplier.nif_cif}
              </span>
            </div>
          )}
          {supplier.address && (
            <div className="sm:col-span-2">
              <span className="text-zinc-500 dark:text-zinc-400">
                Direccion:{" "}
              </span>
              <span className="text-zinc-900 dark:text-white">
                {[supplier.address, supplier.city, supplier.country]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </div>
          )}
          {supplier.notes && (
            <div className="sm:col-span-3">
              <span className="text-zinc-500 dark:text-zinc-400">
                Notas:{" "}
              </span>
              <span className="text-zinc-900 dark:text-white">
                {supplier.notes}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="mb-6 rounded-xl border border-green-200 bg-white p-6 dark:border-green-800/50 dark:bg-zinc-900"
    >
      <input type="hidden" name="id" value={supplier.id} />

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
          Editar proveedor
        </h2>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          Cancelar
        </button>
      </div>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label
            htmlFor="edit-name"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Nombre *
          </label>
          <input
            type="text"
            id="edit-name"
            name="name"
            required
            defaultValue={supplier.name}
            className={inputClass}
          />
        </div>

        {/* Email + Phone */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="edit-email"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Email
            </label>
            <input
              type="email"
              id="edit-email"
              name="email"
              defaultValue={supplier.email || ""}
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="edit-phone"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Telefono
            </label>
            <input
              type="text"
              id="edit-phone"
              name="phone"
              defaultValue={supplier.phone || ""}
              className={inputClass}
            />
          </div>
        </div>

        {/* NIF/CIF */}
        <div className="max-w-xs">
          <label
            htmlFor="edit-nif"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            NIF/CIF
          </label>
          <input
            type="text"
            id="edit-nif"
            name="nif_cif"
            defaultValue={supplier.nif_cif || ""}
            className={inputClass}
          />
        </div>

        {/* Address */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label
              htmlFor="edit-address"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Direccion
            </label>
            <input
              type="text"
              id="edit-address"
              name="address"
              defaultValue={supplier.address || ""}
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="edit-city"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Ciudad
            </label>
            <input
              type="text"
              id="edit-city"
              name="city"
              defaultValue={supplier.city || ""}
              className={inputClass}
            />
          </div>
        </div>

        {/* Country */}
        <div className="max-w-xs">
          <label
            htmlFor="edit-country"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Pais
          </label>
          <input
            type="text"
            id="edit-country"
            name="country"
            defaultValue={supplier.country || "ES"}
            className={inputClass}
          />
        </div>

        {/* Notes */}
        <div>
          <label
            htmlFor="edit-notes"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Notas
          </label>
          <textarea
            id="edit-notes"
            name="notes"
            rows={2}
            defaultValue={supplier.notes || ""}
            className={inputClass}
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
