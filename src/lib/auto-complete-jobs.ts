import { SupabaseClient } from "@supabase/supabase-js";

interface PrinterState {
  serial_number: string;
  gcode_state: string | null;
  current_file: string | null;
}

/**
 * Auto-completes print jobs when a printer finishes printing a file
 * whose name matches a project item's file_keyword.
 *
 * Called after each sync cycle (Bambu / Elegoo).
 */
export async function autoCompleteByKeyword(
  supabase: SupabaseClient,
  prevPrinters: PrinterState[],
  currentPrinters: Array<{ serial_number: string; gcode_state: string | null }>
) {
  // Find printers that transitioned from RUNNING to something else
  const finished: { serial_number: string; current_file: string }[] = [];

  for (const curr of currentPrinters) {
    if (curr.gcode_state === "RUNNING") continue; // still printing

    const prev = prevPrinters.find(
      (p) => p.serial_number === curr.serial_number
    );
    if (!prev || prev.gcode_state !== "RUNNING" || !prev.current_file) continue;

    finished.push({
      serial_number: curr.serial_number,
      current_file: prev.current_file,
    });
  }

  if (finished.length === 0) return;

  // Fetch all project items with a file_keyword, belonging to active projects
  const completedStatuses = ["delivered", "shipping"];

  const { data: items } = await supabase
    .from("project_items")
    .select("id, file_keyword, completed, quantity, project_id, projects!inner(status)")
    .not("file_keyword", "is", null)
    .not("projects.status", "in", `(${completedStatuses.join(",")})`);

  if (!items || items.length === 0) return;

  for (const printer of finished) {
    const filenameLower = printer.current_file.toLowerCase();

    for (const item of items) {
      if (!item.file_keyword) continue;
      if (!filenameLower.includes(item.file_keyword.toLowerCase())) continue;
      if (item.completed >= item.quantity) continue;

      // Find the first queued or printing job for this item
      const { data: job } = await supabase
        .from("print_jobs")
        .select("id, pieces_in_batch")
        .eq("project_item_id", item.id)
        .in("status", ["queued", "printing"])
        .order("position", { ascending: true })
        .limit(1)
        .single();

      if (!job) continue;

      // Mark job as done
      await supabase
        .from("print_jobs")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", job.id);

      // Update item completed count
      const newCompleted = Math.min(
        item.completed + job.pieces_in_batch,
        item.quantity
      );
      await supabase
        .from("project_items")
        .update({ completed: newCompleted })
        .eq("id", item.id);

      // Update local state so subsequent matches for same item use fresh count
      item.completed = newCompleted;

      console.log(
        `[auto-complete] Printer ${printer.serial_number} finished "${printer.current_file}" → ` +
          `matched keyword "${item.file_keyword}" → job ${job.id} done (${newCompleted}/${item.quantity})`
      );

      // Only complete one job per printer per sync
      break;
    }
  }
}
