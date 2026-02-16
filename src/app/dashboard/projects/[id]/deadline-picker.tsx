"use client";

import { useState } from "react";
import { updateProjectDeadline } from "../actions";

interface DeadlinePickerProps {
  projectId: string;
  currentDeadline: string | null;
}

export function DeadlinePicker({ projectId, currentDeadline }: DeadlinePickerProps) {
  const [value, setValue] = useState(currentDeadline ?? "");
  const [saving, setSaving] = useState(false);

  const handleChange = async (newValue: string) => {
    setValue(newValue);
    setSaving(true);
    try {
      await updateProjectDeadline(projectId, newValue || null);
    } catch {
      setValue(currentDeadline ?? "");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
      />
      {saving && (
        <span className="text-xs text-zinc-400">...</span>
      )}
      {value && (
        <button
          onClick={() => handleChange("")}
          className="text-xs text-zinc-400 hover:text-red-500"
          title="Quitar fecha"
        >
          ×
        </button>
      )}
    </div>
  );
}
