"use client";

import { useState } from "react";

interface GoogleAccount {
  email: string;
  connected_at: string;
  last_used_at: string | null;
  last_error: string | null;
  scopes: string[];
}

export default function GoogleAccountCard({
  googleAccount,
}: {
  googleAccount: GoogleAccount | null;
}) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const handleDisconnect = async () => {
    if (!confirm("¿Seguro que quieres desconectar tu cuenta de Google? No podrás enviar emails hasta que la reconectes.")) {
      return;
    }
    setDisconnecting(true);
    setDisconnectError(null);
    try {
      const res = await fetch("/api/auth/google/disconnect", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al desconectar");
      }
      window.location.reload();
    } catch (err) {
      setDisconnectError(err instanceof Error ? err.message : "Error al desconectar");
      setDisconnecting(false);
    }
  };

  if (!googleAccount) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <svg className="h-6 w-6 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
              Conectar cuenta de Google
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Envia correos desde tu propia cuenta. Un solo clic, sin contrasenas.
            </p>
          </div>
          <a
            href="/api/auth/google/connect"
            className="flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Conectar con Google
          </a>
        </div>
      </div>
    );
  }

  const connectedDate = new Date(googleAccount.connected_at).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const lastUsed = googleAccount.last_used_at
    ? new Date(googleAccount.last_used_at).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Nunca";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Error banner */}
      {googleAccount.last_error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-medium">Hay un problema con tu conexion</p>
            <p className="mt-0.5 text-xs opacity-80">{googleAccount.last_error}</p>
            <a
              href="/api/auth/google/connect"
              className="mt-2 inline-block rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500"
            >
              Reconectar cuenta
            </a>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-white">
              Conectado como {googleAccount.email}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Desde {connectedDate} · Ultimo uso: {lastUsed}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          {disconnecting ? "Desconectando..." : "Desconectar"}
        </button>
        {disconnectError && (
          <p className="text-xs text-red-500">{disconnectError}</p>
        )}
      </div>
    </div>
  );
}
