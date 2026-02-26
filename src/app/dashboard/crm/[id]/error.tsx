"use client";

import Link from "next/link";

export default function LeadError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
        Error al cargar el lead
      </h2>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Algo ha fallado al cargar esta pagina. Puedes intentarlo de nuevo o
        volver al CRM.
      </p>
      {error.digest && (
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Digest: {error.digest}
        </p>
      )}
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Reintentar
        </button>
        <Link
          href="/dashboard/crm"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Volver al CRM
        </Link>
      </div>
    </div>
  );
}
