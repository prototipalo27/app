"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { addRealMinutes } from "@/lib/schedule";
import { isInLaunchWindow, nextLaunchStartFromSettings, parseTime, type LaunchSettings } from "@/lib/launch-settings";

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
  scheduled_start: string | null;
  item_name: string;
  project_name: string;
  project_id: string | null;
  queue_priority?: number;
  gcode_filename?: string | null;
}

const PRIORITY_RING: Record<number, string> = {
  0: "",
  1: "ring-2 ring-yellow-400",
  2: "ring-2 ring-red-500",
};

const PRIORITY_LABEL: Record<number, string> = {
  0: "Normal",
  1: "Alta",
  2: "Urgente",
};

interface QueueTimelineProps {
  printers: PrinterInfo[];
  jobs: JobInfo[];
  startTime: string;
  launchSettings: LaunchSettings;
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

function formatTime(d: Date): string {
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}

/** Minimum visible window */
const MIN_TIMELINE_HOURS = 48;
/** Label column width in pixels */
const LABEL_WIDTH = 160;
/** Pixels per hour — controls how "zoomed in" the scrollable timeline is */
const PX_PER_HOUR = 60;

/** Tooltip rendered via portal so it's never clipped by overflow */
function JobTooltip({
  job,
  jobStart,
  jobEnd,
  anchorRect,
}: {
  job: JobInfo;
  jobStart: Date;
  jobEnd: Date;
  anchorRect: DOMRect;
}) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;
    const tw = el.offsetWidth;
    const th = el.offsetHeight;

    let top = anchorRect.bottom + 6;
    let left = anchorRect.left;

    // Flip up if overflows bottom
    if (top + th > window.innerHeight - 8) {
      top = anchorRect.top - th - 6;
    }
    // Keep within viewport horizontally
    if (left + tw > window.innerWidth - 8) {
      left = window.innerWidth - tw - 8;
    }
    if (left < 8) left = 8;

