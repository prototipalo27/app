"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/crm-config";
import { tagClasses } from "../crm-card";

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  email_sent: "Email enviado",
  email_received: "Email recibido",
  note: "Nota",
  call: "Llamada",
  status_change: "Cambio estado",
  email_scheduled: "Email programado",
};

interface TimelineLead {
  id: string;
  full_name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  estimated_value: number | null;
  project_type_tag: string | null;
  created_at: string;
  assignee_name: string | null;
  last_activity_at: string | null;
  last_activity_type: string | null;
}

type UrgencyGroup = "critical" | "warning" | "ok" | "fresh";

function getUrgencyGroup(daysSinceInteraction: number): UrgencyGroup {
  if (daysSinceInteraction >= 7) return "critical";
  if (daysSinceInteraction >= 3) return "warning";
  if (daysSinceInteraction >= 1) return "ok";
  return "fresh";
}

const URGENCY_CONFIG: Record<UrgencyGroup, {
  label: string;
  subtitle: string;
  dotColor: string;
  barColor: string;
  bgColor: string;
  borderColor: string;
}> = {
  critical: {
    label: "Buscar el no",
    subtitle: "7+ días sin interacción — limpiar el funnel",
    dotColor: "bg-red-500",
    barColor: "bg-red-500",
    bgColor: "bg-red-50 dark:bg-red-950/20",
    borderColor: "border-red-200 dark:border-red-900/40",
  },
  warning: {
    label: "Enviar reminder",
    subtitle: "3-7 días — friendly reminder",
    dotColor: "bg-amber-500",
    barColor: "bg-amber-500",
    bgColor: "bg-amber-50 dark:bg-amber-950/20",
    borderColor: "border-amber-200 dark:border-amber-900/40",
  },
  ok: {
    label: "En seguimiento",
    subtitle: "1-3 días — todo bien",
    dotColor: "bg-blue-500",
    barColor: "bg-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
    borderColor: "border-blue-200 dark:border-blue-900/40",
  },
  fresh: {
    label: "Al día",
    subtitle: "< 24h desde última interacción",
    dotColor: "bg-green-500",
    barColor: "bg-green-500",
    bgColor: "bg-green-50 dark:bg-green-950/20",
    borderColor: "border-green-200 dark:border-green-900/40",
  },
};

function daysSince(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / 86_400_000;
}

function formatDays(days: number): string {
  if (days < 1) {
    const hours = Math.floor(days * 24);
    return hours <= 0 ? "ahora" : `${hours}h`;
  }
  return `${Math.floor(days)}d`;
}

