"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Job = {
  id: string;
  label_url: string;
  printer_label: string | null;
  status: string;
  error_message: string | null;
  source_kind: string | null;
  created_at: string;
  printed_at: string | null;
};

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  printing: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  printed: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  error: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "En cola",
  printing: "Imprimiendo…",
  printed: "Impresa",
  error: "Error",
};

export function PrintJobsList({ initialJobs }: { initialJobs: Job[] }) {
  const [jobs, setJobs] = useState(initialJobs);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("print-jobs-test")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "label_print_jobs" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setJobs((prev) => [payload.new as Job, ...prev].slice(0, 20));
          } else if (payload.eventType === "UPDATE") {
            setJobs((prev) =>
              prev.map((j) =>
                j.id === (payload.new as Job).id ? (payload.new as Job) : j,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            setJobs((prev) => prev.filter((j) => j.id !== (payload.old as Job).id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (jobs.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Aún no hay trabajos. Encola uno con el formulario de arriba.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {jobs.map((job) => (
        <li key={job.id} className="flex flex-wrap items-center gap-3 py-3">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              STATUS_CLASS[job.status] ?? STATUS_CLASS.pending
            }`}
          >
            {STATUS_LABEL[job.status] ?? job.status}
          </span>
          <a
            href={job.label_url}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 max-w-md truncate text-sm text-brand-blue hover:underline"
            title={job.label_url}
          >
            {job.label_url}
          </a>
          {job.printer_label && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              → {job.printer_label}
            </span>
          )}
          <span className="ml-auto text-xs text-zinc-400">
            {new Date(job.created_at).toLocaleString("es-ES")}
          </span>
          {job.error_message && (
            <p className="w-full text-xs text-red-600 dark:text-red-400">
              {job.error_message}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