    setPos({ top, left });
  }, [anchorRect]);

  return createPortal(
    <div
      ref={tooltipRef}
      className="fixed z-50 w-64 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
      style={{ top: `${pos.top}px`, left: `${pos.left}px` }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-zinc-900 dark:text-white">
          {job.project_name}
        </span>
        {(job.queue_priority ?? 0) > 0 && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
              job.queue_priority === 2
                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
            }`}
          >
            {PRIORITY_LABEL[job.queue_priority ?? 0]}
          </span>
        )}
      </div>
      <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        {job.item_name} · Batch {job.batch_number}
      </div>
      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {job.pieces_in_batch} piezas · ~{formatMinutes(job.estimated_minutes)}
      </div>
      {job.gcode_filename && (
        <div className="mt-0.5 truncate text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
          {job.gcode_filename}
        </div>
      )}
      <div className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
        Inicio: {formatTime(jobStart)} {formatDate(jobStart)}
      </div>
      <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
        Fin est.: {formatTime(jobEnd)} {formatDate(jobEnd)}
      </div>
      {job.project_id && (
        <Link
          href={`/dashboard/projects/${job.project_id}`}
          className="mt-1.5 block text-xs text-green-600 hover:underline dark:text-green-400"
        >
          Ver proyecto
        </Link>
      )}
    </div>,
    document.body
  );
}

export function QueueTimeline({ printers, jobs, startTime, launchSettings }: QueueTimelineProps) {
  const [hoveredJob, setHoveredJob] = useState<string | null>(null);
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const origin = useMemo(() => new Date(startTime), [startTime]);

  // Calculate timeline duration: max(48h, latest job end)
  const totalWallMinutes = useMemo(() => {
    let maxEndMs = origin.getTime() + MIN_TIMELINE_HOURS * 60 * 60000;

    for (const job of jobs) {
      if (job.scheduled_start) {
        const jobStart = new Date(job.scheduled_start);
        const jobEnd = addRealMinutes(jobStart, job.estimated_minutes);
        if (jobEnd.getTime() > maxEndMs) {
          maxEndMs = jobEnd.getTime();
        }
      }
    }

    // Add 2h padding after the latest job
    const totalMin = (maxEndMs - origin.getTime()) / 60000 + 120;
    return totalMin;
  }, [origin, jobs]);

  // Fixed px/min from PX_PER_HOUR — timeline scrolls horizontally
  const pxPerMin = PX_PER_HOUR / 60;
  const timelineWidth = totalWallMinutes * pxPerMin;

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

  const unassignedJobs = jobs.filter((j) => !j.printer_id);

  const handleJobHover = useCallback((jobId: string, el: HTMLElement) => {
    setHoveredJob(jobId);
    setHoveredRect(el.getBoundingClientRect());
  }, []);

  const handleJobLeave = useCallback(() => {
    setHoveredJob(null);
    setHoveredRect(null);
  }, []);

  // Find the hovered job data for the tooltip
  const hoveredJobData = hoveredJob ? jobs.find((j) => j.id === hoveredJob) : null;

  // Generate hour markers
  const hourMarkers = useMemo(() => {
    const pxPerHour = pxPerMin * 60;
    const step = pxPerHour >= 40 ? 1 : pxPerHour >= 15 ? 3 : 6;

    const markers: { label: string; offsetPx: number; isNewDay: boolean }[] = [];
    const cursor = new Date(origin);
    cursor.setMinutes(0, 0, 0);
    cursor.setHours(cursor.getHours() + 1);

    while (cursor.getTime() - origin.getTime() < totalWallMinutes * 60000) {
      if (cursor.getHours() % step === 0) {
        const offsetMin = (cursor.getTime() - origin.getTime()) / 60000;
        markers.push({
          label: formatTime(cursor),
          offsetPx: offsetMin * pxPerMin,
          isNewDay: cursor.getHours() === 0,
        });
      }
      cursor.setHours(cursor.getHours() + 1);
    }
    return markers;
  }, [origin, totalWallMinutes, pxPerMin]);

  // Generate dead-zone bands (no-launch windows)
  const deadZones = useMemo(() => {
    const zones: { leftPx: number; widthPx: number }[] = [];
    const endMs = origin.getTime() + totalWallMinutes * 60000;
    let cursor = new Date(origin);
    const launchEnd = parseTime(launchSettings.launchEndTime);

    while (cursor.getTime() < endMs) {
      if (!isInLaunchWindow(cursor, launchSettings)) {
        const deadStart = cursor.getTime();
        const resumeAt = nextLaunchStartFromSettings(new Date(cursor), launchSettings);
        const deadEnd = Math.min(resumeAt.getTime(), endMs);
        const leftMin = (deadStart - origin.getTime()) / 60000;
        const widthMin = (deadEnd - deadStart) / 60000;
        if (widthMin > 0) {
          zones.push({
            leftPx: leftMin * pxPerMin,
            widthPx: widthMin * pxPerMin,
          });
        }
        cursor = new Date(deadEnd);
      } else {
        const eod = new Date(cursor);
        eod.setHours(launchEnd.h, launchEnd.m, 0, 0);
        cursor = eod;
      }
    }
    return zones;
  }, [origin, totalWallMinutes, pxPerMin, launchSettings]);

  // Day labels for the header
  const dayLabels = useMemo(() => {
    const labels: { label: string; offsetPx: number; widthPx: number }[] = [];
    const endMs = origin.getTime() + totalWallMinutes * 60000;
    const cursor = new Date(origin);
    cursor.setHours(0, 0, 0, 0);

    while (cursor.getTime() < endMs) {
      const dayStart = Math.max(cursor.getTime(), origin.getTime());
      const nextDay = new Date(cursor);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);
      const dayEnd = Math.min(nextDay.getTime(), endMs);

      const leftMin = (dayStart - origin.getTime()) / 60000;
      const widthMin = (dayEnd - dayStart) / 60000;

      if (widthMin > 0) {
        labels.push({
          label: formatDate(new Date(dayStart)),
          offsetPx: leftMin * pxPerMin,
          widthPx: widthMin * pxPerMin,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
    }
    return labels;
  }, [origin, totalWallMinutes, pxPerMin]);

  const printersWithJobs = printers.filter(
    (p) => (jobsByPrinter[p.id]?.length ?? 0) > 0
  );
  const printersWithoutJobs = printers.filter(
    (p) => (jobsByPrinter[p.id]?.length ?? 0) === 0
  );

  return (
    <div ref={containerRef} className="space-y-6">
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
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-6 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700" /> Horario nocturno
        </span>
      </div>

      {/* Timeline */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {/* Day labels row */}
        <div className="flex border-b border-zinc-100 dark:border-zinc-800">
          <div className="w-40 shrink-0 border-r border-zinc-100 px-3 py-1 dark:border-zinc-800" />
          <div className="relative" style={{ width: `${timelineWidth}px` }}>
            {dayLabels.map((d, i) => (
              <div
                key={i}
                className="absolute top-0 truncate px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
                style={{ left: `${d.offsetPx}px`, width: `${d.widthPx}px` }}
              >
                {d.label}
              </div>
            ))}
          </div>
        </div>

        {/* Hour scale header */}
        <div className="flex border-b border-zinc-100 dark:border-zinc-800">
          <div className="w-40 shrink-0 border-r border-zinc-100 px-3 py-2 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Impresora
          </div>
          <div className="relative" style={{ width: `${timelineWidth}px`, height: "28px" }}>
            {hourMarkers.map((m, i) => (
              <div
                key={i}
                className="absolute top-0 border-l border-zinc-100 px-1 py-2 text-[10px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500"
                style={{ left: `${m.offsetPx}px` }}
              >
                {m.label}
              </div>
            ))}
          </div>
        </div>

        {/* Printer rows */}
        {printersWithJobs.map((printer) => {
          const printerJobs = jobsByPrinter[printer.id] || [];
          const activeJobs = printerJobs.filter((j) => j.status !== "done");
          const totalWorkMin = activeJobs.reduce((s, j) => s + j.estimated_minutes, 0);

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
                  {totalWorkMin > 0 && ` · ~${formatMinutes(totalWorkMin)} trabajo`}
                </div>
              </div>

              {/* Jobs positioned absolutely on the timeline */}
              <div
                className="relative py-2"
                style={{ width: `${timelineWidth}px`, height: "48px" }}
              >
                {/* Dead zone bands */}
                {deadZones.map((z, i) => (
                  <div
                    key={`dz-${i}`}
                    className="absolute top-0 h-full bg-zinc-100 dark:bg-zinc-800/50"
                    style={{ left: `${z.leftPx}px`, width: `${z.widthPx}px` }}
                  />
                ))}

                {/* Job blocks */}
                {printerJobs.map((job) => {
                  const jobStart = job.scheduled_start
                    ? new Date(job.scheduled_start)
                    : origin;
                  const jobEnd = addRealMinutes(jobStart, job.estimated_minutes);

                  const leftMin = (jobStart.getTime() - origin.getTime()) / 60000;
                  const widthMin = (jobEnd.getTime() - jobStart.getTime()) / 60000;
                  const leftPx = Math.max(0, leftMin * pxPerMin);
                  const widthPx = Math.max(24, widthMin * pxPerMin);
                  const priorityRing = PRIORITY_RING[job.queue_priority ?? 0] ?? "";

                  return (
                    <div
                      key={job.id}
                      className={`absolute top-2 h-8 cursor-pointer rounded border ${STATUS_COLORS[job.status]} ${STATUS_BORDER[job.status]} ${priorityRing} transition-all ${hoveredJob === job.id ? "z-10 scale-y-125 brightness-110" : "z-[1]"}`}
                      style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
                      onMouseEnter={(e) => handleJobHover(job.id, e.currentTarget)}
                      onMouseLeave={handleJobLeave}
                    >
                      <span className="absolute inset-0 flex items-center justify-center overflow-hidden px-1 text-[10px] font-medium text-white">
                        {widthPx >= 80
                          ? `B${job.batch_number} · ${job.pieces_in_batch}pzs`
                          : `B${job.batch_number}`}
                      </span>
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

      {/* Tooltip via portal — renders above everything */}
      {hoveredJobData && hoveredRect && (
        <JobTooltip
          job={hoveredJobData}
          jobStart={hoveredJobData.scheduled_start ? new Date(hoveredJobData.scheduled_start) : origin}
          jobEnd={addRealMinutes(
            hoveredJobData.scheduled_start ? new Date(hoveredJobData.scheduled_start) : origin,
            hoveredJobData.estimated_minutes
          )}
          anchorRect={hoveredRect}
        />
      )}

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
