import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { TaskFilters } from "./task-filters";
import { TaskCheckbox } from "./task-checkbox";

function PriorityBadge({ priority }: { priority: string }) {
  const classes = "rounded-full px-2 py-0.5 text-xs font-medium ";
  if (priority === "high")
    return <span className={classes + "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}>Alta</span>;
  if (priority === "low")
    return <span className={classes + "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}>Baja</span>;
  return <span className={classes + "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"}>Media</span>;
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
  const profile = await getUserProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const userId = profile.id;
  const isManager = hasRole(profile.role, "manager");

  // Managers toggle "all" vs "mine". Employees see tasks where they are involved
  // (assigned to them OR created by them) so they can follow up on tasks they delegate.
  const showOnlyMine = isManager ? params.mine === "true" : true;

  // Fetch projects where I'm the PM (managers only)
  const { data: myProjects } = isManager
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

  if (params.status === "done") {
    query = query.eq("status", "done");
  } else if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  } else {
    query = query.neq("status", "done");
  }

  if (showOnlyMine) {
    if (isManager) {
      // Manager toggled "Mis tareas" → only tasks assigned to them
      query = query.eq("assigned_to", userId);
    } else {
      // Employees: tasks assigned to them OR created by them
      query = query.or(`assigned_to.eq.${userId},created_by.eq.${userId}`);
    }
  }

  const { data: tasks } = await query;

  const statusFilter = params.status || "all";

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

      <TaskFilters currentStatus={statusFilter} showMine={showOnlyMine} isManager={isManager} />

      {!tasks?.length ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No hay tareas{statusFilter !== "all" ? " con este filtro" : ""}. Crea la primera.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => {
            const assigned = t.assigned as { email: string } | null;
            const project = t.project as { id: string; name: string } | null;
            const isDone = t.status === "done";

            return (
              <div
                key={t.id}
                className={`flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 ${isDone ? "opacity-60" : ""}`}
              >
                <TaskCheckbox taskId={t.id} isDone={isDone} />

                <div className="min-w-0 flex-1">
                  <Link
                    href={t.title.startsWith("Compra solicitada:") ? "/dashboard/purchases" : `/dashboard/tareas/${t.id}`}
                    className={`text-sm font-medium hover:text-green-600 dark:hover:text-green-400 ${isDone ? "text-zinc-400 line-through dark:text-zinc-500" : "text-zinc-900 dark:text-white"}`}
                  >
                    {t.title}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {assigned && (
                      <span>{assigned.email.split("@")[0]}</span>
                    )}
                    {project && (
                      <Link href={`/dashboard/projects/${project.id}`} className="hover:text-green-600 dark:hover:text-green-400">
                        {project.name}
                      </Link>
                    )}
                    {t.due_date && (
                      <span>
                        {new Date(t.due_date + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                      </span>
                    )}
                  </div>
                </div>

                <PriorityBadge priority={t.priority} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
