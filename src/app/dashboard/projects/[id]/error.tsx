"use client";

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg py-12 text-center">
      <div className="rounded-xl border border-red-200 bg-white p-8 dark:border-red-900/50 dark:bg-zinc-900">
        <h2 className="mb-2 text-lg font-semibold text-red-600 dark:text-red-400">
          Algo ha fallado
        </h2>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          {error.message || "Ha ocurrido un error inesperado."}
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
