"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { addWorkMinutes } from "@/lib/schedule";

export async function updateItemPrintConfig(
  itemId: string,
  printTimeMinutes: number | null,
  printerTypeId: string | null,
  stlVolumeCm3?: number | null,
  stlFileId?: string | null
) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) redirect("/login");

  const { data: item } = await supabase
    .from("project_items")
    .select("project_id")
    .eq("id", itemId)
    .single();
  if (!item) throw new Error("Item not found");

  const update: Record<string, unknown> = {
    print_time_minutes: printTimeMinutes,
    printer_type_id: printerTypeId,
  };
  if (stlVolumeCm3 !== undefined) update.stl_volume_cm3 = stlVolumeCm3;
  if (stlFileId !== undefined) update.stl_file_id = stlFileId;

  const { error } = await supabase
    .from("project_items")
    .update(update)
    .eq("id", itemId);

  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/projects/${item.project_id}`);
}

export async function generatePrintJobs(itemId: string): Promise<{ success: boolean; error?: string }> {
  try {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) redirect("/login");

  // Fetch item
  const { data: item } = await supabase
    .from("project_items")
    .select("*")
    .eq("id", itemId)
    .single();
  if (!item) return { success: false, error: "Item no encontrado" };
  if (!item.print_time_minutes) return { success: false, error: "Tiempo de impresion no configurado" };
  if (!item.printer_type_id) return { success: false, error: "Tipo de impresora no seleccionado" };

  // Delete existing queued jobs for this item
  await supabase
    .from("print_jobs")
    .delete()
    .eq("project_item_id", itemId)
    .in("status", ["queued"]);

  const batchSize = item.batch_size || 1;
  const totalBatches = Math.ceil(item.quantity / batchSize);

  // Find printers of this type
  const { data: printers } = await supabase
    .from("printers")
    .select("id")
    .eq("printer_type_id", item.printer_type_id);

  if (!printers || printers.length === 0) {
    return { success: false, error: "No hay impresoras de este tipo disponibles" };
  }

  const now = new Date();

  // Calculate current wall-clock end-time per printer
  const printerEndTimes: Record<string, Date> = {};
  for (const p of printers) {
    printerEndTimes[p.id] = new Date(now);
  }

  const { data: existingJobs } = await supabase
    .from("print_jobs")
    .select("printer_id, estimated_minutes")
    .in("printer_id", printers.map((p) => p.id))
    .in("status", ["queued", "printing"]);

  if (existingJobs) {
    // Sum existing load per printer, then convert to wall-clock end time
    const loadMinutes: Record<string, number> = {};
    for (const job of existingJobs) {
      if (job.printer_id) {
        loadMinutes[job.printer_id] = (loadMinutes[job.printer_id] || 0) + job.estimated_minutes;
      }
    }
    for (const [pid, mins] of Object.entries(loadMinutes)) {
      printerEndTimes[pid] = addWorkMinutes(now, mins);
    }
  }

  // Calculate existing job counts per printer for position tracking
  const printerPositions: Record<string, number> = {};
  for (const p of printers) {
    printerPositions[p.id] = 0;
  }
  if (existingJobs) {
    for (const job of existingJobs) {
      if (job.printer_id) {
        printerPositions[job.printer_id] = (printerPositions[job.printer_id] || 0) + 1;
      }
    }
  }

  // Generate and assign batches with greedy wall-clock load balancing
  const jobs: Array<{
    project_item_id: string;
    printer_id: string;
    printer_type_id: string;
    batch_number: number;
    pieces_in_batch: number;
    estimated_minutes: number;
    position: number;
    scheduled_start: string;
  }> = [];

  for (let b = 0; b < totalBatches; b++) {
    const piecesInBatch = Math.min(batchSize, item.quantity - b * batchSize);

    // Find printer with earliest end time (least loaded in wall-clock)
    let minPrinterId = printers[0].id;
    let minEnd = printerEndTimes[minPrinterId].getTime();
    for (const p of printers) {
      const t = printerEndTimes[p.id].getTime();
      if (t < minEnd) {
        minEnd = t;
        minPrinterId = p.id;
      }
    }

    const scheduledStart = new Date(printerEndTimes[minPrinterId]);

    jobs.push({
      project_item_id: itemId,
      printer_id: minPrinterId,
      printer_type_id: item.printer_type_id,
      batch_number: b + 1,
      pieces_in_batch: piecesInBatch,
      estimated_minutes: item.print_time_minutes,
      position: printerPositions[minPrinterId],
      scheduled_start: scheduledStart.toISOString(),
    });

    printerEndTimes[minPrinterId] = addWorkMinutes(scheduledStart, item.print_time_minutes);
    printerPositions[minPrinterId] += 1;
  }

  // Insert all jobs
  const { error } = await supabase.from("print_jobs").insert(jobs);
  if (error) return { success: false, error: `Error al insertar jobs: ${error.message}` };

  revalidatePath(`/dashboard/projects/${item.project_id}`);
  revalidatePath("/dashboard/queue");
  revalidatePath("/dashboard/printers");

  return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Error desconocido al generar cola" };
  }
}

export async function cancelPrintJob(jobId: string) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) redirect("/login");

  const { data: job } = await supabase
    .from("print_jobs")
    .select("project_item_id")
    .eq("id", jobId)
    .single();

  const { error } = await supabase
    .from("print_jobs")
    .update({ status: "cancelled" })
    .eq("id", jobId);
  if (error) throw new Error(error.message);

  if (job) {
    const { data: item } = await supabase
      .from("project_items")
      .select("project_id")
      .eq("id", job.project_item_id)
      .single();
    if (item) revalidatePath(`/dashboard/projects/${item.project_id}`);
  }
  revalidatePath("/dashboard/queue");
  revalidatePath("/dashboard/printers");
}

export async function completePrintJob(jobId: string) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) redirect("/login");

  const { data: job } = await supabase
    .from("print_jobs")
    .select("project_item_id, pieces_in_batch")
    .eq("id", jobId)
    .single();
  if (!job) throw new Error("Job not found");

  // Mark job as done
  const { error } = await supabase
    .from("print_jobs")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) throw new Error(error.message);

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
    revalidatePath(`/dashboard/projects/${item.project_id}`);
  }

  revalidatePath("/dashboard/queue");
  revalidatePath("/dashboard/printers");
}

export async function startPrintJob(jobId: string) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) redirect("/login");

  const { error } = await supabase
    .from("print_jobs")
    .update({ status: "printing", started_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/queue");
  revalidatePath("/dashboard/printers");
}

export async function reassignPrintJob(jobId: string, newPrinterId: string) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) redirect("/login");

  const { error } = await supabase
    .from("print_jobs")
    .update({ printer_id: newPrinterId })
    .eq("id", jobId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/queue");
  revalidatePath("/dashboard/printers");
}
