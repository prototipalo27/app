"use client";

import { useState, useRef } from "react";
import { submitClientNames } from "./actions";
import { parseNameListFile, type ParsedEntry } from "@/lib/name-list-parser";

type NameEntry = {
  line1: string;
  line2?: string;
  checked: boolean;
};

type Mode = "write" | "upload";

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
  const [mode, setMode] = useState<Mode>("write");
  const [entries, setEntries] = useState<NameEntry[]>(
    existingEntries.length > 0
      ? existingEntries
      : [{ line1: "", checked: false }]
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedPreview, setParsedPreview] = useState<ParsedEntry[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);

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

  async function handleSubmit(toSave?: NameEntry[]) {
    const source = toSave ?? entries;
    const filtered = source.filter((e) => e.line1.trim());
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
      setParsedPreview(null);
      setUploadFileName(null);
    } else {
      setError(result.error ?? "Error al guardar");
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setParsing(true);
    try {
      const parsed = await parseNameListFile(file);
      if (parsed.length === 0) {
        setError("No se ha detectado ningún nombre en el archivo");
        return;
      }
      setUploadFileName(file.name);
      setParsedPreview(parsed);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo leer el archivo",
      );
    } finally {
      setParsing(false);
    }
  }

  function applyPreview(strategy: "replace" | "append") {
    if (!parsedPreview) return;
    const next =
      strategy === "replace"
        ? parsedPreview.map((p) => ({
            line1: p.line1,
            line2: p.line2,
            checked: false,
          }))
        : [
            ...entries.filter((e) => e.line1.trim()),
            ...parsedPreview.map((p) => ({
              line1: p.line1,
              line2: p.line2,
              checked: false,
            })),
          ];
    setEntries(next);
    setMode("write");
    setSaved(false);
    // Guardamos directamente: el cliente ya hizo el "submit" al confirmar la subida
    handleSubmit(next);
  }

  const filledCount = entries.filter((e) => e.line1.trim()).length;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
            {itemName}
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Línea 1: nombre del premio o título. Línea 2 (opcional): persona.
          </p>
        </div>
        <a
          href="/api/names-template"
          download
          className="shrink-0 rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ↓ Plantilla
        </a>
      </div>

      {/* Pestañas */}
      <div className="mb-4 inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-800 dark:bg-zinc-800">
        <button
          onClick={() => setMode("write")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === "write"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-white"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          Escribir aquí
        </button>
        <button
          onClick={() => setMode("upload")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === "upload"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-white"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          Subir Excel/CSV
        </button>
      </div>

      {mode === "write" && (
        <>
          <div className="space-y-3">
            {entries.map((entry, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 rounded-lg border border-zinc-100 p-3 dark:border-zinc-800"
              >
                <span className="mt-2 w-5 shrink-0 text-right font-mono text-xs text-zinc-400">
                  {idx + 1}
                </span>
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={entry.line1}
                    onChange={(e) => updateEntry(idx, "line1", e.target.value)}
                    placeholder="Línea 1 (ej: Premio MVP)"
                    className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
                  />
                  <input
                    type="text"
                    value={entry.line2 ?? ""}
                    onChange={(e) => updateEntry(idx, "line2", e.target.value)}
                    placeholder="Línea 2 — opcional (ej: Ana García)"
                    className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
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

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={addRow}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              + Agregar fila
            </button>
            <button
              onClick={() => handleSubmit()}
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
        </>
      )}

      {mode === "upload" && (
        <div className="space-y-3">
          {!parsedPreview && (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-800/50">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Sube un archivo <strong>.xlsx</strong>, <strong>.xls</strong> o{" "}
                <strong>.csv</strong>. Columna A = nombre del premio, columna B =
                persona (opcional).
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={parsing}
                className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {parsing ? "Leyendo..." : "Elegir archivo"}
              </button>
              <p className="mt-2 text-[11px] text-zinc-400">
                ¿Sin plantilla? <a className="underline" href="/api/names-template" download>Descárgala aquí</a>.
              </p>
            </div>
          )}

          {parsedPreview && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  <strong>{parsedPreview.length}</strong> nombre
                  {parsedPreview.length === 1 ? "" : "s"} detectado
                  {parsedPreview.length === 1 ? "" : "s"} en{" "}
                  <span className="font-mono text-[11px] text-zinc-500">
                    {uploadFileName}
                  </span>
                </p>
                <button
                  onClick={() => {
                    setParsedPreview(null);
                    setUploadFileName(null);
                  }}
                  className="text-[11px] text-zinc-400 underline hover:text-zinc-600"
                >
                  Cambiar archivo
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800">
                <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
                  {parsedPreview.map((p, i) => (
                    <li key={i} className="flex items-baseline gap-2 px-3 py-1.5 text-xs">
                      <span className="w-6 shrink-0 text-right font-mono text-zinc-400">
                        {i + 1}
                      </span>
                      <span className="font-medium text-zinc-900 dark:text-white">
                        {p.line1}
                      </span>
                      {p.line2 && (
                        <span className="text-zinc-500 dark:text-zinc-400">
                          — {p.line2}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => applyPreview("replace")}
                  disabled={saving}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
                >
                  {saving ? "Guardando…" : "Usar estos nombres"}
                </button>
                {filledCount > 0 && (
                  <button
                    onClick={() => applyPreview("append")}
                    disabled={saving}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Añadir al final ({filledCount} ya escritos)
                  </button>
                )}
                {saved && (
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">
                    Guardado
                  </span>
                )}
                {error && (
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">
                    {error}
                  </span>
                )}
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.txt"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}
    </div>
  );
}
