"use client";

import { useMemo, useRef, useState } from "react";
import {
  previewMrwInvoice,
  applyMrwInvoice,
  type InvoicePreview,
  type PreviewLine,
  type ProjectOption,
  type ApplyResult,
} from "./actions";

function eur(n: number | null | undefined) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(n ?? 0);
}

type EditableLine = PreviewLine & { selected: boolean };

export default function ImportClient({
  projects,
}: {
  projects: ProjectOption[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [bulkProject, setBulkProject] = useState<string>("");

  const projectLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) {
      m.set(p.id, p.client_name ? `${p.name} — ${p.client_name}` : p.name);
    }
    return m;
  }, [projects]);

  async function handleAnalyze() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Selecciona el PDF de la factura de MRW.");
      return;
    }
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const p = await previewMrwInvoice(fd);
      setPreview(p);
      setLines(p.lines.map((l) => ({ ...l, selected: false })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al analizar el PDF");
      setPreview(null);
      setLines([]);
    } finally {
      setLoading(false);
    }
  }

  function setLineProject(albaran: string, projectId: string) {
    setLines((prev) =>
      prev.map((l) =>
        l.albaran === albaran
          ? {
              ...l,
              projectId: projectId || null,
              projectName: projectId
                ? (projectLabel.get(projectId) ?? null)
                : null,
            }
          : l,
      ),
    );
  }

  function toggleSelect(albaran: string) {
    setLines((prev) =>
      prev.map((l) =>
        l.albaran === albaran ? { ...l, selected: !l.selected } : l,
      ),
    );
  }

  function applyBulk() {
    if (!bulkProject) return;
    setLines((prev) =>
      prev.map((l) =>
        l.selected
          ? {
              ...l,
              projectId: bulkProject,
              projectName: projectLabel.get(bulkProject) ?? null,
              selected: false,
            }
          : l,
      ),
    );
  }

  async function handleApply() {
    if (!preview) return;
    setApplying(true);
    setError(null);
    try {
      const res = await applyMrwInvoice({
        invoiceNumber: preview.invoiceNumber,
        invoiceDate: preview.invoiceDate,
        period: preview.period,
        costCenter: preview.costCenter,
        linesAmount: preview.linesAmount,
        surchargeAmount: preview.surchargeAmount,
        grossAmount: preview.grossAmount,
        taxAmount: preview.taxAmount,
        totalAmount: preview.totalAmount,
        lines: lines.map((l) => ({
          albaran: l.albaran,
          date: l.date,
          kind: l.kind,
          party_name: l.party_name,
          city: l.city,
          postal_code: l.postal_code,
          proratedCost: l.proratedCost,
          shippingInfoId: l.shippingInfoId,
          projectId: l.projectId,
        })),
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al aplicar la imputación");
    } finally {
      setApplying(false);
    }
  }

  const assignedCount = lines.filter((l) => l.projectId).length;
  const assignedAmount = lines
    .filter((l) => l.projectId)
    .reduce((s, l) => s + l.proratedCost, 0);
  const selectedCount = lines.filter((l) => l.selected).length;
  const reconOk =
    preview &&
    Math.abs(
      preview.linesAmount + preview.surchargeAmount - preview.grossAmount,
    ) < 0.02;

  return (
    <div className="space-y-6">
      {/* Upload */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-200"
        />
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? "Analizando factura…" : "Analizar PDF"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-300">
          Imputación aplicada: <strong>{result.imputed}</strong> envíos por{" "}
          <strong>{eur(result.imputedAmount)}</strong>. {result.skipped} líneas
          sin imputar (gasto general).
        </div>
      )}

      {preview && (
        <>
          {/* Summary */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold text-zinc-900 dark:text-white">
                Factura {preview.invoiceNumber ?? "—"}
                <span className="ml-2 text-sm font-normal text-zinc-500">
                  {preview.invoiceDate ?? ""}
                  {preview.costCenter ? ` · CC ${preview.costCenter}` : ""}
                </span>
              </h2>
              {preview.alreadyImported && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  Ya importada — se sobreescribirá
                </span>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              <Metric label="Envíos" value={String(preview.lines.length)} />
              <Metric label="Base envíos" value={eur(preview.linesAmount)} />
              <Metric label="Recargos" value={eur(preview.surchargeAmount)} />
              <Metric label="Base total" value={eur(preview.grossAmount)} />
              <Metric label="IVA" value={eur(preview.taxAmount)} />
              <Metric label="Total" value={eur(preview.totalAmount)} />
            </div>
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Recargos prorrateados: cada envío ×{" "}
              {preview.prorationFactor.toFixed(3)}.{" "}
              {reconOk ? (
                <span className="text-green-600 dark:text-green-400">
                  Cuadra base + recargos = base total ✓
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">
                  Revisa: base + recargos ≠ base total
                </span>
              )}
            </p>
          </div>

          {/* Bulk assign */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">
              {selectedCount} seleccionadas →
            </span>
            <select
              value={bulkProject}
              onChange={(e) => setBulkProject(e.target.value)}
              className="max-w-xs rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="">Elegir proyecto…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.client_name ? `${p.name} — ${p.client_name}` : p.name}
                </option>
              ))}
            </select>
            <button
              onClick={applyBulk}
              disabled={!bulkProject || selectedCount === 0}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Asignar a seleccionadas
            </button>
          </div>

          {/* Lines table */}
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="w-8 px-2 py-2"></th>
                  <th className="px-3 py-2">Albarán</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Destinatario</th>
                  <th className="px-3 py-2 text-right">Base</th>
                  <th className="px-3 py-2 text-right">Coste imput.</th>
                  <th className="px-3 py-2">Proyecto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {lines.map((l) => {
                  const unassigned = !l.projectId;
                  return (
                    <tr
                      key={l.albaran}
                      className={
                        unassigned
                          ? "bg-amber-50/50 dark:bg-amber-950/10"
                          : "bg-white dark:bg-zinc-950"
                      }
                    >
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={l.selected}
                          onChange={() => toggleSelect(l.albaran)}
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        {l.albaran}
                        {l.kind === "pickup" && (
                          <span className="ml-1 rounded bg-blue-100 px-1 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            recogida
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-zinc-500">
                        {l.date ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-zinc-800 dark:text-zinc-200">
                          {l.party_name ?? "—"}
                        </div>
                        <div className="text-xs text-zinc-400">{l.city}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-500">
                        {eur(l.amount)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-zinc-900 dark:text-zinc-100">
                        {eur(l.proratedCost)}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={l.projectId ?? ""}
                          onChange={(e) =>
                            setLineProject(l.albaran, e.target.value)
                          }
                          className={`w-full max-w-xs rounded-lg border px-2 py-1 text-xs ${
                            unassigned
                              ? "border-amber-300 dark:border-amber-800"
                              : "border-zinc-300 dark:border-zinc-700"
                          } bg-white dark:bg-zinc-800`}
                        >
                          <option value="">— Gasto general —</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.client_name
                                ? `${p.name} — ${p.client_name}`
                                : p.name}
                            </option>
                          ))}
                        </select>
                        {l.matchType === "albaran" && (
                          <span className="ml-1 text-[10px] text-green-600 dark:text-green-400">
                            auto
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Apply */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-sm text-zinc-600 dark:text-zinc-300">
              <strong>{assignedCount}</strong> de {lines.length} envíos
              asignados · se imputarán <strong>{eur(assignedAmount)}</strong>
            </div>
            <button
              onClick={handleApply}
              disabled={applying || assignedCount === 0}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {applying ? "Aplicando…" : "Aplicar imputación"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
      <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-zinc-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}
