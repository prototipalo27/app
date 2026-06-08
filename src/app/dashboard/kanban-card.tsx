"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDraggable } from "@dnd-kit/react";
import type { Tables } from "@/lib/supabase/database.types";
import { formatDayMonth } from "@/lib/dates";

export type ProjectItem = Pick<Tables<"project_items">, "id" | "name" | "quantity" | "completed">;

export type ProjectWithItems = Tables<"projects"> & {
  project_items?: ProjectItem[];
};

interface KanbanCardProps {
  project: ProjectWithItems;
  invoiceDocNumber?: string;
  projectManagerName?: string;
  city?: string;
  pickup?: boolean;
}

function getDeadlineInfo(deadline: string | null): { label: string; days: number | null; colorClass: string } {
  if (!deadline) return { label: "", days: null, colorClass: "" };

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(deadline + "T00:00:00");
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const label = formatDayMonth(target);

  if (diff < 0) return { label, days: diff, colorClass: "bg-red-500/20 text-red-400 border-red-500/30" };
  if (diff < 2) return { label, days: diff, colorClass: "bg-red-500/20 text-red-400 border-red-500/30" };
  if (diff <= 5) return { label, days: diff, colorClass: "bg-orange-500/20 text-orange-400 border-orange-500/30" };
  if (diff <= 10) return { label, days: diff, colorClass: "bg-green-500/20 text-green-400 border-green-500/30" };
  return { label, days: diff, colorClass: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
}

export function KanbanCard({ project, invoiceDocNumber, projectManagerName, city, pickup }: KanbanCardProps) {
  const router = useRouter();
  const [showTooltip, setShowTooltip] = useState(false);
  const { ref, isDragging } = useDraggable({
    id: project.id,
    data: { status: project.status },
  });

  const items = project.project_items ?? [];
  const preInfo = getDeadlineInfo(project.pre_delivery_date);
  const finalInfo = getDeadlineInfo(project.deadline);
  // El color de urgencia lo marca el hito más próximo (pre-entrega o final).
  const nearest = [preInfo, finalInfo]
    .filter((i) => i.days !== null)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))[0];
  const cardColor = nearest?.colorClass ?? "";

  return (
    <div
      ref={ref}
      onClick={() => {
        if (!isDragging) router.push(`/dashboard/projects/${project.id}`);
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      className={`relative cursor-grab rounded-lg border p-2.5 shadow-sm transition select-none ${
        cardColor
          ? `border-transparent ${cardColor}`
          : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
      } ${isDragging ? "z-50 cursor-grabbing scale-[1.02] opacity-75 shadow-lg" : ""}`}
    >
      {/* Compact view: name + fechas (pre-entrega / entrega final) */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
          {project.client_name || project.name}
        </h4>
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-[11px] font-medium leading-tight">
          {preInfo.label && (
            <span className="text-zinc-500 dark:text-zinc-400">Pre {preInfo.label}</span>
          )}
          {finalInfo.label && (
            <span
              className={project.deadline_is_hard ? "font-bold text-red-500 dark:text-red-400" : ""}
              title={project.deadline_is_hard ? "Entrega final — compromiso firme / evento" : "Entrega final"}
            >
              {project.deadline_is_hard ? "★ " : ""}{finalInfo.label}
            </span>
          )}
        </div>
      </div>
      {pickup ? (
        <div className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
          <svg className="h-2.5 w-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18l-2 5H5L3 7zM3 7l-1-3M8 21a1 1 0 100-2 1 1 0 000 2zm9 0a1 1 0 100-2 1 1 0 000 2z" />
          </svg>
          <span>Local · recogida</span>
        </div>
      ) : city ? (
        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
          <svg className="h-2.5 w-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="truncate">{city}</span>
        </div>
      ) : null}

      {/* Hover tooltip with full info */}
      {showTooltip && !isDragging && (
        <div className="absolute top-full left-0 z-50 mt-1 w-64 md:w-72 rounded-lg border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
            {project.name}
          </h4>

          {project.client_name && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {project.client_name}
            </p>
          )}
          {projectManagerName && (
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-medium">PM:</span> {projectManagerName}
            </p>
          )}
          {invoiceDocNumber && (
            <p className="mt-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
              {invoiceDocNumber}
            </p>
          )}

          <div className="mt-2 flex flex-wrap gap-1.5">
            {project.material && (
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                {project.material}
              </span>
            )}
            {project.price !== null && (
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                {Number(project.price).toFixed(2)} €
              </span>
            )}
            {nearest?.days != null && (
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                {nearest.days < 0
                  ? `${Math.abs(nearest.days)}d atrasado`
                  : nearest.days === 0
                    ? "Hoy"
                    : `${nearest.days}d restantes`}
              </span>
            )}
          </div>

          {items.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {items.map((item) => {
                const isComplete = item.completed === item.quantity;
                return (
                  <div
                    key={item.id}
                    className={`text-[11px] ${isComplete ? "text-green-600 dark:text-green-400" : "text-zinc-500 dark:text-zinc-400"}`}
                  >
                    {isComplete ? "✓ " : ""}{item.completed}/{item.quantity} {item.name}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
