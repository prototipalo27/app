"use client";

import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

/* ── Types ── */

interface SourceItem {
  source: string;
  count: number;
  color: string;
}

interface CampaignItem {
  campaign: string;
  leads: number;
  won: number;
}

interface LeadAnalyticsProps {
  sourceDistribution: SourceItem[];
  leadsByDayAndSource: Record<string, string | number>[];
  campaignPerformance: CampaignItem[];
  totalLeads: number;
  sources: string[];
  sourceColors: Record<string, string>;
}

/* ── Range options ── */

const RANGES = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
] as const;

/* ── Custom tooltip for stacked area ── */

function AreaTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <p className="mb-1 font-semibold text-zinc-700 dark:text-zinc-200">{label}</p>
      {payload.map((p: any) =>
        p.value > 0 ? (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-zinc-600 dark:text-zinc-400">{p.dataKey}:</span>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">{p.value}</span>
          </div>
        ) : null
      )}
      <div className="mt-1 border-t border-zinc-100 pt-1 font-semibold text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
        Total: {total}
      </div>
    </div>
  );
}

/* ── Donut center label ── */

function DonutCenter({ total }: { total: number }) {
  return (
    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central">
      <tspan
        x="50%"
        dy="-0.3em"
        className="fill-zinc-900 text-2xl font-bold dark:fill-white"
        style={{ fontSize: 22, fontWeight: 700 }}
      >
        {total}
      </tspan>
      <tspan
        x="50%"
        dy="1.4em"
        className="fill-zinc-400 text-xs"
        style={{ fontSize: 11 }}
      >
        leads
      </tspan>
    </text>
  );
}

/* ── Main component ── */

export function LeadAnalytics({
  sourceDistribution,
  leadsByDayAndSource,
  campaignPerformance,
  totalLeads,
  sources,
  sourceColors,
}: LeadAnalyticsProps) {
  const [range, setRange] = useState<number>(30);

  // Filter time series by selected range
  const filteredTimeSeries = leadsByDayAndSource.slice(-range);

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
        Analytics de leads
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        {/* ── 1. Donut: Source distribution ── */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">
            Fuentes de tráfico
          </h3>
          {sourceDistribution.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">Sin datos de UTM todavía</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-48 flex-shrink-0">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={sourceDistribution}
                      dataKey="count"
                      nameKey="source"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {sourceDistribution.map((entry) => (
                        <Cell key={entry.source} fill={entry.color} />
                      ))}
                    </Pie>
                    <DonutCenter total={totalLeads} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5">
                {sourceDistribution.map((s) => (
                  <div key={s.source} className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="flex-1 truncate text-xs text-zinc-600 dark:text-zinc-400">
                      {s.source}
                    </span>
                    <span className="text-xs font-medium tabular-nums text-zinc-700 dark:text-zinc-300">
                      {s.count}
                    </span>
                    <span className="w-10 text-right text-[10px] tabular-nums text-zinc-400">
                      {totalLeads > 0 ? Math.round((s.count / totalLeads) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 2. Stacked Area: Leads by day + source ── */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Leads por día
            </h3>
            <div className="flex gap-1">
              {RANGES.map((r) => (
                <button
                  key={r.days}
                  onClick={() => setRange(r.days)}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    range === r.days
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          {filteredTimeSeries.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">Sin datos todavía</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={filteredTimeSeries}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={24}
                  allowDecimals={false}
                />
                <Tooltip content={<AreaTooltip />} />
                {sources.map((src) => (
                  <Area
                    key={src}
                    type="monotone"
                    dataKey={src}
                    stackId="1"
                    stroke={sourceColors[src] || "#a1a1aa"}
                    fill={sourceColors[src] || "#a1a1aa"}
                    fillOpacity={0.6}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── 3. Campaign performance table ── */}
      {campaignPerformance.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">
            Rendimiento de campañas
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="pb-2 font-medium text-zinc-500 dark:text-zinc-400">Campaña</th>
                  <th className="pb-2 text-right font-medium text-zinc-500 dark:text-zinc-400">Leads</th>
                  <th className="pb-2 text-right font-medium text-zinc-500 dark:text-zinc-400">Ganados</th>
                  <th className="pb-2 text-right font-medium text-zinc-500 dark:text-zinc-400">Conversión</th>
                </tr>
              </thead>
              <tbody>
                {campaignPerformance.map((c) => {
                  const rate = c.leads > 0 ? Math.round((c.won / c.leads) * 100) : 0;
                  return (
                    <tr
                      key={c.campaign}
                      className="border-b border-zinc-50 last:border-0 dark:border-zinc-800/50"
                    >
                      <td className="py-2 font-medium text-zinc-700 dark:text-zinc-300">
                        {c.campaign}
                      </td>
                      <td className="py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                        {c.leads}
                      </td>
                      <td className="py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                        {c.won}
                      </td>
                      <td className="py-2 text-right">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            rate >= 20
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : rate >= 10
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
