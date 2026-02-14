import { createClient } from "@/lib/supabase/server";
import { QueueTimeline } from "./queue-timeline";

export const metadata = {
  title: "Cola de impresion - Prototipalo",
};

export default async function QueuePage() {
  const supabase = await createClient();

  // Fetch all printers with their type info
  const { data: printers } = await supabase
    .from("printers")
    .select("id, name, printer_type_id")
    .order("name");

  // Fetch all active print jobs (queued + printing) with item/project info
  const { data: jobs } = await supabase
    .from("print_jobs")
    .select(`
      id,
      project_item_id,
      printer_id,
      printer_type_id,
      batch_number,
      pieces_in_batch,
      estimated_minutes,
      status,
      position,
      started_at,
      completed_at,
      created_at
    `)
    .in("status", ["queued", "printing", "done"])
    .order("position", { ascending: true });

  // Fetch item names and project names for display
  const itemIds = [...new Set((jobs ?? []).map((j) => j.project_item_id))];
  let itemMap: Record<string, { name: string; project_id: string }> = {};
  let projectMap: Record<string, string> = {};

  if (itemIds.length > 0) {
    const { data: items } = await supabase
      .from("project_items")
      .select("id, name, project_id")
      .in("id", itemIds);

    if (items) {
      itemMap = Object.fromEntries(items.map((i) => [i.id, { name: i.name, project_id: i.project_id }]));

      const projectIds = [...new Set(items.map((i) => i.project_id))];
      if (projectIds.length > 0) {
        const { data: projects } = await supabase
          .from("projects")
          .select("id, name")
          .in("id", projectIds);
        if (projects) {
          projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));
        }
      }
    }
  }

  // Fetch printer types for labels
  const { data: printerTypes } = await supabase
    .from("printer_types")
    .select("id, name")
    .order("name");

  const printerTypeMap = Object.fromEntries(
    (printerTypes ?? []).map((pt) => [pt.id, pt.name])
  );

  // Enrich jobs with display info
  const enrichedJobs = (jobs ?? []).map((j) => {
    const itemInfo = itemMap[j.project_item_id];
    return {
      ...j,
      item_name: itemInfo?.name ?? "Unknown",
      project_name: itemInfo ? (projectMap[itemInfo.project_id] ?? "Unknown") : "Unknown",
      project_id: itemInfo?.project_id ?? null,
    };
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">
        Cola de impresion
      </h1>
      <QueueTimeline
        printers={(printers ?? []).map((p) => ({
          ...p,
          type_name: p.printer_type_id ? printerTypeMap[p.printer_type_id] : null,
        }))}
        jobs={enrichedJobs}
      />
    </div>
  );
}
