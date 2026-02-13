"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDraggable } from "@dnd-kit/react";
import type { Tables } from "@/lib/supabase/database.types";

export type ProjectItem = Pick<Tables<"project_items">, "id" | "name" | "quantity" | "completed">;

export type ProjectWithItems = Tables<"projects"> & {
  project_items?: ProjectItem[];
};

interface KanbanCardProps {
  project: ProjectWithItems;
}

function getDeadlineInfo(deadline: string | null): { label: string; days: number | null; colorClass: string } {
  if (!deadline) return { label: "", days: null, colorClass: "" };

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(deadline + "T00:00:00");
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const label = target.toLocaleDateString("es-ES", { day: "numeric", month: "short" });

  if (diff < 0) return { label, days: diff, colorClass: "bg-red-500/20 text-red-400 border-red-500/30" };
  if (diff < 2) return { label, days: diff, colorClass: "bg-red-500/20 text-red-400 border-red-500/30" };
  if (diff <= 5) return { label, days: diff, colorClass: "bg-orange-500/20 text-orange-400 border-orange-500/30" };
  if (diff <= 10) return { label, days: diff, colorClass: "bg-green-500/20 text-green-400 border-green-500/30" };
  return { label, days: diff, colorClass: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
}

export function KanbanCard({ project }: KanbanCardProps) {
  const router = useRouter();
  const [showTooltip, setShowTooltip] = useState(false);
  const { ref, isDragging } = useDraggable({
    id: project.id,
    data: { status: project.status },
  });

  const items = project.project_items ?? [];
  const deadline = getDeadlineInfo(project.deadline);

  return (
    <div
      ref={ref}
      onClick={() => {
        if (!isDragging) router.push(`/dashboard/projects/${project.id}`);
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      className={`relative cursor-grab rounded-lg border p-2.5 shadow-sm transition select-none ${
        deadline.colorClass
          ? `border-transparent ${deadline.colorClass}`
          : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
      } ${isDragging ? "z-50 cursor-grabbing scale-[1.02] opacity-75 shadow-lg" : ""}`}
    >
      {/* Compact view: name + deadline */}
      <div className="flex items-center justify-between gap-2">
        <h4 className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
          {project.client_name || project.name}
        </h4>
        {deadline.label && (
          <span className="shrink-0 text-[11px] font-medium">
            {deadline.label}
          </span>
        )}
      </div>

      {/* Hover tooltip with full info */}
      {showTooltip && !isDragging && (
        <div className="absolute top-full left-0 z-50 mt-1 w-72 rounded-lg border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
            {project.name}
          </h4>

          {project.client_name && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {project.client_name}
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
            {deadline.days !== null && (
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                {deadline.days < 0
                  ? `${Math.abs(deadline.days)}d atrasado`
                  : deadline.days === 0
                    ? "Hoy"
                    : `${deadline.days}d restantes`}
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
