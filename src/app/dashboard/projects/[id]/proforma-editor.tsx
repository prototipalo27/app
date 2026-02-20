"use client";

import { useState, useTransition } from "react";
import {
  createProformaWithItems,
  sendProformaToClient,
  type ProformaLineItem,
} from "./proforma-actions";

const TAX_OPTIONS = [
  { value: 0, label: "0%" },
  { value: 4, label: "4%" },
  { value: 10, label: "10%" },
  { value: 21, label: "21%" },
];

function emptyLine(): ProformaLineItem {
  return { concept: "", price: 0, units: 1, tax: 21 };
}

interface ProformaEditorProps {
  projectId: string;
  hasHoldedContact: boolean;
  existingProformaId: string | null;
  proformaSentAt: string | null;
  projectPrice: number | null;
}

export default function ProformaEditor({
  projectId,
  hasHoldedContact,
  existingProformaId,
  proformaSentAt,
  projectPrice,
}: ProformaEditorProps) {
  const [isPending, startTransition] = useTransition();
  const [lines, setLines] = useState<ProformaLineItem[]>([emptyLine()]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [proformaId, setProformaId] = useState<string | null>(existingProformaId);
  const [sentAt, setSentAt] = useState<string | null>(proformaSentAt);
  const [showEditor, setShowEditor] = useState(false);

  const inputClass =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-white";

  const updateLine = (index: number, field: keyof ProformaLineItem, value: string | number) => {
    setLines((prev) =>
      prev.map((line, i) =>
        i === index ? { ...line, [field]: value } : line,
      ),
    );
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (index: number) =>
    setLines((prev) => prev.filter((_, i) => i !== index));

  // Calculations
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.units, 0);
  const taxBreakdown = lines.reduce<Record<number, number>>((acc, l) => {
    const taxAmount = l.price * l.units * (l.tax / 100);
    acc[l.tax] = (acc[l.tax] || 0) + taxAmount;
    return acc;
  }, {});
  const totalTax = Object.values(taxBreakdown).reduce((s, v) => s + v, 0);
  const total = subtotal + totalTax;

  const handleCreate = () => {
    setError(null);
    const validLines = lines.filter((l) => l.concept.trim() && l.price > 0);
    if (validLines.length === 0) {
      setError("Añade al menos una línea con concepto y precio");
      return;
    }
    startTransition(async () => {
      const result = await createProformaWithItems(projectId, validLines, notes || undefined);
      if (result.success) {
        setProformaId(result.proformaId ?? null);
      } else {
        setError(result.error || "Error al crear la proforma");
      }
    });
  };

  const handleSend = () => {
    setError(null);
    startTransition(async () => {
      const result = await sendProformaToClient(projectId);
      if (result.success) {
        setSentAt(new Date().toISOString());
      } else {
        setError(result.error || "Error al enviar");
      }
    });
  };

  // State: already sent
  if (sentAt) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Proforma</h2>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Enviada
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {new Date(sentAt).toLocaleString()}
          </span>
        </div>
        {projectPrice !== null && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Total: <strong>{Number(projectPrice).toFixed(2)} €</strong>
          </p>
        )}
      </div>
    );
  }

  // State: proforma created but not sent
  if (proformaId && !showEditor) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Proforma</h2>
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            Creada en Holded
          </span>
          {projectPrice !== null && (
            <span className="text-sm text-zinc-600 dark:text-zinc-300">
              {Number(projectPrice).toFixed(2)} €
            </span>
          )}
        </div>
        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSend}
            disabled={isPending}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {isPending ? "Enviando..." : "Enviar al cliente"}
          </button>
          <button
            onClick={() => setShowEditor(true)}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Nueva proforma
          </button>
        </div>
      </div>
    );
  }

  // State: no proforma — show editor
  if (!hasHoldedContact) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Proforma</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Vincula un contacto de Holded al proyecto para poder crear proformas.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">Proforma</h2>

      {/* Lines */}
      <div className="space-y-3">
        {lines.map((line, i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_60px_80px_32px] gap-2 items-end">
            <div>
              {i === 0 && (
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Concepto</label>
              )}
              <input
                type="text"
                value={line.concept}
                onChange={(e) => updateLine(i, "concept", e.target.value)}
                placeholder="Descripción"
                className={inputClass}
              />
            </div>
            <div>
              {i === 0 && (
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Precio</label>
              )}
              <input
                type="number"
                step="0.01"
                min="0"
                value={line.price || ""}
                onChange={(e) => updateLine(i, "price", parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className={inputClass}
              />
            </div>
            <div>
              {i === 0 && (
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Uds</label>
              )}
              <input
                type="number"
                min="1"
                value={line.units}
                onChange={(e) => updateLine(i, "units", parseInt(e.target.value) || 1)}
                className={inputClass}
              />
            </div>
            <div>
              {i === 0 && (
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">IVA</label>
              )}
              <select
                value={line.tax}
                onChange={(e) => updateLine(i, "tax", parseInt(e.target.value))}
                className={inputClass}
              >
                {TAX_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className="flex h-[38px] w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addLine}
        className="mt-3 text-sm font-medium text-brand hover:text-brand-dark"
      >
        + Añadir línea
      </button>

      {/* Notes */}
      <div className="mt-4">
        <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Notas</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Notas adicionales (opcional)"
          className={inputClass}
        />
      </div>

      {/* Totals */}
      <div className="mt-4 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
        <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-300">
          <span>Subtotal</span>
          <span>{subtotal.toFixed(2)} €</span>
        </div>
        {Object.entries(taxBreakdown)
          .filter(([, amount]) => amount > 0)
          .map(([rate, amount]) => (
            <div key={rate} className="flex justify-between text-sm text-zinc-600 dark:text-zinc-300">
              <span>IVA {rate}%</span>
              <span>{amount.toFixed(2)} €</span>
            </div>
          ))}
        <div className="mt-1 flex justify-between border-t border-zinc-200 pt-1 text-sm font-semibold text-zinc-900 dark:border-zinc-700 dark:text-white">
          <span>Total</span>
          <span>{total.toFixed(2)} €</span>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        onClick={handleCreate}
        disabled={isPending}
        className="mt-4 w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {isPending ? "Creando proforma..." : "Crear proforma en Holded"}
      </button>
    </div>
  );
}
