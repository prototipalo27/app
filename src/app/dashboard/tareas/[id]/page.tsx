import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateTask } from "../actions";
import { TaskStatusButtons, DeleteTaskButton } from "./status-buttons";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  const [{ data: task }, { data: users }, { data: projects }, { data: profile }] = await Promise.all([
    supabase
      .from("tasks")
      .select("*, assigned:user_profiles!tasks_assigned_to_fkey(email), creator:user_profiles!tasks_created_by_fkey(email), project:projects!tasks_project_id_fkey(id, name)")
      .eq("id", id)
      .single(),
    supabase.from("user_profiles").select("id, email").eq("is_active", true).order("email"),
    supabase.from("projects").select("id, name").in("project_type", ["confirmed", "upcoming"]).order("created_at", { ascending: false }),
    supabase.from("user_profiles").select("role").eq("id", userId!).single(),
  ]);

  if (!task) notFound();

  const isManager = profile?.role === "manager";
  const isCreator = task.created_by === userId;
  const isAssigned = task.assigned_to === userId;
  const canEdit = isCreator || isAssigned || isManager;
  const canDelete = isCreator || isManager;

  const assigned = task.assigned as { email: string } | null;
  const creator = task.creator as { email: string } | null;
  const project = task.project as { id: string; name: string } | null;

  const priorityLabel: Record<string, string> = { low: "Baja", medium: "Media", high: "Alta" };
  const statusLabel: Record<string, string> = { pending: "Pendiente", in_progress: "En curso", done: "Hecho" };

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard/tareas"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Volver a tareas
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{task.title}</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Creada por {creator?.email?.split("@")[0] ?? "—"} el{" "}
            {task.created_at
              ? new Date(task.created_at).toLocaleDateString("es-ES", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "—"}
          </p>
        </div>
        {canEdit && <TaskStatusButtons taskId={task.id} currentStatus={task.status} />}
      </div>

      {/* Info cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Estado</p>
          <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">{statusLabel[task.status] ?? task.status}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Prioridad</p>
          <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">{priorityLabel[task.priority] ?? task.priority}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Responsable</p>
          <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">{assigned?.email?.split("@")[0] ?? "Sin asignar"}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Fecha límite</p>
          <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">
            {task.due_date
              ? new Date(task.due_date + "T00:00:00").toLocaleDateString("es-ES", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "—"}
          </p>
        </div>
      </div>

      {/* Project link */}
      {project && (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Proyecto vinculado</p>
          <Link
            href={`/dashboard/projects/${project.id}`}
            className="mt-1 text-sm font-medium text-brand hover:text-brand-dark dark:text-brand dark:hover:text-brand-dark"
          >
            {project.name}
          </Link>
        </div>
      )}

      {/* Description */}
      {task.description && (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Descripción</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{task.description}</p>
        </div>
      )}

      {/* Edit form */}
      {canEdit && (
        <details className="mb-6 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Editar tarea
          </summary>
          <form action={updateTask} className="space-y-4 border-t border-zinc-200 p-4 dark:border-zinc-800">
            <input type="hidden" name="id" value={task.id} />

            <div>
              <label htmlFor="title" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Título *
              </label>
              <input
                id="title"
                name="title"
                required
                defaultValue={task.title}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="edit-description" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Descripción
              </label>
              <textarea
                id="edit-description"
                name="description"
                rows={3}
                defaultValue={task.description ?? ""}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="edit-priority" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Prioridad
                </label>
                <select
                  id="edit-priority"
                  name="priority"
                  defaultValue={task.priority}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                </select>
              </div>

              <div>
                <label htmlFor="edit-status" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Estado
                </label>
                <select
                  id="edit-status"
                  name="status"
                  defaultValue={task.status}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="pending">Pendiente</option>
                  <option value="in_progress">En curso</option>
                  <option value="done">Hecho</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="edit-assigned" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Responsable
                </label>
                <select
                  id="edit-assigned"
                  name="assigned_to"
                  defaultValue={task.assigned_to ?? ""}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
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
                <label htmlFor="edit-project" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Proyecto
                </label>
                <select
                  id="edit-project"
                  name="project_id"
                  defaultValue={task.project_id ?? ""}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
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

            <div>
              <label htmlFor="edit-due-date" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Fecha límite
              </label>
              <input
                id="edit-due-date"
                name="due_date"
                type="date"
                defaultValue={task.due_date ?? ""}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white sm:w-auto"
              />
            </div>

            <button
              type="submit"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-black"
            >
              Guardar cambios
            </button>
          </form>
        </details>
      )}

      {/* Delete */}
      {canDelete && <DeleteTaskButton taskId={task.id} />}
    </div>
  );
}
