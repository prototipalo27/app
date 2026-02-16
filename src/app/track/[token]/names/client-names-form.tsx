"use client";

import { useState } from "react";
import { submitClientNames } from "./actions";

type NameEntry = {
  line1: string;
  line2?: string;
  checked: boolean;
};

export default function ClientNamesForm({
  itemId,
  itemName,
  token,
  existingEntries,
}: {
  itemId: string;
  itemName: string;
  token: string;
  existingEntries: NameEntry[];
}) {
  const [entries, setEntries] = useState<NameEntry[]>(
    existingEntries.length > 0
      ? existingEntries
      : [{ line1: "", checked: false }]
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRow() {
    setEntries((prev) => [...prev, { line1: "", checked: false }]);
    setSaved(false);
  }

  function removeRow(idx: number) {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
    setSaved(false);
  }

  function updateEntry(idx: number, field: "line1" | "line2", value: string) {
    setEntries((prev) =>
      prev.map((e, i) =>
        i === idx
          ? { ...e, [field]: value || (field === "line2" ? undefined : "") }
          : e
      )
    );
    setSaved(false);
  }

  async function handleSubmit() {
    const filtered = entries.filter((e) => e.line1.trim());
    if (filtered.length === 0) {
      setError("Agrega al menos un nombre");
      return;
    }

    setSaving(true);
    setError(null);
    const clean = filtered.map((e) => ({
      line1: e.line1.trim(),
      line2: e.line2?.trim() || undefined,
      checked: e.checked,
    }));

    const result = await submitClientNames(token, itemId, clean);
    setSaving(false);

    if (result.success) {
      setSaved(true);
      setEntries(clean);
    } else {
      setError(result.error ?? "Error al guardar");
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-white">
        {itemName}
      </h2>
      <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
        Linea 1: nombre del premio o titulo. Linea 2 (opcional): nombre de la
        persona.
      </p>

      <div className="space-y-3">
        {entries.map((entry, idx) => (
          <div
            key={idx}
            className="flex items-start gap-2 rounded-lg border border-zinc-100 p-3 dark:border-zinc-800"
          >
            <span className="mt-2 text-xs font-mono text-zinc-400 w-5 shrink-0 text-right">
              {idx + 1}
            </span>
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={entry.line1}
                onChange={(e) => updateEntry(idx, "line1", e.target.value)}
                placeholder="Linea 1 (ej: Premio MVP)"
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
              />
              <input
                type="text"
                value={entry.line2 ?? ""}
                onChange={(e) => updateEntry(idx, "line2", e.target.value)}
                placeholder="Linea 2 — opcional (ej: Ana Garcia)"
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
              />
            </div>
            {entries.length > 1 && (
              <button
                onClick={() => removeRow(idx)}
                className="mt-2 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={addRow}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          + Agregar fila
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar nombres"}
        </button>
        {saved && (
          <span className="text-xs font-medium text-green-600 dark:text-green-400">
            Guardado correctamente
          </span>
        )}
        {error && (
          <span className="text-xs font-medium text-red-600 dark:text-red-400">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
