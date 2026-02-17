"use client";

import { useActionState } from "react";
import { updateLifetimeHours } from "./actions";

interface Printer {
  id: string;
  name: string;
  model: string | null;
  lifetime_seconds: number;
}

function formatHours(seconds: number): string {
  return (seconds / 3600).toFixed(1);
}

export default function PrinterHoursForm({ printers }: { printers: Printer[] }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { success?: boolean; error?: string } | null, formData: FormData) => {
      return updateLifetimeHours(formData);
    },
    null
  );

  return (
    <form action={formAction}>
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <th className="px-4 py-3">Impresora</th>
              <th className="px-4 py-3">Modelo</th>
              <th className="px-4 py-3 text-right">Horas acumuladas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {printers.map((printer) => (
              <tr key={printer.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-white">
                  {printer.name}
                </td>
                <td className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                  {printer.model ?? "-"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <input
                      type="number"
                      name={`hours_${printer.id}`}
                      defaultValue={formatHours(printer.lifetime_seconds)}
                      step="0.1"
                      min="0"
                      className="w-24 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-right text-sm tabular-nums text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-green-500"
                    />
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">h</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          {state?.success && (
            <p className="text-sm text-green-600 dark:text-green-400">Guardado correctamente</p>
          )}
          {state?.error && (
            <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {isPending ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}
