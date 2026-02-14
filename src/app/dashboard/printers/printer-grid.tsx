"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import PrinterCard from "./printer-card";

type Printer = Tables<"printers">;
type PrinterType = Tables<"printer_types">;

interface PrinterJob {
  id: string;
  printer_id: string | null;
  batch_number: number;
  pieces_in_batch: number;
  estimated_minutes: number;
  status: string;
  item_name: string;
  project_name: string;
}

const SYNC_INTERVAL = 5 * 60_000; // 5 minutes (matches Vercel Cron)

export default function PrinterGrid({ initialPrinters, initialJobs = [], printerTypes = [] }: { initialPrinters: Printer[]; initialJobs?: PrinterJob[]; printerTypes?: PrinterType[] }) {
  const [printers, setPrinters] = useState<Printer[]>(initialPrinters);
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const triggerSync = useCallback(async () => {
    setSyncing(true);
    setLastError(null);
    try {
      const res = await fetch("/api/printers/sync", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setLastError(data.error ?? "Sync failed");
      }
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSyncing(false);
    }
  }, []);

  // Subscribe to Supabase Realtime for instant UI updates
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("printers-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "printers" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newPrinter = payload.new as Printer;
            setPrinters((prev) => [...prev, newPrinter]);
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Printer;
            setPrinters((prev) =>
              prev.map((p) => (p.id === updated.id ? updated : p))
            );
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as { id: string };
            setPrinters((prev) => prev.filter((p) => p.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Poll sync every 30 seconds
  useEffect(() => {
    // Initial sync on mount
    triggerSync();

    const interval = setInterval(triggerSync, SYNC_INTERVAL);
    return () => clearInterval(interval);
  }, [triggerSync]);

  // Sort: online first, then by name
  const sorted = [...printers].sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div>
      {/* Status bar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {printers.length} printer{printers.length !== 1 ? "s" : ""}
            {" · "}
            {printers.filter((p) => p.online).length} online
          </p>
          {syncing && (
            <span className="flex items-center gap-1 text-xs text-zinc-400">
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Syncing...
            </span>
          )}
        </div>
        <button
          onClick={triggerSync}
          disabled={syncing}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Sync now
        </button>
      </div>

      {lastError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {lastError}
        </div>
      )}

      {/* Grid */}
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <p className="text-zinc-500 dark:text-zinc-400">
            No printers found. Make sure your Bambu Lab credentials are configured.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sorted.map((printer) => (
            <PrinterCard key={printer.id} printer={printer} jobs={initialJobs.filter((j) => j.printer_id === printer.id)} printerTypes={printerTypes} />
          ))}
        </div>
      )}
    </div>
  );
}
