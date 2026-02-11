"use client";

import { useState, useCallback } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { COLUMNS, type ProjectStatus } from "@/lib/kanban-config";
import { KanbanColumn } from "./kanban-column";
import { updateProjectStatusById } from "./projects/actions";
import type { ProjectWithItems } from "./kanban-card";

interface KanbanBoardProps {
  initialProjects: ProjectWithItems[];
}

export function KanbanBoard({ initialProjects }: KanbanBoardProps) {
  const [projects, setProjects] = useState(initialProjects);

  const handleDragEnd = useCallback(
    (event: { operation: { source: { id: string | number } | null; target: { id: string | number } | null } }) => {
      const { source, target } = event.operation;

      if (!source || !target) return;

      const projectId = String(source.id);
      const newStatus = String(target.id) as ProjectStatus;

      // Find the project's current status
      const project = projects.find((p) => p.id === projectId);
      if (!project || project.status === newStatus) return;

      // Verify the drop target is a valid column
      if (!COLUMNS.some((col) => col.id === newStatus)) return;

      const previousStatus = project.status;

      // Optimistic update
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...p, status: newStatus } : p,
        ),
      );

      // Persist to database
      updateProjectStatusById(projectId, newStatus).catch(() => {
        // Revert on error
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projectId ? { ...p, status: previousStatus } : p,
          ),
        );
      });
    },
    [projects],
  );

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
      <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            projects={projects.filter((p) => p.status === column.id)}
          />
        ))}
      </div>
    </DragDropProvider>
  );
}
