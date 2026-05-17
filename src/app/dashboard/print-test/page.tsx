import { createClient } from "@/lib/supabase/server";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { enqueuePrintJob } from "./actions";
import { PrintJobsList } from "./print-jobs-list";

export default async function PrintTestPage() {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");
  if (!hasRole(profile.role, "manager")) redirect("/dashboard");

  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("label_print_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  const inputClass =
    "block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500";

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Prueba de impresión
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Encola un PDF en la cola <code>label_print_jobs</code>. El agente del PC
          de diseño debe imprimirlo en pocos segundos.
        </p>
      </div>

      <form
        action={enqueuePrintJob}
        className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div>
          <label
            htmlFor="label_url"
            className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
          >
            URL del PDF
          </label>
          <input
            id="label_url"
            type="url"
            name="label_url"
            required
            placeholder="https://..."
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label
            htmlFor="printer_label"
            className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
          >
            Impresora (opcional)
          </label>
          <input
            id="printer_label"
            type="text"
            name="printer_label"
            placeholder="Munbyn"
            className={`mt-1 ${inputClass}`}
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Si la dejas vacía, el agente usa <code>PRINTER_NAME</code> del .env.
          </p>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-zinc-900"
        >
          Encolar impresión
        </button>
      </form>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
          Últimos trabajos
        </h2>
        <PrintJobsList initialJobs={jobs ?? []} />
      </div>
    </div>
  );
}
