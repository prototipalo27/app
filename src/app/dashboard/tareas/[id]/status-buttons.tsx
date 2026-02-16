"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTaskStatus, deleteTask } from "../actions";

const TRANSITIONS: Record<string, { label: string; next: string }[]> = {
  pending: [{ label: "Iniciar", next: "in_progress" }],
  in_progress: [
    { label: "Completar", next: "done" },
    { label: "Volver a pendiente", next: "pending" },
  ],
  done: [{ label: "Reabrir", next: "pending" }],
};

export function TaskStatusButtons({
  taskId,
  currentStatus,
}: {
  taskId: string;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const actions = TRANSITIONS[currentStatus] ?? [];

  function handleClick(nextStatus: string) {
    startTransition(async () => {
      await updateTaskStatus(taskId, nextStatus);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      {actions.map((a) => (
        <button
          key={a.next}
          disabled={isPending}
          onClick={() => handleClick(a.next)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
            a.next === "done"
              ? "bg-green-600 text-white hover:bg-green-700"
              : a.next === "in_progress"
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

export function DeleteTaskButton({ taskId }: { taskId: string }) {
  return (
    <form
      action={deleteTask}
      onSubmit={(e) => {
        if (!confirm("¿Eliminar esta tarea?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={taskId} />
      <button
        type="submit"
        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
      >
        Eliminar tarea
      </button>
    </form>
  );
}
