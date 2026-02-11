"use client";

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

export function KanbanCard({ project }: KanbanCardProps) {
  const router = useRouter();
  const { ref, isDragging } = useDraggable({
    id: project.id,
    data: { status: project.status },
  });

  const items = project.project_items ?? [];

  return (
    <div
      ref={ref}
      onClick={() => {
        if (!isDragging) router.push(`/dashboard/projects/${project.id}`);
      }}
      className={`cursor-grab rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition select-none dark:border-zinc-700 dark:bg-zinc-800 ${
        isDragging
          ? "z-50 cursor-grabbing scale-[1.02] opacity-75 shadow-lg"
          : ""
      }`}
    >
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
            {Number(project.price).toFixed(2)}
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
  );
}
