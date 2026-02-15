import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createTask } from "../actions";

export default async function NewTaskPage() {
  const supabase = await createClient();

  const [{ data: users }, { data: projects }] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("id, email")
      .eq("is_active", true)
      .order("email"),
    supabase
      .from("projects")
      .select("id, name")
      .in("project_type", ["confirmed", "upcoming"])
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard/tareas"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Volver a tareas
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">Nueva tarea</h1>
      </div>

      <form
        action={createTask}
        className="max-w-2xl space-y-5 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Título *
          </label>
          <input
            id="title"
            name="title"
            required
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>

        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Descripción
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="priority" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Prioridad
            </label>
            <select
              id="priority"
              name="priority"
              defaultValue="medium"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
            </select>
          </div>

          <div>
            <label htmlFor="due_date" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Fecha límite
            </label>
            <input
              id="due_date"
              name="due_date"
              type="date"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="assigned_to" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Responsable
            </label>
            <select
              id="assigned_to"
              name="assigned_to"
              defaultValue=""
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              <option value="">Sin asignar</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email.split("@")[0]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="project_id" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Proyecto (opcional)
            </label>
            <select
              id="project_id"
              name="project_id"
              defaultValue=""
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              <option value="">Ninguno</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-black"
          >
            Crear tarea
          </button>
          <Link
            href="/dashboard/tareas"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
