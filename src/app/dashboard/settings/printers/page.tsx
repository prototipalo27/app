import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import PrinterHoursForm from "./printer-hours-form";

export const metadata = {
  title: "Horas impresoras - Prototipalo",
};

export default async function PrinterSettingsPage() {
  const supabase = await createClient();

  const { data: printers } = await supabase
    .from("printers")
    .select("id, name, model, lifetime_seconds")
    .order("name");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Horas de impresoras
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Ajusta las horas acumuladas de cada impresora. Se incrementan automaticamente con cada sync.
          </p>
        </div>
        <Link
          href="/dashboard/printers"
          className="flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Impresoras
        </Link>
      </div>

      <PrinterHoursForm printers={printers ?? []} />
    </div>
  );
}