export function TimelineView({ leads }: { leads: TimelineLead[] }) {
  // Calculate days since last interaction for each lead
  const leadsWithDays = leads.map((l) => {
    const interactionDate = l.last_activity_at || l.created_at;
    const days = daysSince(interactionDate);
    const group = getUrgencyGroup(days);
    return { ...l, daysSinceInteraction: days, urgencyGroup: group, interactionDate };
  });

  // Sort by most stale first
  leadsWithDays.sort((a, b) => b.daysSinceInteraction - a.daysSinceInteraction);

  // Group
  const groups: Record<UrgencyGroup, typeof leadsWithDays> = {
    critical: [],
    warning: [],
    ok: [],
    fresh: [],
  };
  for (const l of leadsWithDays) {
    groups[l.urgencyGroup].push(l);
  }

  const maxDays = Math.max(...leadsWithDays.map((l) => l.daysSinceInteraction), 1);

  // Stats
  const totalActive = leadsWithDays.length;
  const needsAction = groups.critical.length + groups.warning.length;

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center dark:border-red-900/40 dark:bg-red-950/20">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{groups.critical.length}</p>
          <p className="text-xs text-red-600/70 dark:text-red-400/70">Buscar el no</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{groups.warning.length}</p>
          <p className="text-xs text-amber-600/70 dark:text-amber-400/70">Enviar reminder</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center dark:border-blue-900/40 dark:bg-blue-950/20">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{groups.ok.length}</p>
          <p className="text-xs text-blue-600/70 dark:text-blue-400/70">En seguimiento</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center dark:border-green-900/40 dark:bg-green-950/20">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{groups.fresh.length}</p>
          <p className="text-xs text-green-600/70 dark:text-green-400/70">Al día</p>
        </div>
      </div>

      {/* Progress bar overall */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">
            {totalActive} leads activos — <span className={needsAction > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>{needsAction} necesitan acción</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {totalActive - needsAction} al día
          </p>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-muted">
          {(["critical", "warning", "ok", "fresh"] as UrgencyGroup[]).map((g) => {
            const pct = totalActive > 0 ? (groups[g].length / totalActive) * 100 : 0;
            if (pct === 0) return null;
            return (
              <div
                key={g}
                className={`${URGENCY_CONFIG[g].barColor} transition-all`}
                style={{ width: `${pct}%` }}
                title={`${URGENCY_CONFIG[g].label}: ${groups[g].length}`}
              />
            );
          })}
        </div>
      </div>

      {/* Groups */}
      {(["critical", "warning", "ok", "fresh"] as UrgencyGroup[]).map((groupKey) => {
        const groupLeads = groups[groupKey];
        if (groupLeads.length === 0) return null;
        const config = URGENCY_CONFIG[groupKey];

        return (
          <div key={groupKey} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${config.dotColor}`} />
              <h2 className="text-sm font-semibold text-foreground">{config.label}</h2>
              <span className="text-xs text-muted-foreground">({groupLeads.length})</span>
              <span className="text-xs text-muted-foreground">— {config.subtitle}</span>
            </div>

            <div className="space-y-1">
              {groupLeads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/dashboard/crm/${lead.id}?from=tracker`}
                  className={`flex items-center gap-3 rounded-lg border ${config.borderColor} ${config.bgColor} px-4 py-3 transition-colors hover:opacity-80`}
                >
                  {/* Bar visual */}
                  <div className="hidden w-20 shrink-0 sm:block">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${config.barColor} transition-all`}
                        style={{ width: `${Math.min((lead.daysSinceInteraction / maxDays) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Days */}
                  <span className={`w-10 shrink-0 text-right text-sm font-bold tabular-nums ${
                    groupKey === "critical" ? "text-red-600 dark:text-red-400" :
                    groupKey === "warning" ? "text-amber-600 dark:text-amber-400" :
                    groupKey === "ok" ? "text-blue-600 dark:text-blue-400" :
                    "text-green-600 dark:text-green-400"
                  }`}>
                    {formatDays(lead.daysSinceInteraction)}
                  </span>

                  {/* Lead info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {lead.full_name}
                      </span>
                      {lead.project_type_tag && (
                        <Badge variant="secondary" className={`text-[10px] ${tagClasses(lead.project_type_tag)}`}>
                          {lead.project_type_tag}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px]">
                        {STATUS_LABELS[lead.status as keyof typeof STATUS_LABELS] || lead.status}
                      </Badge>
                    </div>
                    {lead.company && (
                      <span className="text-xs text-muted-foreground">{lead.company}</span>
                    )}
                  </div>

                  {/* Last activity type */}
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    {lead.last_activity_type
                      ? ACTIVITY_TYPE_LABELS[lead.last_activity_type] || lead.last_activity_type
                      : "Sin actividad"}
                  </span>

                  {/* Assignee */}
                  {lead.assignee_name && (
                    <span className="hidden shrink-0 items-center gap-1 sm:flex">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                        {lead.assignee_name[0].toUpperCase()}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{lead.assignee_name}</span>
                    </span>
                  )}

                  {/* Value */}
                  {lead.estimated_value != null && (
                    <Badge variant="secondary" className="shrink-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      {lead.estimated_value.toLocaleString("es-ES")} €
                    </Badge>
                  )}

                  {/* Arrow */}
                  <svg className="h-4 w-4 shrink-0 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        );
      })}

      {leadsWithDays.length === 0 && (
        <div className="rounded-xl border bg-card py-12 text-center">
          <p className="text-muted-foreground">No hay leads activos</p>
        </div>
      )}
    </div>
  );
}
