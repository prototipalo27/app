"use client";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-dark.png"
          alt="Prototipalo"
          className="mx-auto mb-6 hidden h-10 dark:block"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-light.png"
          alt="Prototipalo"
          className="mx-auto mb-6 block h-10 dark:hidden"
        />
        <div className="rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <svg
            className="mx-auto mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M18.364 5.636a9 9 0 11-12.728 0M12 9v4m0 4h.01"
            />
          </svg>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white">
            Sin conexión
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Comprueba tu conexión a internet e inténtalo de nuevo.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Reintentar
          </button>
        </div>
      </div>
    </div>
  );
}
