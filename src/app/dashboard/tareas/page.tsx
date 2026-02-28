import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TaskFilters } from "./task-filters";

function PriorityBadge({ priority }: { priority: string }) {
  const classes = "rounded-full px-2 py-0.5 text-xs font-medium ";
  if (priority === "high")
    return <span className={classes + "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}>Alta</span>;
  if (priority === "low")
    return <span className={classes + "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}>Baja</span>;
  return <span className={classes + "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"}>Media</span>;
}

function StatusBadge({ status }: { status: string }) {
  const classes = "rounded-full px-2 py-0.5 text-xs font-medium ";
  if (status === "done")
    return <span className={classes + "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}>Hecho</span>;
  if (status === "in_progress")
    return <span className={classes + "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}>En curso</span>;
  return <span className={classes + "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}>Pendiente</span>;
}

const PROJECT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  design: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  printing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  post_processing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  qc: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  shipping: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  delivered: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const PROJECT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  design: "Design",
  printing: "Printing",
  post_processing: "Post-processing",
  qc: "QC",
  shipping: "Shipping",
  delivered: "Delivered",
};

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; mine?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  // Fetch projects where I'm the PM (not delivered/discarded)
  const { data: myProjects } = userId
    ? await supabase
        .from("projects")
        .select("id, name, client_name, status, deadline")
        .eq("project_manager_id", userId)
        .not("status", "in", "(delivered)")
        .neq("project_type", "discarded")
        .order("deadline", { ascending: true, nullsFirst: false })
    : { data: null };

  let query = supabase
    .from("tasks")
    .select("*, assigned:user_profiles!tasks_assigned_to_fkey(email), creator:user_profiles!tasks_created_by_fkey(email), project:projects!tasks_project_id_fkey(id, name)")
    .order("created_at", { ascending: false });

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  if (params.mine === "true" && userId) {
    query = query.eq("assigned_to", userId);
  }

  const { data: tasks } = await query;

  const statusFilter = params.status || "all";
  const mineFilter = params.mine === "true";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Tareas</h1>
        <Link
          href="/dashboard/tareas/new"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-black"
        >
          Nueva tarea
        </Link>
      </div>

      {myProjects && myProjects.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Mis proyectos (PM)</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {myProjects.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/projects/${p.id}`}
                className="rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-green-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-green-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                    {p.name}
                  </h3>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${PROJECT_STATUS_COLORS[p.status] ?? PROJECT_STATUS_COLORS.pending}`}>
                    {PROJECT_STATUS_LABELS[p.status] ?? p.status}
                  </span>
                </div>
                {p.client_name && (
                  <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {p.client_name}
                  </p>
                )}
                {p.deadline && (
                  <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                    Deadline: {new Date(p.deadline + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      <TaskFilters currentStatus={statusFilter} showMine={mineFilter} />

      {!tasks?.length ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No hay tareas{statusFilter !== "all" ? " con este filtro" : ""}. Crea la primera.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Título</th>
                <th className="hidden px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 sm:table-cell">Responsable</th>
                <th className="hidden px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 md:table-cell">Proyecto</th>
                <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Prioridad</th>
                <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Estado</th>
                <th className="hidden px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 lg:table-cell">Fecha límite</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const assigned = t.assigned as { email: string } | null;
                const project = t.project as { id: string; name: string } | null;

                return (
                  <tr
                    key={t.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={t.title.startsWith("Compra solicitada:") ? "/dashboard/purchases" : `/dashboard/tareas/${t.id}`}
                        className="font-medium text-zinc-900 hover:text-green-600 dark:text-white dark:hover:text-green-400"
                      >
                        {t.title}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-zinc-600 dark:text-zinc-300 sm:table-cell">
                      {assigned?.email?.split("@")[0] ?? "—"}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {project ? (
                        <Link
                          href={`/dashboard/projects/${project.id}`}
                          className="text-zinc-600 hover:text-green-600 dark:text-zinc-300 dark:hover:text-green-400"
                        >
                          {project.name}
                        </Link>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="hidden px-4 py-3 text-zinc-500 dark:text-zinc-400 lg:table-cell">
                      {t.due_date
                        ? new Date(t.due_date + "T00:00:00").toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "short",
                          })
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
