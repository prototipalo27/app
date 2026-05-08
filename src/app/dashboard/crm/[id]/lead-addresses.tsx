"use client";

import { useState, useTransition } from "react";
import type { Tables } from "@/lib/supabase/database.types";
import {
  saveClientAddress,
  updateClientAddress,
  deleteClientAddress,
} from "../../projects/[id]/address-actions";

type ClientAddress = Tables<"client_addresses">;

interface LeadAddressesProps {
  holdedContactId: string | null;
  initialAddresses: ClientAddress[];
}

interface DraftAddress {
  label: string;
  recipientName: string;
  recipientPhone: string;
  recipientEmail: string;
  addressLine: string;
  city: string;
  postalCode: string;
  province: string;
  country: string;
  isDefault: boolean;
}

const EMPTY_DRAFT: DraftAddress = {
  label: "",
  recipientName: "",
  recipientPhone: "",
  recipientEmail: "",
  addressLine: "",
  city: "",
  postalCode: "",
  province: "",
  country: "ES",
  isDefault: false,
};

function addressToDraft(addr: ClientAddress): DraftAddress {
  return {
    label: addr.label ?? "",
    recipientName: addr.recipient_name ?? "",
    recipientPhone: addr.recipient_phone ?? "",
    recipientEmail: addr.recipient_email ?? "",
    addressLine: addr.address_line ?? "",
    city: addr.city ?? "",
    postalCode: addr.postal_code ?? "",
    province: addr.province ?? "",
    country: addr.country ?? "ES",
    isDefault: Boolean(addr.is_default),
  };
}

