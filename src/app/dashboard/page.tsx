import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { KanbanBoard } from "./kanban-board";
import { UpcomingProjects } from "./upcoming-projects";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const { data: upcomingProjects } = await supabase
    .from("projects")
    .select("*, project_items(id, name, quantity, completed)")
    .eq("project_type", "upcoming")
    .order("created_at", { ascending: false });

  const { data: confirmedProjects } = await supabase
    .from("projects")
    .select("*, project_items(id, name, quantity, completed)")
    .eq("project_type", "confirmed")
    .order("created_at", { ascending: false });

  return (
    <>
      <div className="mb-6 flex shrink-0 items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Projects
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage your production projects
          </p>
        </div>
        <Link
          href="/dashboard/projects/new"
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-black"
        >
          New project
        </Link>
      </div>

      <UpcomingProjects projects={upcomingProjects ?? []} />

      {!confirmedProjects || confirmedProjects.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No projects yet. Create your first project to get started.
          </p>
        </div>
      ) : (
        <KanbanBoard initialProjects={confirmedProjects} />
      )}
    </>
  );
}
