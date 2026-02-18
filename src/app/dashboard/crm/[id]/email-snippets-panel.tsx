"use client";

import { useState } from "react";

interface Snippet {
  id: string;
  title: string;
  category: string;
  content: string;
}

const CATEGORIES = [
  { id: "saludo", label: "Saludo" },
  { id: "pagos", label: "Pagos" },
  { id: "envios", label: "Envíos" },
  { id: "plazos", label: "Plazos" },
  { id: "materiales", label: "Materiales" },
  { id: "cierre", label: "Cierre" },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  saludo: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  pagos: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  envios: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  plazos: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  materiales: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  cierre: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export default function EmailSnippetsPanel({
  snippets,
  onInsert,
}: {
  snippets: Snippet[];
  onInsert: (text: string) => void;
}) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  const handleCopy = async (snippetId: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(snippetId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    snippets: snippets.filter((s) => s.category === cat.id),
  })).filter((g) => g.snippets.length > 0);

  if (snippets.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Snippets
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Click para insertar en el email
        </p>
      </div>

      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {grouped.map((group) => {
          const isExpanded = expandedCategories.has(group.id);

          return (
            <div key={group.id}>
              <button
                onClick={() => toggleCategory(group.id)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[group.id]}`}
                  >
                    {group.label}
                  </span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    {group.snippets.length}
                  </span>
                </div>
                <svg
                  className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isExpanded && (
                <div className="space-y-1 px-3 pb-3">
                  {group.snippets.map((snippet) => (
                    <div
                      key={snippet.id}
                      className="group rounded-lg border border-zinc-100 bg-zinc-50/50 p-2.5 dark:border-zinc-800 dark:bg-zinc-800/30"
                    >
                      <p className="mb-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        {snippet.title}
                      </p>
                      <p className="mb-2 line-clamp-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                        {snippet.content}
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => onInsert(snippet.content)}
                          className="rounded bg-brand/10 px-2 py-1 text-[10px] font-medium text-brand hover:bg-brand/20 dark:bg-brand/20 dark:hover:bg-brand/30"
                        >
                          Insertar
                        </button>
                        <button
                          onClick={() => handleCopy(snippet.id, snippet.content)}
                          className="rounded bg-zinc-100 px-2 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                        >
                          {copiedId === snippet.id ? "Copiado!" : "Copiar"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
