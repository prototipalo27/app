import { createClient } from "@/lib/supabase/server";
import { QueueTimeline } from "./queue-timeline";
import { QueueSettings } from "./queue-settings";
import { getLaunchSettings } from "@/lib/launch-settings";

export const metadata = {
  title: "Cola de impresion - Prototipalo",
};

export default async function QueuePage() {
  const supabase = await createClient();

  // Fetch printers, jobs, and printer types in parallel
  const [{ data: printers }, { data: jobs }, { data: printerTypes }] = await Promise.all([
    supabase
      .from("printers")
      .select("id, name, printer_type_id")
      .order("name"),
    supabase
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
        scheduled_start,
        started_at,
        completed_at,
        created_at,
        gcode_filename
      `)
      .in("status", ["queued", "printing", "done"])
      .order("position", { ascending: true }),
    supabase
      .from("printer_types")
      .select("id, name")
      .order("name"),
  ]);

  // Fetch item + project names + priority in a single query using nested selects
  const itemIds = [...new Set((jobs ?? []).map((j) => j.project_item_id))];
  let itemMap: Record<string, { name: string; project_id: string; project_name: string; queue_priority: number }> = {};

  if (itemIds.length > 0) {
    const { data: items } = await supabase
      .from("project_items")
      .select("id, name, project_id, projects(name, queue_priority)")
      .in("id", itemIds);

    if (items) {
      itemMap = Object.fromEntries(
        items.map((i) => {
          const proj = i.projects as unknown as { name: string; queue_priority: number } | null;
          return [
            i.id,
            {
              name: i.name,
              project_id: i.project_id,
              project_name: proj?.name ?? "Unknown",
              queue_priority: proj?.queue_priority ?? 0,
            },
          ];
        })
      );
    }
  }

  const launchSettings = await getLaunchSettings(supabase);

  const printerTypeMap = Object.fromEntries(
    (printerTypes ?? []).map((pt) => [pt.id, pt.name])
  );

  // Enrich jobs with display info
  const enrichedJobs = (jobs ?? []).map((j) => {
    const itemInfo = itemMap[j.project_item_id];
    return {
      ...j,
      item_name: itemInfo?.name ?? "Unknown",
      project_name: itemInfo?.project_name ?? "Unknown",
      project_id: itemInfo?.project_id ?? null,
      queue_priority: itemInfo?.queue_priority ?? 0,
    };
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Cola de impresion
        </h1>
        <QueueSettings
          launchStartTime={launchSettings.launchStartTime}
          launchEndTime={launchSettings.launchEndTime}
        />
      </div>
      <QueueTimeline
        printers={(printers ?? []).map((p) => ({
          ...p,
          type_name: p.printer_type_id ? printerTypeMap[p.printer_type_id] : null,
        }))}
        jobs={enrichedJobs}
        startTime={new Date().toISOString()}
        launchSettings={launchSettings}
      />
    </div>
  );
}
