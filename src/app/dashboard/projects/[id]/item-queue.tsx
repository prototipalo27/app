"use client";

import { useState, useTransition } from "react";
import type { Tables } from "@/lib/supabase/database.types";
import {
  updateItemPrintConfig,
  generatePrintJobs,
  cancelPrintJob,
  completePrintJob,
  startPrintJob,
} from "../queue-actions";
import { calculateSTLVolumeCm3 } from "@/lib/stl-volume";
import { estimatePrintMinutes, SUPPORTED_MATERIALS } from "@/lib/print-time-estimate";

type PrinterType = Tables<"printer_types">;
type PrintJob = Tables<"print_jobs"> & {
  printer_name?: string;
};

interface ItemQueueProps {
  item: Tables<"project_items">;
  printerTypes: PrinterType[];
  jobs: PrintJob[];
  driveFiles: Array<{ id: string; name: string }>;
}

const STATUS_COLORS: Record<string, string> = {
  queued: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  printing: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  done: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500",
};

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}

export function ItemQueue({ item, printerTypes, jobs, driveFiles }: ItemQueueProps) {
  const [isPending, startTransition] = useTransition();
  const [printTime, setPrintTime] = useState<string>(
    item.print_time_minutes?.toString() || ""
  );
  const [printerTypeId, setPrinterTypeId] = useState<string>(
    item.printer_type_id || ""
  );
  const [estimating, setEstimating] = useState(false);
  const [material, setMaterial] = useState("PLA");

  const stlFiles = driveFiles.filter((f) =>
    f.name.toLowerCase().endsWith(".stl")
  );

  async function handleEstimateSTL(fileId: string) {
    setEstimating(true);
    try {
      const res = await fetch(`/api/drive/download/${fileId}`);
      if (!res.ok) throw new Error("Failed to download STL");
      const buffer = await res.arrayBuffer();
      const volumeCm3 = calculateSTLVolumeCm3(buffer);
      const minutes = estimatePrintMinutes(volumeCm3, material);
      setPrintTime(minutes.toString());

      startTransition(async () => {
        await updateItemPrintConfig(
          item.id,
          minutes,
          printerTypeId || null,
          volumeCm3,
          fileId
        );
      });
    } catch (e) {
      console.error("STL estimation failed:", e);
    } finally {
      setEstimating(false);
    }
  }

  function handleSaveConfig() {
    const minutes = parseInt(printTime, 10);
    startTransition(async () => {
      await updateItemPrintConfig(
        item.id,
        minutes > 0 ? minutes : null,
        printerTypeId || null
      );
    });
  }

  function handleGenerate() {
    startTransition(async () => {
      try {
        await generatePrintJobs(item.id);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Error al generar cola");
      }
    });
  }

  const activeJobs = jobs.filter((j) => j.status !== "cancelled");
  const queuedCount = activeJobs.filter((j) => j.status === "queued").length;
  const printingCount = activeJobs.filter((j) => j.status === "printing").length;
  const doneCount = activeJobs.filter((j) => j.status === "done").length;
  const canGenerate =
    parseInt(printTime, 10) > 0 && printerTypeId;

  return (
    <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
      {/* Config row */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
            Tipo impresora
          </label>
          <select
            value={printerTypeId}
            onChange={(e) => setPrinterTypeId(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            <option value="">Seleccionar...</option>
            {printerTypes.map((pt) => (
              <option key={pt.id} value={pt.id}>
                {pt.name} ({pt.bed_width_mm}x{pt.bed_depth_mm}mm{pt.multicolor ? " MC" : ""})
              </option>
            ))}
          </select>
        </div>

        <div className="w-24">
          <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
            Tiempo (min)
          </label>
          <input
            type="number"
            min={1}
            value={printTime}
            onChange={(e) => setPrintTime(e.target.value)}
            placeholder="min"
            className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>

        <button
          type="button"
          onClick={handleSaveConfig}
          disabled={isPending}
          className="rounded-lg bg-zinc-200 px-2.5 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
        >
          Guardar
        </button>
      </div>

      {/* STL estimation row */}
      {stlFiles.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
              Estimar desde STL
            </label>
            <div className="flex gap-2">
              <select
                id={`material-${item.id}`}
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                {SUPPORTED_MATERIALS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {stlFiles.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => handleEstimateSTL(file.id)}
                  disabled={estimating || isPending}
                  className="truncate rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
                  title={file.name}
                >
                  {estimating ? "Calculando..." : file.name}
                </button>
              ))}
            </div>
          </div>
          {item.stl_volume_cm3 && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              Vol: {Number(item.stl_volume_cm3).toFixed(1)} cm3
            </span>
          )}
        </div>
      )}

      {/* Generate button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending || !canGenerate}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {isPending ? "Generando..." : "Generar cola"}
        </button>
        {activeJobs.length > 0 && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {queuedCount} en cola, {printingCount} imprimiendo, {doneCount} completados
          </span>
        )}
      </div>

      {/* Jobs list */}
      {activeJobs.length > 0 && (
        <div className="space-y-1.5">
          {activeJobs.map((job) => (
            <div
              key={job.id}
              className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50"
            >
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[job.status] || STATUS_COLORS.queued}`}
              >
                {job.status}
              </span>
              <span className="text-xs text-zinc-700 dark:text-zinc-300">
                Batch {job.batch_number}
              </span>
              <span className="text-xs text-zinc-400">
                {job.pieces_in_batch} pzs
              </span>
              <span className="text-xs text-zinc-400">
                ~{formatMinutes(job.estimated_minutes)}
              </span>
              {job.printer_name && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {job.printer_name}
                </span>
              )}
              <div className="ml-auto flex gap-1">
                {job.status === "queued" && (
                  <>
                    <button
                      type="button"
                      onClick={() => startTransition(() => startPrintJob(job.id))}
                      disabled={isPending}
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                    >
                      Iniciar
                    </button>
                    <button
                      type="button"
                      onClick={() => startTransition(() => cancelPrintJob(job.id))}
                      disabled={isPending}
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      Cancelar
                    </button>
                  </>
                )}
                {job.status === "printing" && (
                  <button
                    type="button"
                    onClick={() => startTransition(() => completePrintJob(job.id))}
                    disabled={isPending}
                    className="rounded px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                  >
                    Completar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
