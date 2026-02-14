"use client";

import { useState } from "react";
import Link from "next/link";

interface PrinterInfo {
  id: string;
  name: string;
  printer_type_id: string | null;
  type_name: string | null;
}

interface JobInfo {
  id: string;
  project_item_id: string;
  printer_id: string | null;
  batch_number: number;
  pieces_in_batch: number;
  estimated_minutes: number;
  status: string;
  position: number;
  item_name: string;
  project_name: string;
  project_id: string | null;
}

interface QueueTimelineProps {
  printers: PrinterInfo[];
  jobs: JobInfo[];
}

const STATUS_COLORS: Record<string, string> = {
  queued: "bg-zinc-300 dark:bg-zinc-600",
  printing: "bg-green-500 dark:bg-green-600",
  done: "bg-blue-400 dark:bg-blue-600",
  failed: "bg-red-500 dark:bg-red-600",
};

const STATUS_BORDER: Record<string, string> = {
  queued: "border-zinc-400 dark:border-zinc-500",
  printing: "border-green-600 dark:border-green-500",
  done: "border-blue-500 dark:border-blue-500",
  failed: "border-red-600 dark:border-red-500",
};

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}

export function QueueTimeline({ printers, jobs }: QueueTimelineProps) {
  const [hoveredJob, setHoveredJob] = useState<string | null>(null);

  // Group jobs by printer
  const jobsByPrinter: Record<string, JobInfo[]> = {};
  for (const p of printers) {
    jobsByPrinter[p.id] = [];
  }
  for (const j of jobs) {
    if (j.printer_id && jobsByPrinter[j.printer_id]) {
      jobsByPrinter[j.printer_id].push(j);
    }
  }

  // Unassigned jobs
  const unassignedJobs = jobs.filter((j) => !j.printer_id);

  // Calculate max total minutes across all printers for scale
  let maxMinutes = 60; // minimum 1 hour scale
  for (const printerId of Object.keys(jobsByPrinter)) {
    const total = jobsByPrinter[printerId]
      .filter((j) => j.status !== "done")
      .reduce((sum, j) => sum + j.estimated_minutes, 0);
    if (total > maxMinutes) maxMinutes = total;
  }

  // Generate hour markers
  const totalHours = Math.ceil(maxMinutes / 60);
  const hourMarkers = Array.from({ length: totalHours + 1 }, (_, i) => i);

  // Filter printers that have jobs or have a type assigned
  const printersWithJobs = printers.filter(
    (p) => (jobsByPrinter[p.id]?.length ?? 0) > 0
  );
  const printersWithoutJobs = printers.filter(
    (p) => (jobsByPrinter[p.id]?.length ?? 0) === 0
  );

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-zinc-300 dark:bg-zinc-600" /> En cola
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-green-500" /> Imprimiendo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-blue-400" /> Completado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-red-500" /> Fallido
        </span>
      </div>

      {/* Timeline */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {/* Hour scale header */}
        <div className="flex border-b border-zinc-100 dark:border-zinc-800">
          <div className="w-40 shrink-0 border-r border-zinc-100 px-3 py-2 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Impresora
          </div>
          <div className="relative flex-1">
            <div className="flex" style={{ minWidth: `${totalHours * 120}px` }}>
              {hourMarkers.map((h) => (
                <div
                  key={h}
                  className="border-l border-zinc-100 px-1 py-2 text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500"
                  style={{ width: "120px" }}
                >
                  {h}h
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Printer rows */}
        {printersWithJobs.map((printer) => {
          const printerJobs = jobsByPrinter[printer.id] || [];
          const activeJobs = printerJobs.filter((j) => j.status !== "done");
          const totalMin = activeJobs.reduce((s, j) => s + j.estimated_minutes, 0);

          return (
            <div
              key={printer.id}
              className="flex border-b border-zinc-50 last:border-0 dark:border-zinc-800/50"
            >
              {/* Printer label */}
              <div className="w-40 shrink-0 border-r border-zinc-100 px-3 py-3 dark:border-zinc-800">
                <div className="text-sm font-medium text-zinc-900 dark:text-white">
                  {printer.name}
                </div>
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  {printer.type_name || "Sin tipo"}
                  {totalMin > 0 && ` · ~${formatMinutes(totalMin)}`}
                </div>
              </div>

              {/* Jobs bar */}
              <div className="relative flex flex-1 items-center gap-0.5 px-1 py-2" style={{ minWidth: `${totalHours * 120}px` }}>
                {printerJobs.map((job) => {
                  const widthPx = Math.max(
                    (job.estimated_minutes / 60) * 120,
                    24
                  );
                  const isHovered = hoveredJob === job.id;

                  return (
                    <div
                      key={job.id}
                      className={`relative h-8 shrink-0 cursor-pointer rounded border ${STATUS_COLORS[job.status]} ${STATUS_BORDER[job.status]} transition-all ${isHovered ? "z-10 scale-y-125 brightness-110" : ""}`}
                      style={{ width: `${widthPx}px` }}
                      onMouseEnter={() => setHoveredJob(job.id)}
                      onMouseLeave={() => setHoveredJob(null)}
                    >
                      <span className="absolute inset-0 flex items-center justify-center overflow-hidden px-1 text-[10px] font-medium text-white">
                        {widthPx >= 60 ? `B${job.batch_number} · ${job.pieces_in_batch}pzs` : `B${job.batch_number}`}
                      </span>

                      {/* Tooltip */}
                      {isHovered && (
                        <div className="absolute top-full left-0 z-20 mt-1 w-56 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                          <div className="text-xs font-semibold text-zinc-900 dark:text-white">
                            {job.project_name}
                          </div>
                          <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                            {job.item_name} · Batch {job.batch_number}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            {job.pieces_in_batch} piezas · ~{formatMinutes(job.estimated_minutes)}
                          </div>
                          {job.project_id && (
                            <Link
                              href={`/dashboard/projects/${job.project_id}`}
                              className="mt-1.5 block text-xs text-green-600 hover:underline dark:text-green-400"
                            >
                              Ver proyecto
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {printersWithJobs.length === 0 && (
          <div className="px-6 py-12 text-center text-sm text-zinc-400 dark:text-zinc-500">
            No hay jobs en cola. Genera trabajos desde la pagina de un proyecto.
          </div>
        )}
      </div>

      {/* Idle printers */}
      {printersWithoutJobs.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Impresoras sin trabajos ({printersWithoutJobs.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {printersWithoutJobs.map((p) => (
              <span
                key={p.id}
                className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
              >
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Unassigned jobs */}
      {unassignedJobs.length > 0 && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900/50 dark:bg-yellow-900/10">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-yellow-600 dark:text-yellow-400">
            Jobs sin impresora asignada ({unassignedJobs.length})
          </h3>
          <div className="space-y-1">
            {unassignedJobs.map((j) => (
              <div key={j.id} className="text-xs text-yellow-700 dark:text-yellow-400">
                {j.project_name} &mdash; {j.item_name} Batch {j.batch_number} (~{formatMinutes(j.estimated_minutes)})
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
