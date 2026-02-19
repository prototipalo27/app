import { SupabaseClient } from "@supabase/supabase-js";
import { parseJobFilename } from "@/lib/print-job-naming";

interface PrinterState {
  serial_number: string;
  gcode_state: string | null;
  current_file: string | null;
}

/**
 * Auto-track print jobs based on printer state transitions:
 * - IDLE/other → RUNNING: mark the first queued job on that printer as 'printing'
 * - RUNNING → FINISH/IDLE: mark the 'printing' job on that printer as 'done',
 *   update item completed count, and auto-update project status
 */
export async function autoTrackPrintJobs(
  supabase: SupabaseClient,
  prevPrinters: PrinterState[],
  currentPrinters: PrinterState[]
) {
  // Build lookup of serial_number → printer id
  const { data: printerRows } = await supabase
    .from("printers")
    .select("id, serial_number");
  if (!printerRows) return;

  const serialToId = new Map(printerRows.map((p) => [p.serial_number, p.id]));

  for (const curr of currentPrinters) {
    const prev = prevPrinters.find((p) => p.serial_number === curr.serial_number);
    if (!prev) continue;

    const printerId = serialToId.get(curr.serial_number);
    if (!printerId) continue;

    const prevState = prev.gcode_state ?? "";
    const currState = curr.gcode_state ?? "";

    // Transition to RUNNING → mark first queued job as printing
    if (currState === "RUNNING" && prevState !== "RUNNING") {
      await handleStartPrinting(supabase, printerId, curr.current_file);
    }

    // Transition from RUNNING to FINISH/IDLE/PAUSE → mark printing job as done
    if (
      prevState === "RUNNING" &&
      currState !== "RUNNING" &&
      (currState === "FINISH" || currState === "IDLE" || currState === "FAILED")
    ) {
      if (currState === "FAILED") {
        await handleFailedPrint(supabase, printerId);
      } else {
        await handleFinishPrint(supabase, printerId);
      }
    }
  }
}

async function handleStartPrinting(
  supabase: SupabaseClient,
  printerId: string,
  currentFile: string | null
) {
  // Find the first queued job on this printer (lowest position)
  const { data: job } = await supabase
    .from("print_jobs")
    .select("id, gcode_filename, project_item_id")
    .eq("printer_id", printerId)
    .eq("status", "queued")
    .order("position", { ascending: true })
    .limit(1)
    .single();

  if (!job) return;

  // If the file follows PRJ convention, validate it matches the expected job
  if (currentFile) {
    const parsed = parseJobFilename(currentFile);
    if (parsed && job.gcode_filename) {
      const expectedParsed = parseJobFilename(job.gcode_filename);
      if (expectedParsed && parsed.projectShortId !== expectedParsed.projectShortId) {
        console.log(
          `[auto-track] Printer ${printerId}: file "${currentFile}" doesn't match expected ` +
            `"${job.gcode_filename}" — skipping auto-start`
        );
        return;
      }
    }
  }

  await supabase
    .from("print_jobs")
    .update({ status: "printing", started_at: new Date().toISOString() })
    .eq("id", job.id);

  // Auto-update project status to "printing"
  const { data: item } = await supabase
    .from("project_items")
    .select("project_id")
    .eq("id", job.project_item_id)
    .single();

  if (item) {
    const { data: project } = await supabase
      .from("projects")
      .select("status")
      .eq("id", item.project_id)
      .single();

    if (project && (project.status === "pending" || project.status === "design")) {
      await supabase
        .from("projects")
        .update({ status: "printing" })
        .eq("id", item.project_id);
    }
  }

  console.log(
    `[auto-track] Printer ${printerId}: RUNNING detected → job ${job.id} marked as printing`
  );
}

async function handleFinishPrint(supabase: SupabaseClient, printerId: string) {
  // Find the job currently printing on this printer
  const { data: job } = await supabase
    .from("print_jobs")
    .select("id, project_item_id, pieces_in_batch")
    .eq("printer_id", printerId)
    .eq("status", "printing")
    .limit(1)
    .single();

  if (!job) return;

  // Mark job as done
  await supabase
    .from("print_jobs")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", job.id);

  // Update item completed count
  const { data: item } = await supabase
    .from("project_items")
    .select("project_id, completed, quantity")
    .eq("id", job.project_item_id)
    .single();

  if (item) {
    const newCompleted = Math.min(item.completed + job.pieces_in_batch, item.quantity);
    await supabase
      .from("project_items")
      .update({ completed: newCompleted })
      .eq("id", job.project_item_id);

    // Check if all items in the project are complete
    const { data: allItems } = await supabase
      .from("project_items")
      .select("quantity, completed")
      .eq("project_id", item.project_id);

    if (allItems) {
      // Use the fresh completed count for the current item
      const allComplete = allItems.every((i) =>
        i.completed >= i.quantity ||
        (i.completed === item.completed && newCompleted >= item.quantity)
      );

      if (allComplete) {
        const { data: project } = await supabase
          .from("projects")
          .select("status")
          .eq("id", item.project_id)
          .single();

        if (project && !["post_processing", "qc", "shipping", "delivered"].includes(project.status)) {
          await supabase
            .from("projects")
            .update({ status: "post_processing" })
            .eq("id", item.project_id);
        }
      }
    }
  }

  console.log(
    `[auto-track] Printer ${printerId}: FINISH detected → job ${job.id} marked as done`
  );
}

async function handleFailedPrint(supabase: SupabaseClient, printerId: string) {
  const { data: job } = await supabase
    .from("print_jobs")
    .select("id")
    .eq("printer_id", printerId)
    .eq("status", "printing")
    .limit(1)
    .single();

  if (!job) return;

  await supabase
    .from("print_jobs")
    .update({ status: "failed" })
    .eq("id", job.id);

  console.log(
    `[auto-track] Printer ${printerId}: FAILED detected → job ${job.id} marked as failed`
  );
}
