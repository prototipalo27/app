"use client";

import { useState, useTransition } from "react";
import { applyTemplateToProject } from "../actions";

type Template = { id: string; name: string };

export default function ApplyTemplate({
  projectId,
  currentTemplateId,
  templates,
  hasItems,
}: {
  projectId: string;
  currentTemplateId: string | null;
  templates: Template[];
  hasItems: boolean;
}) {
  const [selected, setSelected] = useState(currentTemplateId ?? "");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  function handleApply() {
    if (!selected || selected === currentTemplateId) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await applyTemplateToProject(projectId, selected);
      if (!result.success) {
        setFeedback(result.error ?? "Error al aplicar plantilla");
        return;
      }
      const parts: string[] = [];
      if (result.added) parts.push(`${result.added} añadidos`);
      if (result.skipped) parts.push(`${result.skipped} ya existían`);
      setFeedback(parts.length ? parts.join(", ") : "Plantilla aplicada");
    });
  }

  if (templates.length === 0) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        No hay plantillas activas. Créalas en Ajustes → Plantillas.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={pending}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
      >
        <option value="">— Elegir plantilla —</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.id === currentTemplateId ? " (actual)" : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleApply}
        disabled={pending || !selected || selected === currentTemplateId}
        className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Aplicando…" : currentTemplateId ? "Cambiar" : "Aplicar"}
      </button>
      {hasItems && selected && selected !== currentTemplateId && (
        <span className="text-xs text-amber-600 dark:text-amber-400">
          Se añadirán los items que falten (no se borra nada).
        </span>
      )}
      {feedback && (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{feedback}</span>
      )}
    </div>
  );
}
