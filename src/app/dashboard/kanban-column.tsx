"use client";

import { useDroppable } from "@dnd-kit/react";
import { KanbanCard } from "./kanban-card";
import type { ProjectWithItems } from "./kanban-card";
import type { COLUMNS } from "@/lib/kanban-config";

interface KanbanColumnProps {
  column: (typeof COLUMNS)[number];
  projects: ProjectWithItems[];
  className?: string;
  responsibles?: string[];
}

export function KanbanColumn({ column, projects, className, responsibles }: KanbanColumnProps) {
  const { ref, isDropTarget } = useDroppable({ id: column.id });

  return (
    <div className={`flex min-w-0 flex-col rounded-xl bg-zinc-100 dark:bg-zinc-900 ${className ?? ""}`}>
      {/* Header */}
      <div className="shrink-0 px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${column.accent}`} />
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            {column.label}
          </h3>
          {responsibles && responsibles.length > 0 && responsibles.map((name) => (
            <span
              key={name}
              className="rounded-md bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
            >
              {name}
            </span>
          ))}
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${column.badge}`}
          >
            {projects.length}
          </span>
        </div>
      </div>

      {/* Cards area — scrolls internally */}
      <div
        ref={ref}
        className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 transition-colors ${
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
