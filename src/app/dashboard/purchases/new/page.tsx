import { createClient } from "@/lib/supabase/server";
import { createPurchaseList } from "../actions";
import Link from "next/link";
import { requireRole } from "@/lib/rbac";

export default async function NewPurchaseListPage() {
  await requireRole("manager");
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .order("name");

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href="/dashboard/purchases"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Volver a listas
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
          Nueva lista de compras
        </h1>
      </div>

      <form
        action={createPurchaseList}
        className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Titulo *
          </label>
          <input
            type="text"
            id="title"
            name="title"
            required
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
            placeholder="Ej: Material semana 10"
          />
        </div>

        <div>
          <label
            htmlFor="project_id"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Proyecto (opcional)
          </label>
          <select
            id="project_id"
            name="project_id"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            <option value="">Sin proyecto</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Notas
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <Link
            href="/dashboard/purchases"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-zinc-900"
          >
            Crear lista
          </button>
        </div>
      </form>
    </div>
  );
}
