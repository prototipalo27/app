"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { DragDropProvider } from "@dnd-kit/react";
import { useDroppable } from "@dnd-kit/react";
import { COLUMNS, type ProjectStatus } from "@/lib/kanban-config";
import { KanbanColumn } from "./kanban-column";
import { updateProjectStatusById, discardProject } from "./projects/actions";
import { sendProjectToStudio } from "./studio/actions";
import type { ProjectWithItems } from "./kanban-card";

const MAX_DELIVERED = 6;

interface KanbanBoardProps {
  initialProjects: ProjectWithItems[];
  zoneResponsibles?: Record<string, string[]>;
  invoiceDocNumbers?: Record<string, string>;
  pmNames?: Record<string, string>;
  cityByProject?: Record<string, string>;
  pickupByProject?: Record<string, boolean>;
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
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

function StudioDropZone({ pending }: { pending: boolean }) {
  const { ref, isDropTarget } = useDroppable({ id: "studio" });

  return (
    <Link
      ref={ref as unknown as React.Ref<HTMLAnchorElement>}
      href="/dashboard/studio"
      title="Arrastra un proyecto aquí para mandarlo a Studio · Click para abrir"
      className={`group flex shrink-0 items-center gap-1.5 rounded-lg border-2 border-dashed px-2.5 py-1.5 text-xs font-medium transition-colors ${
        isDropTarget
          ? "border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400"
          : pending
            ? "border-purple-400 bg-purple-50 text-purple-600 dark:border-purple-700 dark:bg-purple-900/20 dark:text-purple-400"
            : "border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
      }`}
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2 7-7 7 7 2 2M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10" />
      </svg>
      <span>
        {isDropTarget ? "Soltar para Studio" : pending ? "Enviando..." : "Studio"}
      </span>
    </Link>
  );
}

export function KanbanBoard({ initialProjects, zoneResponsibles = {}, invoiceDocNumbers = {}, pmNames = {}, cityByProject = {}, pickupByProject = {} }: KanbanBoardProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState("");
  const [studioPending, setStudioPending] = useState(false);
  const [studioFeedback, setStudioFeedback] = useState<
    | { type: "success"; studioProjectId: string; name: string }
    | { type: "error"; message: string }
    | null
  >(null);

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

  // Limpia el feedback de Studio a los 5s
  useEffect(() => {
    if (!studioFeedback) return;
    const t = setTimeout(() => setStudioFeedback(null), 5000);
    return () => clearTimeout(t);
  }, [studioFeedback]);

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

      // Handle studio drop — mueve el proyecto a studio_projects (Studio es otra
      // línea) y lo saca del board de Proyectos.
      if (targetId === "studio") {
        const project = projects.find((p) => p.id === projectId);
        if (!project) return;

        const onStudioResult = (
          result: Awaited<ReturnType<typeof sendProjectToStudio>>,
        ) => {
          setStudioPending(false);
          if (result.success) {
            // Sale de la línea normal → lo quitamos del board.
            setProjects((prev) => prev.filter((p) => p.id !== projectId));
            setStudioFeedback({
              type: "success",
              studioProjectId: result.studioProjectId,
              name: project.name,
            });
          } else if (result.recurring) {
            const ok = window.confirm(
              `⚠ Cliente recurrente: "${result.clientName || project.client_name || "este cliente"}" ya tiene ${result.existingCount} proyecto(s) en Studio.\n\n¿Crear el proyecto de Studio igualmente?`,
            );
            if (ok) {
              setStudioPending(true);
              sendProjectToStudio(projectId, true).then(onStudioResult);
            }
          } else {
            setStudioFeedback({ type: "error", message: result.error ?? "Error al crear Studio" });
          }
        };

        setStudioPending(true);
        setStudioFeedback(null);
        sendProjectToStudio(projectId).then(onStudioResult);
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

  const normalizedSearch = normalize(search.trim());

  function matchesSearch(project: ProjectWithItems): boolean {
    if (!normalizedSearch) return true;
    const haystack = [
      project.name,
      project.client_name,
      project.material,
      project.holded_invoice_id ? invoiceDocNumbers[project.holded_invoice_id] : null,
      project.invoice_doc_number,
    ]
      .filter(Boolean)
      .map((v) => normalize(String(v)))
      .join(" ");
    return haystack.includes(normalizedSearch);
  }

  /** Get projects for a column.
   *  - Entregados: los más recientes primero, con tope FIFO.
   *  - Resto de columnas: ordenadas por fecha de entrega (deadline) ascendente,
   *    para que lo que se entrega antes quede arriba (prioridad por tiempo).
   *    Los proyectos sin fecha van al final. */
  function getColumnProjects(columnId: ProjectStatus) {
    const columnProjects = projects.filter((p) => p.status === columnId && matchesSearch(p));

    if (columnId === "delivered") {
      const byRecency = [...columnProjects].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      return columnProjects.length > MAX_DELIVERED
        ? byRecency.slice(0, MAX_DELIVERED)
        : byRecency;
    }

    return [...columnProjects].sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return (
        new Date(a.deadline + "T00:00:00").getTime() -
        new Date(b.deadline + "T00:00:00").getTime()
      );
    });
  }

  return (
    <DragDropProvider onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="mb-3 flex shrink-0 items-center gap-2">
        <div className="relative flex-1 md:max-w-sm">
          <svg
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar proyecto, cliente, material..."
            className="w-full rounded-lg border border-zinc-300 bg-white py-2 pr-3 pl-9 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {studioFeedback?.type === "success" && (
            <Link
              href={`/dashboard/studio/${studioFeedback.studioProjectId}`}
              className="truncate rounded-md bg-purple-50 px-2 py-1 text-[11px] font-medium text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50"
            >
              ✓ &quot;{studioFeedback.name}&quot; en Studio — Ver
            </Link>
          )}
          {studioFeedback?.type === "error" && (
            <span className="truncate rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
              Error: {studioFeedback.message}
            </span>
          )}
          <StudioDropZone pending={studioPending} />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 auto-cols-[220px] grid-flow-col gap-3 overflow-x-auto md:grid-cols-4 md:auto-cols-auto md:gap-4">
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
                  responsibles={zoneResponsibles[column.id]}
                  invoiceDocNumbers={invoiceDocNumbers}
                  pmNames={pmNames}
                  cityByProject={cityByProject}
                  pickupByProject={pickupByProject}
                />
                <KanbanColumn
                  className="min-h-0 overflow-hidden"
                  column={stackedColumn}
                  projects={getColumnProjects(stackedColumn.id)}
                  responsibles={zoneResponsibles[stackedColumn.id]}
                  pmNames={pmNames}
                  pickupByProject={pickupByProject}
                />
              </div>
            );
          }

          return (
            <KanbanColumn
              key={column.id}
              column={column}
              projects={getColumnProjects(column.id)}
              responsibles={zoneResponsibles[column.id]}
              pmNames={pmNames}
              cityByProject={cityByProject}
              pickupByProject={pickupByProject}
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
