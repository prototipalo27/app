"use client";

import { useRouter } from "next/navigation";
import type { ProjectWithItems } from "./kanban-card";

interface UpcomingProjectsProps {
  projects: ProjectWithItems[];
}

export function UpcomingProjects({ projects }: UpcomingProjectsProps) {
  const router = useRouter();

  if (projects.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Upcoming Projects
        </h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          {projects.length}
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {projects.map((project) => (
          <div
            key={project.id}
            onClick={() => router.push(`/dashboard/projects/${project.id}`)}
            className="w-64 shrink-0 cursor-pointer rounded-lg border border-amber-200 bg-amber-50 p-3 transition hover:shadow-md dark:border-amber-800/50 dark:bg-amber-900/10"
          >
            <h4 className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
              {project.name}
            </h4>

            {project.client_name && (
              <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                {project.client_name}
              </p>
            )}

            <div className="mt-2 flex items-center gap-2">
              {project.price !== null && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  {Number(project.price).toFixed(2)} €
                </span>
              )}
              {(project.project_items?.length ?? 0) > 0 && (
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  {project.project_items!.length} item(s)
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
