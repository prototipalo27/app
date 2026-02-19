import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import PrinterGrid from "./printer-grid";
import { QueueTimeline } from "../queue/queue-timeline";
import { PrinterStats } from "./printer-stats";
import { WORK_DAY_MINUTES } from "@/lib/schedule";
import { getLaunchSettings } from "@/lib/launch-settings";

export const metadata = {
  title: "Printers - Prototipalo",
};

export default async function PrintersPage() {
  const supabase = await createClient();
  const launchSettings = await getLaunchSettings(supabase);

  // Date 30 days ago for stats query
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const statsFrom = thirtyDaysAgo.toISOString().slice(0, 10);

  // Fetch printers, types, jobs, and stats in parallel
  const [{ data: printers }, { data: printerTypes }, { data: jobs }, { data: rawStats }] = await Promise.all([
    supabase.from("printers").select("*").order("name"),
    supabase.from("printer_types").select("*").order("name"),
    supabase
      .from("print_jobs")
      .select("id, printer_id, batch_number, pieces_in_batch, estimated_minutes, status, project_item_id, position, scheduled_start")
      .in("status", ["queued", "printing"])
      .order("position", { ascending: true }),
    supabase
      .from("printer_daily_stats")
      .select("printer_id, date, printing_seconds")
      .gte("date", statsFrom)
      .order("date"),
  ]);

  // Enrich with item + project names + priority in a single query using nested selects
  const itemIds = [...new Set((jobs ?? []).map((j) => j.project_item_id))];
  let enrichedJobs: Array<{
    id: string;
    printer_id: string | null;
    batch_number: number;
    pieces_in_batch: number;
    estimated_minutes: number;
    status: string;
    position: number;
    scheduled_start: string | null;
    project_item_id: string;
    item_name: string;
    project_name: string;
    project_id: string | null;
    queue_priority: number;
  }> = [];

  if (itemIds.length > 0) {
    const { data: items } = await supabase
      .from("project_items")
      .select("id, name, project_id, projects(name, queue_priority)")
      .in("id", itemIds);

    const itemMap = Object.fromEntries(
      (items ?? []).map((i) => {
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

    enrichedJobs = (jobs ?? []).map((j) => {
      const item = itemMap[j.project_item_id];
      return {
        id: j.id,
        printer_id: j.printer_id,
        batch_number: j.batch_number,
        pieces_in_batch: j.pieces_in_batch,
        estimated_minutes: j.estimated_minutes,
        status: j.status,
        position: j.position,
        scheduled_start: j.scheduled_start,
        project_item_id: j.project_item_id,
        item_name: item?.name ?? "Unknown",
        project_name: item?.project_name ?? "Unknown",
        project_id: item?.project_id ?? null,
        queue_priority: item?.queue_priority ?? 0,
      };
    });
  }

  // Enrich stats with printer names
  const printerNameMap = new Map((printers ?? []).map((p) => [p.id, p.name as string]));
  const dailyStats = (rawStats ?? []).map((s) => ({
    printer_id: s.printer_id as string,
    printer_name: printerNameMap.get(s.printer_id) ?? "Unknown",
    date: s.date as string,
    printing_seconds: s.printing_seconds as number,
  }));

  // Build printer infos for QueueTimeline
  const typeMap = Object.fromEntries((printerTypes ?? []).map((t) => [t.id, t.name]));
  const printerInfos = (printers ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    printer_type_id: p.printer_type_id,
    type_name: p.printer_type_id ? typeMap[p.printer_type_id] ?? null : null,
  }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Impresoras
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/settings/printers"
            className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            title="Horas impresoras"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Horas
          </Link>
          <Link
            href="/dashboard/queue"
            className="flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Cola de impresion
          </Link>
        </div>
      </div>

      {/* Timeline Gantt */}
      <div className="mb-6">
        <QueueTimeline
          printers={printerInfos}
          jobs={enrichedJobs}
          startTime={new Date().toISOString()}
          launchSettings={launchSettings}
        />
      </div>

      {/* Printing Stats */}
      <div className="mb-6">
        <PrinterStats stats={dailyStats} workDayMinutes={WORK_DAY_MINUTES} />
      </div>

      <PrinterGrid initialPrinters={printers ?? []} printerTypes={printerTypes ?? []} />
    </div>
  );
}
