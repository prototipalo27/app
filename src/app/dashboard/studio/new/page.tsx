import { createStudioProject } from "../actions";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/rbac";

export default async function NewStudioProjectPage() {
  const profile = await getUserProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: activeUsers } = await supabase
    .from("user_profiles")
    .select("id, full_name, nickname, email")
    .eq("is_active", true);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href="/dashboard/studio"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Volver a Studio
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
          Nuevo proyecto Studio
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Para proyectos premium: desarrollo de patentes, consultoría, entregables a medida.
        </p>
      </div>

      <form
        action={createStudioProject}
        className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Nombre del proyecto *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
            placeholder="ej. Desarrollo patente inhalador X"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="client_name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Cliente
            </label>
            <input
              type="text"
              id="client_name"
              name="client_name"
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
            />
          </div>
          <div>
            <label htmlFor="client_email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email cliente
            </label>
            <input
              type="email"
              id="client_email"
              name="client_email"
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Estado
            </label>
            <select
              id="status"
              name="status"
              defaultValue="brief"
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              <option value="brief">Brief</option>
              <option value="propuesta">Propuesta</option>
              <option value="en_curso">En curso</option>
              <option value="entregado">Entregado</option>
              <option value="cerrado">Cerrado</option>
            </select>
          </div>
          <div>
            <label htmlFor="project_manager_id" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Project Manager
            </label>
            <select
              id="project_manager_id"
              name="project_manager_id"
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              <option value="">Sin asignar</option>
              {activeUsers?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nickname || u.full_name || u.email.split("@")[0]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="total_price" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Precio total
            </label>
            <div className="relative mt-1">
              <input
                type="number"
                id="total_price"
                name="total_price"
                step="0.01"
                min="0"
                className="block w-full rounded-lg border border-zinc-300 bg-white py-2 pr-3 pl-7 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
                placeholder="10000"
              />
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-zinc-400">
                &euro;
              </span>
            </div>
          </div>
          <div>
            <label htmlFor="start_date" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Inicio
            </label>
            <input
              type="date"
              id="start_date"
              name="start_date"
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="expected_end_date" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Entrega prevista
            </label>
            <input
              type="date"
              id="expected_end_date"
              name="expected_end_date"
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label htmlFor="brief_description" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Brief inicial
          </label>
          <textarea
            id="brief_description"
            name="brief_description"
            rows={4}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
            placeholder="Qué nos ha contado el cliente, qué necesita, contexto del proyecto..."
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Podrás añadir objetivos, restricciones y referencias después en la pestaña Brief.
          </p>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Notas internas
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <Link
            href="/dashboard/studio"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-zinc-900"
          >
            Crear proyecto
          </button>
        </div>
      </form>
    </div>
  );
}
