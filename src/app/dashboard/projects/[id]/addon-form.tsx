"use client";

import { useState, useTransition } from "react";
import { addProjectAddon, type AddonItemInput } from "./addon-actions";

interface AddonFormProps {
  projectId: string;
  paymentOption: "full" | "split" | null;
  onClose: () => void;
}

interface DraftItem {
  id: string;
  name: string;
  quantity: string;
  unit_price: string;
}

const IVA = 0.21;

function makeDraft(): DraftItem {
  return { id: crypto.randomUUID(), name: "", quantity: "1", unit_price: "" };
}

export function AddonForm({ projectId, paymentOption, onClose }: AddonFormProps) {
  const [drafts, setDrafts] = useState<DraftItem[]>([makeDraft()]);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string; url?: string } | null>(null);

  const subtotal = drafts.reduce((s, d) => {
    const q = Number(d.quantity);
    const p = Number(d.unit_price);
    if (!Number.isFinite(q) || !Number.isFinite(p)) return s;
    return s + q * p;
  }, 0);
  const total = subtotal * (1 + IVA);

  function updateDraft(id: string, patch: Partial<DraftItem>) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function removeDraft(id: string) {
    setDrafts((prev) => (prev.length > 1 ? prev.filter((d) => d.id !== id) : prev));
  }

  function addDraft() {
    setDrafts((prev) => [...prev, makeDraft()]);
  }

  function handleSubmit() {
    setResult(null);
    const items: AddonItemInput[] = drafts
      .filter((d) => d.name.trim() && Number(d.quantity) > 0 && Number(d.unit_price) >= 0)
      .map((d) => ({
        name: d.name.trim(),
        quantity: Number(d.quantity),
        unit_price: Number(d.unit_price),
      }));

    if (items.length === 0) {
      setResult({ ok: false, message: "Añade al menos un item con nombre, cantidad y precio." });
      return;
    }

    startTransition(async () => {
      const res = await addProjectAddon(projectId, items);
      if (!res.success) {
        setResult({ ok: false, message: res.error ?? "Error desconocido" });
        return;
      }
      setResult({
        ok: true,
        message: "Proforma enviada con link de pago de Stripe.",
        url: res.paymentUrl,
      });
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Añadir items extra</h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Se creará una proforma en Holded y se enviará al cliente.{" "}
              <span className="font-medium">Se genera un link de pago Stripe (100% del extra) y, al pagarse, su factura propia.</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Cerrar"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {result ? (
          <div className="space-y-3">
            <div
              className={`rounded-lg border p-3 text-sm ${
                result.ok
                  ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
                  : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
              }`}
            >
              {result.message}
            </div>
            {result.url && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800">
                <p className="mb-1 font-medium text-zinc-700 dark:text-zinc-300">Link de pago:</p>
                <a
                  href={result.url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-blue-600 underline dark:text-blue-400"
                >
                  {result.url}
                </a>
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {drafts.map((d, idx) => (
                <div key={d.id} className="flex items-end gap-2">
                  <div className="flex-1">
                    {idx === 0 && <label className="mb-1 block text-[10px] font-medium text-zinc-400">Item</label>}
                    <input
                      type="text"
                      value={d.name}
                      onChange={(e) => updateDraft(d.id, { name: e.target.value })}
                      placeholder="p.ej. Trofeo grande"
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                  </div>
                  <div className="w-20">
                    {idx === 0 && <label className="mb-1 block text-[10px] font-medium text-zinc-400">Cantidad</label>}
                    <input
                      type="number"
                      min={1}
                      value={d.quantity}
                      onChange={(e) => updateDraft(d.id, { quantity: e.target.value })}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                  </div>
                  <div className="w-28">
                    {idx === 0 && <label className="mb-1 block text-[10px] font-medium text-zinc-400">€/ud (sin IVA)</label>}
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={d.unit_price}
                      onChange={(e) => updateDraft(d.id, { unit_price: e.target.value })}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                  </div>
                  <button
                    onClick={() => removeDraft(d.id)}
                    disabled={drafts.length === 1}
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
                    aria-label="Quitar"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addDraft}
                className="text-xs text-brand hover:underline"
              >
                + añadir otro item
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Subtotal: <span className="font-medium text-zinc-700 dark:text-zinc-300">{subtotal.toFixed(2)} €</span>
                <span className="mx-2">·</span>
                Total con IVA (21%): <span className="font-semibold text-zinc-900 dark:text-white">{total.toFixed(2)} €</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  disabled={pending}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={pending}
                  className="rounded-lg bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
                >
                  {pending ? "Procesando..." : "Crear proforma + link Stripe"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
