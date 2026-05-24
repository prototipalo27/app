import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { KanbanBoard } from "./kanban-board";
import { RealtimeProjectsListener } from "./realtime-projects";
import { SyncHoldedButton } from "./sync-holded-button";
import { AutoSync } from "./auto-sync";
import {
  getSharedUserProfiles,
  getSharedZoneAssignments,
} from "@/lib/supabase/cached-queries";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  // Fresh queries (change frequently / have realtime) + cached queries (stable data)
  const [
    { data: confirmedProjects },
    { data: syncMeta },
    zoneAssignments,
    userProfiles,
  ] = await Promise.all([
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
    getSharedZoneAssignments(),       // cached: hours
    getSharedUserProfiles(),          // cached: hours
  ]);

  // Build zone → responsible names map
  const userMap = new Map(userProfiles.map((u) => [u.id, u.nickname || u.full_name || u.email.split("@")[0]]));
  const zoneResponsibles: Record<string, string[]> = {};
  for (const za of zoneAssignments) {
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

  // Build holded invoice id → docNumber map from persisted data
  const invoiceDocNumbers: Record<string, string> = {};
  for (const p of (confirmedProjects ?? [])) {
    if (p.holded_invoice_id && p.invoice_doc_number) {
      invoiceDocNumbers[p.holded_invoice_id] = p.invoice_doc_number;
    }
  }

  // Default shipping city per project — fetched in batch by holded_contact_id.
  const contactIds = Array.from(
    new Set(
      (confirmedProjects ?? [])
        .map((p) => p.holded_contact_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const cityByProject: Record<string, string> = {};
  if (contactIds.length > 0) {
    const { data: addresses } = await supabase
      .from("client_addresses")
      .select("holded_contact_id, city, is_default, created_at")
      .in("holded_contact_id", contactIds)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    const cityByContact = new Map<string, string>();
    for (const a of addresses ?? []) {
      if (a.city && !cityByContact.has(a.holded_contact_id)) {
        cityByContact.set(a.holded_contact_id, a.city);
      }
    }
    for (const p of confirmedProjects ?? []) {
      if (p.holded_contact_id) {
        const city = cityByContact.get(p.holded_contact_id);
        if (city) cityByProject[p.id] = city;
      }
    }
  }

  // pickup_in_person flag per project (via lead_id → quote_requests)
  const leadIds = Array.from(
    new Set(
      (confirmedProjects ?? [])
        .map((p) => p.lead_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const pickupByProject: Record<string, boolean> = {};
  if (leadIds.length > 0) {
    const { data: quoteRequests } = await supabase
      .from("quote_requests")
      .select("lead_id, pickup_in_person")
      .in("lead_id", leadIds);

    const pickupByLead = new Map<string, boolean>();
    for (const qr of quoteRequests ?? []) {
      if (qr.pickup_in_person) pickupByLead.set(qr.lead_id, true);
    }
    for (const p of confirmedProjects ?? []) {
      if (p.lead_id && pickupByLead.get(p.lead_id)) {
        pickupByProject[p.id] = true;
      }
    }
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

      {!confirmedProjects || confirmedProjects.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No hay proyectos. Crea tu primer proyecto para empezar.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <KanbanBoard initialProjects={confirmedProjects} zoneResponsibles={zoneResponsibles} invoiceDocNumbers={invoiceDocNumbers} pmNames={pmNames} cityByProject={cityByProject} pickupByProject={pickupByProject} />
        </div>
      )}
    </div>
  );
}
