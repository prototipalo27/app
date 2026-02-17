"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { ProjectWithItems } from "./kanban-card";

interface UpcomingProjectsProps {
  projects: ProjectWithItems[];
}

export function UpcomingProjects({ projects }: UpcomingProjectsProps) {
  const router = useRouter();

  if (projects.length === 0) return null;

  return (
    <div className="mb-4 shrink-0">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Proximos proyectos
        </h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          {projects.length}
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {projects.map((project) => (
          <UpcomingCard key={project.id} project={project} onClick={() => router.push(`/dashboard/projects/${project.id}`)} />
        ))}
      </div>
    </div>
  );
}

function UpcomingCard({ project, onClick }: { project: ProjectWithItems; onClick: () => void }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const items = project.project_items ?? [];

  useEffect(() => {
    if (showTooltip && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [showTooltip]);

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      className="relative w-52 shrink-0 cursor-pointer rounded-lg border border-amber-200 bg-amber-50 p-2.5 transition hover:shadow-md dark:border-amber-800/50 dark:bg-amber-900/10"
    >
      <h4 className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
        {project.name}
      </h4>
      {project.price !== null && (
        <span className="mt-1 inline-block text-[11px] font-medium text-amber-700 dark:text-amber-400">
          {Number(project.price).toFixed(2)} €
        </span>
      )}

      {/* Hover tooltip rendered via portal to escape overflow */}
      {showTooltip &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50 w-64 rounded-lg border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
            style={{ top: tooltipPos.top, left: tooltipPos.left }}
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
              {project.price !== null && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  {Number(project.price).toFixed(2)} €
                </span>
              )}
              {items.length > 0 && (
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                  {items.length} item(s)
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
          </div>,
          document.body
        )}
    </div>
  );
}
