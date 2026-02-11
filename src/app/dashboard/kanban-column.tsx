"use client";

import { useDroppable } from "@dnd-kit/react";
import { KanbanCard } from "./kanban-card";
import type { ProjectWithItems } from "./kanban-card";
import type { COLUMNS } from "@/lib/kanban-config";

interface KanbanColumnProps {
  column: (typeof COLUMNS)[number];
  projects: ProjectWithItems[];
}

export function KanbanColumn({ column, projects }: KanbanColumnProps) {
  const { ref, isDropTarget } = useDroppable({ id: column.id });

  return (
    <div className="flex w-70 shrink-0 flex-col rounded-xl bg-zinc-100 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className={`h-2.5 w-2.5 rounded-full ${column.accent}`} />
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          {column.label}
        </h3>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${column.badge}`}
        >
          {projects.length}
        </span>
      </div>

      {/* Cards area */}
      <div
        ref={ref}
        className={`flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2 transition-colors ${
          isDropTarget
            ? "rounded-b-xl ring-2 ring-green-500/50 ring-inset"
            : ""
        }`}
      >
        {projects.map((project) => (
          <KanbanCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
