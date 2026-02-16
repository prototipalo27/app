"use client";

import { useState } from "react";

interface LeadsChartProps {
  data: { date: string; count: number }[];
}

export function LeadsChart({ data }: LeadsChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((s, d) => s + d.count, 0);
  const barWidth = 100 / data.length;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Leads por dia
        </h3>
        <span className="text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
          {total} leads ({data.length} dias)
        </span>
      </div>

      <div className="relative">
        {/* Tooltip */}
        {hoveredIdx !== null && (
          <div
            className="pointer-events-none absolute -top-8 z-10 rounded bg-zinc-800 px-2 py-1 text-xs text-white shadow dark:bg-zinc-200 dark:text-zinc-900"
            style={{
              left: `${(hoveredIdx + 0.5) * barWidth}%`,
              transform: "translateX(-50%)",
            }}
          >
            {formatDateShort(data[hoveredIdx].date)}: {data[hoveredIdx].count}
          </div>
        )}

        {/* Chart */}
        <svg
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          className="h-28 w-full"
        >
          {data.map((d, i) => {
            const h = (d.count / max) * 36;
            const isHovered = hoveredIdx === i;
            return (
              <rect
                key={d.date}
                x={i * barWidth + barWidth * 0.15}
                y={40 - h}
                width={barWidth * 0.7}
                height={Math.max(h, 0.5)}
                rx={0.5}
                className={
                  isHovered
                    ? "fill-brand"
                    : d.count === 0
                      ? "fill-zinc-200 dark:fill-zinc-700"
                      : "fill-brand/60 dark:fill-brand/50"
                }
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
        </svg>

        {/* X-axis labels (every 7 days) */}
        <div className="mt-1 flex justify-between text-[10px] text-zinc-400 dark:text-zinc-500">
          {data
            .filter((_, i) => i % 7 === 0 || i === data.length - 1)
            .map((d) => (
              <span key={d.date}>{formatDateShort(d.date)}</span>
            ))}
        </div>
      </div>
    </div>
  );
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}