export default function LeadAddresses({ holdedContactId, initialAddresses }: LeadAddressesProps) {
  const [addresses, setAddresses] = useState<ClientAddress[]>(initialAddresses);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<DraftAddress>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!holdedContactId) {
    return (
      <div>
        <h3 className="mb-2 text-sm font-semibold text-card-foreground">
          Direcciones de envío
        </h3>
        <p className="rounded-md border border-dashed border-zinc-300 bg-muted/30 p-3 text-xs text-muted-foreground dark:border-zinc-700">
          Disponible cuando el cliente confirme su presupuesto y se cree el contacto en Holded.
          Las direcciones que se guarden aquí estarán disponibles automáticamente al crear envíos del proyecto.
        </p>
      </div>
    );
  }

  function startNew() {
    setDraft({ ...EMPTY_DRAFT, isDefault: addresses.length === 0 });
    setEditingId("new");
    setError(null);
  }

  function startEdit(addr: ClientAddress) {
    setDraft(addressToDraft(addr));
    setEditingId(addr.id);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
  }

  function patch<K extends keyof DraftAddress>(key: K, value: DraftAddress[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    if (!holdedContactId) return;
    if (!draft.addressLine.trim() || !draft.city.trim() || !draft.postalCode.trim()) {
      setError("Calle, ciudad y código postal son obligatorios");
      return;
    }
    setError(null);
    startTransition(async () => {
      if (editingId === "new") {
        const result = await saveClientAddress({
          holdedContactId,
          label: draft.label || undefined,
          recipientName: draft.recipientName || undefined,
          recipientPhone: draft.recipientPhone || undefined,
          recipientEmail: draft.recipientEmail || undefined,
          addressLine: draft.addressLine,
          city: draft.city,
          postalCode: draft.postalCode,
          province: draft.province || undefined,
          country: draft.country || undefined,
          isDefault: draft.isDefault,
        });
        if (result.success && result.data) {
          setAddresses((prev) => {
            const next = draft.isDefault
              ? prev.map((a) => ({ ...a, is_default: false }))
              : [...prev];
            return [result.data, ...next];
          });
          cancelEdit();
        } else {
          setError(result.success ? null : result.error || "Error al guardar");
        }
      } else if (editingId) {
        const result = await updateClientAddress(editingId, {
          label: draft.label || undefined,
          recipientName: draft.recipientName || undefined,
          recipientPhone: draft.recipientPhone || undefined,
          recipientEmail: draft.recipientEmail || undefined,
          addressLine: draft.addressLine,
          city: draft.city,
          postalCode: draft.postalCode,
          province: draft.province || undefined,
          country: draft.country || undefined,
          isDefault: draft.isDefault,
        });
        if (result.success) {
          setAddresses((prev) =>
            prev.map((a) =>
              a.id === editingId
                ? {
                    ...a,
                    label: draft.label || null,
                    recipient_name: draft.recipientName || null,
                    recipient_phone: draft.recipientPhone || null,
                    recipient_email: draft.recipientEmail || null,
                    address_line: draft.addressLine,
                    city: draft.city,
                    postal_code: draft.postalCode,
                    province: draft.province || null,
                    country: draft.country || null,
                    is_default: draft.isDefault,
                  }
                : draft.isDefault
                  ? { ...a, is_default: false }
                  : a,
            ),
          );
          cancelEdit();
        } else {
          setError(result.error || "Error al guardar");
        }
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta dirección?")) return;
    startTransition(async () => {
      const result = await deleteClientAddress(id);
      if (result.success) {
        setAddresses((prev) => prev.filter((a) => a.id !== id));
      } else {
        setError(result.error || "Error al eliminar");
      }
    });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-card-foreground">
          Direcciones de envío
        </h3>
        {editingId === null && (
          <button
            type="button"
            onClick={startNew}
            className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            + Añadir
          </button>
        )}
      </div>

      {addresses.length === 0 && editingId === null && (
        <p className="text-xs text-muted-foreground">
          Aún no hay direcciones guardadas. Añade una para que esté disponible al crear el envío del proyecto.
        </p>
      )}

      <div className="space-y-2">
        {addresses.map((addr) => (
          <div key={addr.id}>
            {editingId === addr.id ? (
              <AddressForm
                draft={draft}
                onPatch={patch}
                onSave={save}
                onCancel={cancelEdit}
                pending={pending}
                error={error}
              />
            ) : (
              <div className="rounded-md border bg-muted/20 p-2.5 text-xs dark:bg-zinc-900/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {addr.label && (
                        <span className="font-medium text-foreground">{addr.label}</span>
                      )}
                      {addr.is_default && (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          Por defecto
                        </span>
                      )}
                    </div>
                    {addr.recipient_name && (
                      <p className="mt-0.5 text-muted-foreground">{addr.recipient_name}</p>
                    )}
                    {addr.address_line && (
                      <p className="mt-0.5 text-muted-foreground">{addr.address_line}</p>
                    )}
                    <p className="mt-0.5 text-muted-foreground">
                      {[addr.postal_code, addr.city, addr.province].filter(Boolean).join(", ")}
                    </p>
                    {addr.country && (
                      <p className="mt-0.5 text-muted-foreground">{addr.country}</p>
                    )}
                    {addr.recipient_phone && (
                      <p className="mt-0.5 text-muted-foreground">Tel: {addr.recipient_phone}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(addr)}
                      disabled={pending}
                      className="text-[11px] text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(addr.id)}
                      disabled={pending}
                      className="text-[11px] text-muted-foreground hover:text-destructive disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {editingId === "new" && (
        <div className="mt-2">
          <AddressForm
            draft={draft}
            onPatch={patch}
            onSave={save}
            onCancel={cancelEdit}
            pending={pending}
            error={error}
          />
        </div>
      )}
    </div>
  );
}

interface AddressFormProps {
  draft: DraftAddress;
  onPatch: <K extends keyof DraftAddress>(key: K, value: DraftAddress[K]) => void;
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
  error: string | null;
}

function AddressForm({ draft, onPatch, onSave, onCancel, pending, error }: AddressFormProps) {
  const inputClass =
    "block w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500";

  return (
    <div className="rounded-md border bg-muted/30 p-3 dark:bg-zinc-900/40">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="Etiqueta (Casa, Oficina...)"
          value={draft.label}
          onChange={(e) => onPatch("label", e.target.value)}
          className={`${inputClass} col-span-2`}
        />
        <input
          type="text"
          placeholder="Destinatario"
          value={draft.recipientName}
          onChange={(e) => onPatch("recipientName", e.target.value)}
          className={`${inputClass} col-span-2`}
        />
        <input
          type="tel"
          placeholder="Teléfono"
          value={draft.recipientPhone}
          onChange={(e) => onPatch("recipientPhone", e.target.value)}
          className={inputClass}
        />
        <input
          type="email"
          placeholder="Email"
          value={draft.recipientEmail}
          onChange={(e) => onPatch("recipientEmail", e.target.value)}
          className={inputClass}
        />
        <input
          type="text"
          placeholder="Calle y número"
          value={draft.addressLine}
          onChange={(e) => onPatch("addressLine", e.target.value)}
          className={`${inputClass} col-span-2`}
          required
        />
        <input
          type="text"
          placeholder="Ciudad"
          value={draft.city}
          onChange={(e) => onPatch("city", e.target.value)}
          className={inputClass}
          required
        />
        <input
          type="text"
          placeholder="Código postal"
          value={draft.postalCode}
          onChange={(e) => onPatch("postalCode", e.target.value)}
          className={inputClass}
          required
        />
        <input
          type="text"
          placeholder="Provincia"
          value={draft.province}
          onChange={(e) => onPatch("province", e.target.value)}
          className={inputClass}
        />
        <input
          type="text"
          placeholder="País (ES)"
          value={draft.country}
          onChange={(e) => onPatch("country", e.target.value)}
          className={inputClass}
        />
      </div>

      <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={draft.isDefault}
          onChange={(e) => onPatch("isDefault", e.target.checked)}
          className="rounded border-zinc-300 text-brand focus:ring-brand-blue dark:border-zinc-700"
        />
        Marcar como dirección por defecto
      </label>

      {error && (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
        >
          {pending ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
