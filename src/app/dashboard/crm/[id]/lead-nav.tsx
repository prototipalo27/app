"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface LeadNavProps {
  prevId: string | null;
  nextId: string | null;
  current: number;
  total: number;
}

export default function LeadNav({ prevId, nextId, current, total }: LeadNavProps) {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore when typing in inputs/textareas
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement).isContentEditable) return;

      if (e.key === "j" && nextId) {
        e.preventDefault();
        router.push(`/dashboard/crm/${nextId}`);
      } else if (e.key === "k" && prevId) {
        e.preventDefault();
        router.push(`/dashboard/crm/${prevId}`);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevId, nextId, router]);

  return (
    <div className="mb-6 flex items-center justify-between">
      <Link
        href="/dashboard/crm"
        className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        &larr; Volver a CRM
      </Link>

      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {current} de {total}
        </span>

        <div className="flex gap-1">
          {prevId ? (
            <Link
              href={`/dashboard/crm/${prevId}`}
              className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              title="Anterior (k)"
            >
              &larr; Ant
            </Link>
          ) : (
            <span className="rounded-lg border border-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-300 dark:border-zinc-800 dark:text-zinc-600">
              &larr; Ant
            </span>
          )}

          {nextId ? (
            <Link
              href={`/dashboard/crm/${nextId}`}
              className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              title="Siguiente (j)"
            >
              Sig &rarr;
            </Link>
          ) : (
            <span className="rounded-lg border border-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-300 dark:border-zinc-800 dark:text-zinc-600">
              Sig &rarr;
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
