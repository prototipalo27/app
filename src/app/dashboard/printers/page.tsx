import { createClient } from "@/lib/supabase/server";
import PrinterGrid from "./printer-grid";

export const metadata = {
  title: "Printers - Prototipalo",
};

export default async function PrintersPage() {
  const supabase = await createClient();

  const { data: printers } = await supabase
    .from("printers")
    .select("*")
    .order("name");

  // Fetch active print jobs for all printers
  const { data: jobs } = await supabase
    .from("print_jobs")
    .select("id, printer_id, batch_number, pieces_in_batch, estimated_minutes, status, project_item_id")
    .in("status", ["queued", "printing"])
    .order("position", { ascending: true });

  // Enrich with item/project names
  const itemIds = [...new Set((jobs ?? []).map((j) => j.project_item_id))];
  let enrichedJobs: Array<{
    id: string;
    printer_id: string | null;
    batch_number: number;
    pieces_in_batch: number;
    estimated_minutes: number;
    status: string;
    item_name: string;
    project_name: string;
  }> = [];

  if (itemIds.length > 0) {
    const { data: items } = await supabase
      .from("project_items")
      .select("id, name, project_id")
      .in("id", itemIds);

    const itemMap = Object.fromEntries((items ?? []).map((i) => [i.id, i]));
    const projectIds = [...new Set((items ?? []).map((i) => i.project_id))];
    const { data: projects } = await supabase
      .from("projects")
      .select("id, name")
      .in("id", projectIds);
    const projectMap = Object.fromEntries((projects ?? []).map((p) => [p.id, p.name]));

    enrichedJobs = (jobs ?? []).map((j) => {
      const item = itemMap[j.project_item_id];
      return {
        id: j.id,
        printer_id: j.printer_id,
        batch_number: j.batch_number,
        pieces_in_batch: j.pieces_in_batch,
        estimated_minutes: j.estimated_minutes,
        status: j.status,
        item_name: item?.name ?? "Unknown",
        project_name: item ? (projectMap[item.project_id] ?? "Unknown") : "Unknown",
      };
    });
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">
        Printers
      </h1>
      <PrinterGrid initialPrinters={printers ?? []} initialJobs={enrichedJobs} />
    </div>
  );
}
