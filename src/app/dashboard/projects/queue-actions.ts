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

  // Fetch selected printer type to get compatible_types
  const { data: selectedType } = await supabase
    .from("printer_types")
    .select("id, compatible_types")
    .eq("id", item.printer_type_id)
    .single();

  const typeIds = [item.printer_type_id, ...(selectedType?.compatible_types ?? [])];

  // Find printers of this type OR compatible types
  const { data: printers } = await supabase
    .from("printers")
    .select("id")
    .in("printer_type_id", typeIds);

  if (!printers || printers.length === 0) {
    return { success: false, error: "No hay impresoras de este tipo disponibles" };
  }

  const now = new Date();

  // Fetch project priority for the current item
  const { data: project } = await supabase
    .from("projects")
    .select("queue_priority")
    .eq("id", item.project_id)
    .single();
  const itemPriority = project?.queue_priority ?? 0;

  // Calculate current wall-clock end-time per printer
  const printerEndTimes: Record<string, Date> = {};
  for (const p of printers) {
    printerEndTimes[p.id] = new Date(now);
  }

  // Fetch existing jobs with their project priority (via project_items → projects)
  const { data: existingJobs } = await supabase
    .from("print_jobs")
    .select("printer_id, estimated_minutes, project_item_id")
    .in("printer_id", printers.map((p) => p.id))
    .in("status", ["queued", "printing"]);

  if (existingJobs && existingJobs.length > 0) {
    // Get unique item IDs to fetch their project priorities
    const existingItemIds = [...new Set(existingJobs.map((j) => j.project_item_id))];
    const { data: existingItems } = await supabase
      .from("project_items")
      .select("id, project_id")
      .in("id", existingItemIds);

    const itemProjectMap: Record<string, string> = {};
    if (existingItems) {
      for (const ei of existingItems) {
        itemProjectMap[ei.id] = ei.project_id;
      }
    }

    const projectIds = [...new Set(Object.values(itemProjectMap))];
    const { data: projects } = await supabase
      .from("projects")
      .select("id, queue_priority")
      .in("id", projectIds);

    const projectPriorityMap: Record<string, number> = {};
    if (projects) {
      for (const p of projects) {
        projectPriorityMap[p.id] = p.queue_priority;
      }
    }

    // Only sum load from jobs with priority >= the current item's priority
    // This way urgent jobs "skip ahead" of lower-priority ones
    const loadMinutes: Record<string, number> = {};
    for (const job of existingJobs) {
      if (job.printer_id) {
        const jobProjectId = itemProjectMap[job.project_item_id];
        const jobPriority = jobProjectId ? (projectPriorityMap[jobProjectId] ?? 0) : 0;
        if (jobPriority >= itemPriority) {
          loadMinutes[job.printer_id] = (loadMinutes[job.printer_id] || 0) + job.estimated_minutes;
        }
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

export async function reorderPrintJobs(
  printerId: string,
  orderedJobIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) redirect("/login");

    // Fetch current queued/printing jobs for this printer
    const { data: currentJobs } = await supabase
      .from("print_jobs")
      .select("id, status, estimated_minutes")
      .eq("printer_id", printerId)
      .in("status", ["queued", "printing"])
      .order("position", { ascending: true });

    if (!currentJobs) return { success: false, error: "No se pudieron obtener los jobs" };

    // Validate IDs match
    const currentIds = new Set(currentJobs.map((j) => j.id));
    const orderedIds = new Set(orderedJobIds);
    if (currentIds.size !== orderedIds.size || ![...currentIds].every((id) => orderedIds.has(id))) {
      return { success: false, error: "Los IDs no coinciden con los jobs actuales" };
    }

    // Build a map for quick lookup
    const jobMap = new Map(currentJobs.map((j) => [j.id, j]));

    // Printing jobs stay at the top — collect them and remove from ordered list
    const printingIds = currentJobs.filter((j) => j.status === "printing").map((j) => j.id);
    const queuedOrder = orderedJobIds.filter((id) => !printingIds.includes(id));
    const finalOrder = [...printingIds, ...queuedOrder];

    // Recalculate position and scheduled_start
    const now = new Date();
    let cursor = new Date(now);

    const updates: Array<{ id: string; position: number; scheduled_start: string }> = [];
    for (let i = 0; i < finalOrder.length; i++) {
      const job = jobMap.get(finalOrder[i])!;
      updates.push({
        id: job.id,
        position: i,
        scheduled_start: cursor.toISOString(),
      });
      cursor = addWorkMinutes(cursor, job.estimated_minutes);
    }

    // Apply updates
    for (const u of updates) {
      const { error } = await supabase
        .from("print_jobs")
        .update({ position: u.position, scheduled_start: u.scheduled_start })
        .eq("id", u.id);
      if (error) return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/queue");
    revalidatePath("/dashboard/printers");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Error desconocido" };
  }
}
