"use client";

import { useTransition } from "react";
import { updateProjectPriority } from "../actions";

const PRIORITIES = [
  { value: 0, label: "Normal", className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400", activeClassName: "bg-zinc-200 text-zinc-900 ring-1 ring-zinc-400 dark:bg-zinc-700 dark:text-white dark:ring-zinc-500" },
  { value: 1, label: "Alta", className: "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-500", activeClassName: "bg-yellow-100 text-yellow-700 ring-1 ring-yellow-400 dark:bg-yellow-900/40 dark:text-yellow-400 dark:ring-yellow-500" },
  { value: 2, label: "Urgente", className: "bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-500", activeClassName: "bg-red-100 text-red-700 ring-1 ring-red-400 dark:bg-red-900/40 dark:text-red-400 dark:ring-red-500" },
] as const;

export default function PrioritySelector({ projectId, currentPriority }: { projectId: string; currentPriority: number }) {
  const [isPending, startTransition] = useTransition();

  function handleClick(priority: number) {
    if (priority === currentPriority || isPending) return;
    startTransition(async () => {
      await updateProjectPriority(projectId, priority);
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-zinc-500 dark:text-zinc-400 mr-1">Prioridad:</span>
      {PRIORITIES.map((p) => {
        const isActive = currentPriority === p.value;
        return (
          <button
            key={p.value}
            onClick={() => handleClick(p.value)}
            disabled={isPending}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-all ${isActive ? p.activeClassName : p.className} ${isPending ? "opacity-50" : "hover:opacity-80 cursor-pointer"}`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
