import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { KanbanBoard } from "./kanban-board";
import { UpcomingProjects } from "./upcoming-projects";
import { RealtimeProjectsListener } from "./realtime-projects";
import { SyncHoldedButton } from "./sync-holded-button";
import { AutoSync } from "./auto-sync";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const [
    { data: upcomingProjects },
    { data: confirmedProjects },
    { data: syncMeta },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("*, project_items(id, name, quantity, completed)")
      .eq("project_type", "upcoming")
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("*, project_items(id, name, quantity, completed)")
      .eq("project_type", "confirmed")
      .order("created_at", { ascending: false }),
    supabase
      .from("app_metadata")
      .select("value")
      .eq("key", "last_holded_sync")
      .single(),
  ]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
      <AutoSync lastSyncAt={syncMeta?.value ?? null} />
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Proyectos
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Gestiona tus proyectos de produccion
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SyncHoldedButton />
          <Link
            href="/dashboard/projects/new"
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-black"
          >
            Nuevo proyecto
          </Link>
        </div>
      </div>

      <RealtimeProjectsListener />

      <UpcomingProjects projects={upcomingProjects ?? []} />

      {!confirmedProjects || confirmedProjects.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No hay proyectos. Crea tu primer proyecto para empezar.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <KanbanBoard initialProjects={confirmedProjects} />
        </div>
      )}
    </div>
  );
}
