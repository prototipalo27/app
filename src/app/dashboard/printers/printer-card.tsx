"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import type { EnrichedJob } from "./printer-grid";

type Printer = Tables<"printers">;
type PrinterType = Tables<"printer_types">;

const STATE_BADGES: Record<string, { label: string; className: string }> = {
  IDLE: { label: "Idle", className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
  RUNNING: { label: "Printing", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  PAUSE: { label: "Paused", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  FINISH: { label: "Finished", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  FAILED: { label: "Failed", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

function StateBadge({ state }: { state: string | null }) {
  const badge = state ? STATE_BADGES[state] : null;
  if (!badge) {
    return (
      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500">
        Unknown
      </span>
    );
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
      {badge.label}
    </span>
  );
}

function formatRemaining(minutes: number | null) {
  if (minutes === null) return null;
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function formatEstimate(minutes: number) {
  if (minutes < 60) return `~${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
}

export default function PrinterCard({
  printer,
  printerTypes = [],
  jobs = [],
}: {
  printer: Printer;
  printerTypes?: PrinterType[];
  jobs?: EnrichedJob[];
}) {
  const isOffline = !printer.online;
  const isRunning = printer.gcode_state === "RUNNING";
  const [typeId, setTypeId] = useState(printer.printer_type_id || "");
  const [saving, setSaving] = useState(false);

  const printingJob = jobs.find((j) => j.status === "printing");
  const queuedJobs = jobs
    .filter((j) => j.status === "queued")
    .sort((a, b) => a.position - b.position);

  async function handleTypeChange(newTypeId: string) {
    setTypeId(newTypeId);
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("printers")
      .update({ printer_type_id: newTypeId || null })
      .eq("id", printer.id);
    setSaving(false);
  }

  return (
    <div
      className={`rounded-xl border p-3 sm:p-4 transition-colors ${
        isOffline
          ? "border-zinc-200 bg-zinc-50 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/50"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      {/* Header */}
      <div className="mb-2 sm:mb-3 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white truncate">{printer.name}</h3>
          <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400">
            {printer.model}
          </p>
          {printerTypes.length > 0 && (
            <select
              value={typeId}
              onChange={(e) => handleTypeChange(e.target.value)}
              disabled={saving}
              className="mt-1 w-full rounded border border-zinc-200 bg-transparent px-1.5 py-0.5 text-[10px] sm:text-xs text-zinc-600 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:text-zinc-400"
            >
              <option value="">Sin tipo</option>
              {printerTypes.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.name} ({pt.bed_width_mm}x{pt.bed_depth_mm}mm{pt.multicolor ? " MC" : ""})
                </option>
              ))}
            </select>
          )}
        </div>
        <StateBadge state={isOffline ? null : printer.gcode_state} />
      </div>

      {/* Project/item info when printing */}
      {isRunning && printingJob && (
        <div className="mb-2 space-y-0.5">
          <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Proyecto:</span>{" "}
            {printingJob.project_name}
          </p>
          <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Pieza:</span>{" "}
            {printingJob.item_name}
            {printingJob.batch_number > 0 && (
              <span className="text-zinc-400 dark:text-zinc-500"> (Batch {printingJob.batch_number})</span>
            )}
          </p>
        </div>
      )}

      {/* Progress section (only when printing) */}
      {isRunning && printer.current_file && (
        <div>
          {/* Only show raw filename if there's no enriched job info */}
          {!printingJob && (
            <div className="mb-1 flex items-center justify-between text-xs sm:text-sm">
              <span className="truncate text-zinc-700 dark:text-zinc-300">{printer.current_file}</span>
              <span className="ml-2 font-mono text-zinc-900 dark:text-zinc-100">{printer.print_percent}%</span>
            </div>
          )}
          {printingJob && (
            <div className="mb-1 flex items-center justify-end">
              <span className="font-mono text-xs sm:text-sm text-zinc-900 dark:text-zinc-100">{printer.print_percent}%</span>
            </div>
          )}
          <div className="h-1.5 sm:h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-500"
              style={{ width: `${printer.print_percent}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400">
            <span>
              {printer.layer_current !== null && printer.layer_total !== null
                ? `L${printer.layer_current}/${printer.layer_total}`
                : ""}
            </span>
            <span>{formatRemaining(printer.remaining_minutes)}</span>
          </div>
        </div>
      )}

      {/* Queued jobs for this printer */}
      {queuedJobs.length > 0 && (
        <div className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
          <p className="mb-1 text-[10px] sm:text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Pendientes ({queuedJobs.length})
          </p>
          <ul className="space-y-0.5">
            {queuedJobs.map((job) => (
              <li key={job.id} className="flex items-center justify-between text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400">
                <span className="truncate">
                  · {job.item_name}
                  {job.batch_number > 0 && ` (B${job.batch_number})`}
                </span>
                <span className="ml-1 shrink-0 text-zinc-400 dark:text-zinc-500">
                  {formatEstimate(job.estimated_minutes)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
