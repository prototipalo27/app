"use client";

import { useState, useTransition } from "react";
import { updateProjectManager } from "../actions";

interface PmSelectorProps {
  projectId: string;
  currentPmId: string | null;
  users: { id: string; label: string }[];
}

export default function PmSelector({ projectId, currentPmId, users }: PmSelectorProps) {
  const [pmId, setPmId] = useState(currentPmId ?? "");
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    setPmId(value);
    startTransition(async () => {
      await updateProjectManager(projectId, value || null);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">PM:</span>
      <select
        value={pmId}
        onChange={handleChange}
        disabled={isPending}
        className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
      >
        <option value="">Sin asignar</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.label}
          </option>
        ))}
      </select>
      {isPending && (
        <span className="text-xs text-zinc-400">Guardando...</span>
      )}
    </div>
  );
}
