"use client";

import type { Tables } from "@/lib/supabase/database.types";

type Printer = Tables<"printers">;

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

function TempRow({ label, current, target }: { label: string; current: number | null; target?: number | null }) {
  if (current === null) return null;
  return (
    <div className="flex justify-between text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="font-mono text-zinc-900 dark:text-zinc-100">
        {current.toFixed(0)}°C
        {target !== null && target !== undefined && (
          <span className="text-zinc-400 dark:text-zinc-500"> / {target.toFixed(0)}°C</span>
        )}
      </span>
    </div>
  );
}

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatRemaining(minutes: number | null) {
  if (minutes === null) return null;
  if (minutes < 60) return `${minutes}m left`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m left`;
}

export default function PrinterCard({ printer }: { printer: Printer }) {
  const isOffline = !printer.online;
  const isRunning = printer.gcode_state === "RUNNING";

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        isOffline
          ? "border-zinc-200 bg-zinc-50 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/50"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-white">{printer.name}</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {printer.model} · {printer.serial_number}
          </p>
        </div>
        <StateBadge state={isOffline ? null : printer.gcode_state} />
      </div>

      {/* Progress section (only when printing) */}
      {isRunning && printer.current_file && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="truncate text-zinc-700 dark:text-zinc-300">{printer.current_file}</span>
            <span className="ml-2 font-mono text-zinc-900 dark:text-zinc-100">{printer.print_percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-500"
              style={{ width: `${printer.print_percent}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>
              {printer.layer_current !== null && printer.layer_total !== null
                ? `Layer ${printer.layer_current}/${printer.layer_total}`
                : ""}
            </span>
            <span>{formatRemaining(printer.remaining_minutes)}</span>
          </div>
        </div>
      )}

      {/* Temperatures */}
      {!isOffline && (
        <div className="mb-3 space-y-1">
          <TempRow label="Nozzle" current={printer.nozzle_temp} target={printer.nozzle_target} />
          <TempRow label="Bed" current={printer.bed_temp} target={printer.bed_target} />
          <TempRow label="Chamber" current={printer.chamber_temp} />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-zinc-100 pt-2 dark:border-zinc-800">
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {printer.last_sync_at ? `Synced ${formatTime(printer.last_sync_at)}` : "Never synced"}
        </span>
        {!isOffline && printer.mqtt_connected && (
          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
            MQTT
          </span>
        )}
        {isOffline && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">Offline</span>
        )}
      </div>
    </div>
  );
}
