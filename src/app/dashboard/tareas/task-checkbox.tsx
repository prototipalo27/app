"use client";

import { useTransition } from "react";
import { updateTaskStatus } from "./actions";

export function TaskCheckbox({ taskId, isDone }: { taskId: string; isDone: boolean }) {
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    startTransition(async () => {
      await updateTaskStatus(taskId, isDone ? "pending" : "done");
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
        isDone
          ? "border-green-500 bg-green-500 text-white"
          : "border-zinc-300 hover:border-green-400 dark:border-zinc-600 dark:hover:border-green-500"
      } ${pending ? "opacity-50" : ""}`}
      title={isDone ? "Marcar como pendiente" : "Marcar como hecha"}
    >
      {isDone && (
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}
