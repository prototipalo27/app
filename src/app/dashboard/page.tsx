import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { KanbanBoard } from "./kanban-board";
import { UpcomingProjects } from "./upcoming-projects";
import { RealtimeProjectsListener } from "./realtime-projects";
import { SyncHoldedButton } from "./sync-holded-button";
import { AutoSync } from "./auto-sync";
import { listDocuments } from "@/lib/holded/api";

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
    { data: zoneAssignments },
    { data: userProfiles },
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
    supabase.from("zone_assignments").select("user_id, zone"),
    supabase.from("user_profiles").select("id, full_name, nickname, email").eq("is_active", true),
  ]);

  // Build zone → responsible names map
  const userMap = new Map((userProfiles ?? []).map((u) => [u.id, u.nickname || u.full_name || u.email.split("@")[0]]));
  const zoneResponsibles: Record<string, string[]> = {};
  for (const za of zoneAssignments ?? []) {
    const name = userMap.get(za.user_id);
    if (name) {
      if (!zoneResponsibles[za.zone]) zoneResponsibles[za.zone] = [];
      zoneResponsibles[za.zone].push(name);
    }
  }

  // Build userId → name map for PM display
  const pmNames: Record<string, string> = {};
  for (const [id, name] of userMap) {
    pmNames[id] = name;
  }

  // Build holded invoice id → docNumber map
  const invoiceDocNumbers: Record<string, string> = {};
  try {
    const invoices = await listDocuments("invoice");
    for (const inv of invoices) {
      invoiceDocNumbers[inv.id] = inv.docNumber;
    }
  } catch {
    // Holded API error — continue without doc numbers
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
      <AutoSync lastSyncAt={syncMeta?.value ?? null} />
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-white">
            Proyectos
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Gestiona tus proyectos de produccion
          </p>
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <SyncHoldedButton />
          <Link
            href="/dashboard/projects/new"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-black"
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
          <KanbanBoard initialProjects={confirmedProjects} zoneResponsibles={zoneResponsibles} invoiceDocNumbers={invoiceDocNumbers} pmNames={pmNames} />
        </div>
      )}
    </div>
  );
}
