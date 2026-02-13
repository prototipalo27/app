"use client";

import { useState, useCallback } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useDroppable } from "@dnd-kit/react";
import { COLUMNS, type ProjectStatus } from "@/lib/kanban-config";
import { KanbanColumn } from "./kanban-column";
import { updateProjectStatusById, discardProject } from "./projects/actions";
import type { ProjectWithItems } from "./kanban-card";

interface KanbanBoardProps {
  initialProjects: ProjectWithItems[];
}

function DiscardZone() {
  const { ref, isDropTarget } = useDroppable({ id: "discard" });

  return (
    <div
      ref={ref}
      className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-3 transition-colors ${
        isDropTarget
          ? "border-red-500 bg-red-500/10 text-red-500"
          : "border-zinc-300 bg-zinc-50 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500"
      }`}
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      <span className="text-sm font-medium">
        {isDropTarget ? "Soltar para descartar" : "Arrastra aqui para descartar"}
      </span>
    </div>
  );
}

export function KanbanBoard({ initialProjects }: KanbanBoardProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [dragging, setDragging] = useState(false);

  const handleDragStart = useCallback(() => {
    setDragging(true);
  }, []);

  const handleDragEnd = useCallback(
    (event: { operation: { source: { id: string | number } | null; target: { id: string | number } | null } }) => {
      setDragging(false);
      const { source, target } = event.operation;

      if (!source || !target) return;

      const projectId = String(source.id);
      const targetId = String(target.id);

      // Handle discard drop
      if (targetId === "discard") {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
        discardProject(projectId).catch(() => {
          // Revert: re-add the project
          const project = initialProjects.find((p) => p.id === projectId);
          if (project) {
            setProjects((prev) => [...prev, project]);
          }
        });
        return;
      }

      const newStatus = targetId as ProjectStatus;

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
    [projects, initialProjects],
  );

  return (
    <DragDropProvider onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid min-h-0 flex-1 auto-cols-[280px] grid-flow-col gap-4 overflow-x-auto pb-4 md:grid-cols-4 md:auto-cols-auto">
        {COLUMNS.map((column) => {
          // These are rendered as the bottom half of a stacked pair
          if (column.id === "printing" || column.id === "qc" || column.id === "delivered") return null;

          const stackedId =
            column.id === "design"
              ? "printing"
              : column.id === "post_processing"
                ? "qc"
                : column.id === "shipping"
                  ? "delivered"
                  : null;

          const stackedColumn = stackedId
            ? COLUMNS.find((c) => c.id === stackedId)
            : null;

          if (stackedColumn) {
            return (
              <div key={column.id} className="flex min-h-0 flex-col gap-3">
                <KanbanColumn
                  className="min-h-0 flex-1"
                  column={column}
                  projects={projects.filter((p) => p.status === column.id)}
                />
                <KanbanColumn
                  className="min-h-0 flex-1"
                  column={stackedColumn}
                  projects={projects.filter((p) => p.status === stackedColumn.id)}
                />
              </div>
            );
          }

          return (
            <KanbanColumn
              key={column.id}
              column={column}
              projects={projects.filter((p) => p.status === column.id)}
            />
          );
        })}
      </div>

      {/* Discard zone — fixed at viewport bottom, visible only while dragging */}
      <div
        className={`fixed right-0 bottom-0 left-0 z-50 px-4 pb-4 transition-all duration-200 md:left-64 ${
          dragging
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-full opacity-0"
        }`}
      >
        <DiscardZone />
      </div>
    </DragDropProvider>
  );
}
