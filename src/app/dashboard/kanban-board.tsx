"use client";

import { useState, useCallback, useEffect } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useDroppable } from "@dnd-kit/react";
import { COLUMNS, type ProjectStatus } from "@/lib/kanban-config";
import { KanbanColumn } from "./kanban-column";
import { updateProjectStatusById, discardProject } from "./projects/actions";
import type { ProjectWithItems } from "./kanban-card";

const MAX_DELIVERED = 6;

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

  // Prevent body scroll while dragging
  useEffect(() => {
    if (dragging) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [dragging]);

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
        discardProject(projectId).then((result) => {
          if (!result.success) {
            // Rollback on failure
            const project = initialProjects.find((p) => p.id === projectId);
            if (project) {
              setProjects((prev) => [...prev, project]);
            }
          }
        });
        return;
      }

      const newStatus = targetId as ProjectStatus;

      const project = projects.find((p) => p.id === projectId);
      if (!project || project.status === newStatus) return;

      if (!COLUMNS.some((col) => col.id === newStatus)) return;

      const previousStatus = project.status;

      // Optimistic update
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...p, status: newStatus } : p,
        ),
      );

      // Persist to database
      updateProjectStatusById(projectId, newStatus).then((result) => {
        if (!result.success) {
          setProjects((prev) =>
            prev.map((p) =>
              p.id === projectId ? { ...p, status: previousStatus } : p,
            ),
          );
        }
      });
    },
    [projects, initialProjects],
  );

  /** Get projects for a column, with FIFO limit for delivered */
  function getColumnProjects(columnId: ProjectStatus) {
    const columnProjects = projects.filter((p) => p.status === columnId);
    if (columnId === "delivered" && columnProjects.length > MAX_DELIVERED) {
      // Sort by created_at descending, keep only the newest
      return [...columnProjects]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, MAX_DELIVERED);
    }
    return columnProjects;
  }

  return (
    <DragDropProvider onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid min-h-0 flex-1 auto-cols-[280px] grid-flow-col gap-4 overflow-x-auto md:grid-cols-4 md:auto-cols-auto">
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
              <div key={column.id} className="grid min-h-0 grid-rows-2 gap-3">
                <KanbanColumn
                  className="min-h-0 overflow-hidden"
                  column={column}
                  projects={getColumnProjects(column.id)}
                />
                <KanbanColumn
                  className="min-h-0 overflow-hidden"
                  column={stackedColumn}
                  projects={getColumnProjects(stackedColumn.id)}
                />
              </div>
            );
          }

          return (
            <KanbanColumn
              key={column.id}
              column={column}
              projects={getColumnProjects(column.id)}
            />
          );
        })}
      </div>

      {/* Discard zone — fixed at viewport bottom, visible only while dragging */}
      {dragging && (
        <div className="fixed right-0 bottom-0 left-0 z-50 px-4 pb-4 md:left-64">
          <DiscardZone />
        </div>
      )}
    </DragDropProvider>
  );
}
