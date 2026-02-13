"use client";

import { useState } from "react";
import { triggerHoldedSync } from "./projects/actions";

export function SyncHoldedButton() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const res = await triggerHoldedSync();
      const parts = [];
      if (res.newUpcoming > 0) parts.push(`${res.newUpcoming} nuevo(s)`);
      if (res.newFromInvoice > 0) parts.push(`${res.newFromInvoice} factura(s)`);
      if (res.converted > 0) parts.push(`${res.converted} confirmado(s)`);
      setResult(parts.length > 0 ? parts.join(", ") : "Sin cambios");
      setTimeout(() => setResult(null), 4000);
    } catch {
      setResult("Error al sincronizar");
      setTimeout(() => setResult(null), 4000);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {result && (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{result}</span>
      )}
      <button
        onClick={handleSync}
        disabled={syncing}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <svg
          className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        {syncing ? "Sincronizando..." : "Sync Holded"}
      </button>
    </div>
  );
}
