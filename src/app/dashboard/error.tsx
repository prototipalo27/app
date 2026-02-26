"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
        Algo ha fallado
      </h2>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Ha ocurrido un error inesperado. Puedes intentarlo de nuevo.
      </p>
      {error.digest && (
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Digest: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        className="mt-6 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Reintentar
      </button>
    </div>
  );
}
