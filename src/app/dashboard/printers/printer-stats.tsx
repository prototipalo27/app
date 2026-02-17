"use client";

import { useState, useMemo } from "react";

const PRINTER_COLORS = [
  "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1",
  "#84cc16", "#e11d48", "#0ea5e9", "#a855f7", "#d97706",
  "#10b981", "#f43f5e", "#7c3aed",
];

interface DailyStat {
  printer_id: string;
  printer_name: string;
  date: string;
  printing_seconds: number;
}

interface PrinterStatsProps {
  stats: DailyStat[];
  workDayMinutes: number;
}

type Range = 7 | 14 | 30;

export function PrinterStats({ stats, workDayMinutes }: PrinterStatsProps) {
  const [range, setRange] = useState<Range>(7);

  const { printerNames, printerColorMap, days, dayTotals, maxHours, kpis } =
    useMemo(() => {
      // Filter to selected range
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - range);
      const cutoffStr = cutoff.toISOString().slice(0, 10);

      const filtered = stats.filter((s) => s.date >= cutoffStr);

      // Unique printer names sorted
      const nameSet = new Set(filtered.map((s) => s.printer_name));
      const printerNames = [...nameSet].sort();
      const printerColorMap = new Map(
        printerNames.map((name, i) => [name, PRINTER_COLORS[i % PRINTER_COLORS.length]])
      );

      // Build day list
      const daySet = new Set(filtered.map((s) => s.date));
      const days = [...daySet].sort();

      // Group by day → printer → seconds
      const byDay = new Map<string, Map<string, number>>();
      for (const s of filtered) {
        if (!byDay.has(s.date)) byDay.set(s.date, new Map());
        const dayMap = byDay.get(s.date)!;
        dayMap.set(s.printer_name, (dayMap.get(s.printer_name) ?? 0) + s.printing_seconds);
      }

      // Compute totals per day (in hours)
      const dayTotals = days.map((day) => {
        const dayMap = byDay.get(day) ?? new Map();
        const segments = printerNames.map((name) => ({
          name,
          hours: (dayMap.get(name) ?? 0) / 3600,
        }));
        const total = segments.reduce((s, seg) => s + seg.hours, 0);
        return { day, segments, total };
      });

      const maxHours = Math.max(...dayTotals.map((d) => d.total), 1);

      // KPIs
      const totalSeconds = filtered.reduce((s, r) => s + r.printing_seconds, 0);
      const totalHours = totalSeconds / 3600;
      const avgDaily = days.length > 0 ? totalHours / days.length : 0;

      // Most active printer
      const byPrinter = new Map<string, number>();
      for (const s of filtered) {
        byPrinter.set(s.printer_name, (byPrinter.get(s.printer_name) ?? 0) + s.printing_seconds);
      }
      let mostActive = "-";
      let mostActiveHours = 0;
      for (const [name, secs] of byPrinter) {
        if (secs > mostActiveHours) {
          mostActive = name;
          mostActiveHours = secs;
        }
      }

      // Occupation % vs office hours
      // Total available = printerNames.length * workDayMinutes * days.length (in seconds)
      const totalAvailableSeconds = printerNames.length * workDayMinutes * 60 * (days.length || 1);
      const occupationPct = totalAvailableSeconds > 0
        ? (totalSeconds / totalAvailableSeconds) * 100
        : 0;

      return {
        printerNames,
        printerColorMap,
        days,
        dayTotals,
        maxHours,
        kpis: {
          totalHours,
          avgDaily,
          mostActive,
          mostActiveHours: mostActiveHours / 3600,
          occupationPct,
        },
      };
    }, [stats, range, workDayMinutes]);

  const barWidth = days.length > 0 ? 100 / days.length : 100;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Horas de impresion por dia
        </h3>
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
          {([7, 14, 30] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                range === r
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total horas" value={kpis.totalHours.toFixed(1)} unit="h" />
        <KpiCard label="Media diaria" value={kpis.avgDaily.toFixed(1)} unit="h" />
        <KpiCard label="Mas activa" value={kpis.mostActive} sub={`${kpis.mostActiveHours.toFixed(1)}h`} />
        <KpiCard label="Ocupacion" value={kpis.occupationPct.toFixed(1)} unit="%" />
      </div>

      {/* Stacked Bar Chart */}
      {days.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
          Sin datos en este periodo
        </p>
      ) : (
        <StackedChart
          dayTotals={dayTotals}
          maxHours={maxHours}
          barWidth={barWidth}
          printerColorMap={printerColorMap}
        />
      )}

      {/* Legend */}
      {printerNames.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {printerNames.map((name) => (
            <div key={name} className="flex items-center gap-1">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: printerColorMap.get(name) }}
              />
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/50">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold tabular-nums text-zinc-900 dark:text-white">
        {value}
        {unit && <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500"> {unit}</span>}
      </p>
      {sub && (
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{sub}</p>
      )}
    </div>
  );
}

function StackedChart({
  dayTotals,
  maxHours,
  barWidth,
  printerColorMap,
}: {
  dayTotals: Array<{
    day: string;
    segments: Array<{ name: string; hours: number }>;
    total: number;
  }>;
  maxHours: number;
  barWidth: number;
  printerColorMap: Map<string, string>;
}) {
  const [tooltip, setTooltip] = useState<{
    idx: number;
    x: number;
    y: number;
  } | null>(null);

  const chartHeight = 40;
  const yScale = (chartHeight - 4) / maxHours; // leave room at top

  return (
    <div className="relative">
      {/* Tooltip */}
      {tooltip !== null && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
          style={{
            left: `${tooltip.x}%`,
            top: -8,
            transform: "translateX(-50%) translateY(-100%)",
          }}
        >
          <p className="mb-1 font-semibold text-zinc-700 dark:text-zinc-200">
            {formatDateShort(dayTotals[tooltip.idx].day)}
          </p>
          {dayTotals[tooltip.idx].segments
            .filter((s) => s.hours > 0)
            .sort((a, b) => b.hours - a.hours)
            .map((s) => (
              <div key={s.name} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1">
                  <span
                    className="inline-block h-2 w-2 rounded-sm"
                    style={{ backgroundColor: printerColorMap.get(s.name) }}
                  />
                  <span className="text-zinc-600 dark:text-zinc-300">{s.name}</span>
                </div>
                <span className="tabular-nums text-zinc-900 dark:text-white">
                  {s.hours.toFixed(1)}h
                </span>
              </div>
            ))}
          <div className="mt-1 border-t border-zinc-100 pt-1 dark:border-zinc-700">
            <div className="flex justify-between font-semibold">
              <span className="text-zinc-600 dark:text-zinc-300">Total</span>
              <span className="tabular-nums text-zinc-900 dark:text-white">
                {dayTotals[tooltip.idx].total.toFixed(1)}h
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SVG Chart */}
      <svg
        viewBox={`0 0 100 ${chartHeight}`}
        preserveAspectRatio="none"
        className="h-36 w-full"
      >
        {dayTotals.map((day, i) => {
          let yOffset = 0;
          return (
            <g key={day.day}>
              {/* Invisible full-height rect for hover */}
              <rect
                x={i * barWidth}
                y={0}
                width={barWidth}
                height={chartHeight}
                fill="transparent"
                onMouseEnter={() =>
                  setTooltip({
                    idx: i,
                    x: (i + 0.5) * barWidth,
                    y: 0,
                  })
                }
                onMouseLeave={() => setTooltip(null)}
              />
              {day.segments.map((seg) => {
                if (seg.hours === 0) return null;
                const h = seg.hours * yScale;
                const y = chartHeight - yOffset - h;
                yOffset += h;
                return (
                  <rect
                    key={seg.name}
                    x={i * barWidth + barWidth * 0.1}
                    y={y}
                    width={barWidth * 0.8}
                    height={h}
                    rx={0.3}
                    fill={printerColorMap.get(seg.name)}
                    className="pointer-events-none"
                    opacity={tooltip !== null && tooltip.idx !== i ? 0.4 : 1}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* X-axis labels */}
      <div className="mt-1 flex justify-between text-[10px] text-zinc-400 dark:text-zinc-500">
        {dayTotals
          .filter(
            (_, i) =>
              i === 0 ||
              i === dayTotals.length - 1 ||
              i % Math.max(1, Math.floor(dayTotals.length / 5)) === 0
          )
          .map((d) => (
            <span key={d.day}>{formatDateShort(d.day)}</span>
          ))}
      </div>
    </div>
  );
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}
