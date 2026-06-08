"use client";

import { useState } from "react";
import {
  updateProjectDeadline,
  updateProjectPreDeliveryDate,
  updateProjectDeadlineHard,
} from "../actions";

interface DeadlinePickerProps {
  projectId: string;
  currentDeadline: string | null;
  currentPreDeliveryDate: string | null;
  currentDeadlineIsHard: boolean;
}

const inputClass =
  "rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white";

export function DeadlinePicker({
  projectId,
  currentDeadline,
  currentPreDeliveryDate,
  currentDeadlineIsHard,
}: DeadlinePickerProps) {
  const [deadline, setDeadline] = useState(currentDeadline ?? "");
  const [preDate, setPreDate] = useState(currentPreDeliveryDate ?? "");
  const [isHard, setIsHard] = useState(currentDeadlineIsHard);
  const [saving, setSaving] = useState(false);

  const run = async (fn: () => Promise<void>, rollback: () => void) => {
    setSaving(true);
    try {
      await fn();
    } catch {
      rollback();
    } finally {
      setSaving(false);
    }
  };

  const onDeadline = (v: string) => {
    setDeadline(v);
    run(() => updateProjectDeadline(projectId, v || null), () => setDeadline(currentDeadline ?? ""));
  };
  const onPreDate = (v: string) => {
    setPreDate(v);
    run(() => updateProjectPreDeliveryDate(projectId, v || null), () => setPreDate(currentPreDeliveryDate ?? ""));
  };
  const onHard = (v: boolean) => {
    setIsHard(v);
    run(() => updateProjectDeadlineHard(projectId, v), () => setIsHard(currentDeadlineIsHard));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-24 shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Pre-entrega
        </span>
        <input type="date" value={preDate} onChange={(e) => onPreDate(e.target.value)} className={inputClass} />
        {preDate && (
          <button onClick={() => onPreDate("")} className="text-xs text-zinc-400 hover:text-red-500" title="Quitar fecha">×</button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="w-24 shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Entrega final
        </span>
        <input type="date" value={deadline} onChange={(e) => onDeadline(e.target.value)} className={inputClass} />
        {deadline && (
          <button onClick={() => onDeadline("")} className="text-xs text-zinc-400 hover:text-red-500" title="Quitar fecha">×</button>
        )}
        <label className="ml-1 flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300" title="Compromiso firme / fecha de evento — se resalta en el tablero">
          <input type="checkbox" checked={isHard} onChange={(e) => onHard(e.target.checked)} className="h-3.5 w-3.5 rounded border-zinc-300 text-red-600 focus:ring-red-500 dark:border-zinc-600" />
          Firme / evento
        </label>
      </div>

      {saving && <span className="text-xs text-zinc-400">Guardando…</span>}
    </div>
  );
}
