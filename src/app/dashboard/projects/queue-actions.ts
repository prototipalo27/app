"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

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

export async function generatePrintJobs(itemId: string) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) redirect("/login");

  // Fetch item
  const { data: item } = await supabase
    .from("project_items")
    .select("*")
    .eq("id", itemId)
    .single();
  if (!item) throw new Error("Item not found");
  if (!item.print_time_minutes) throw new Error("Print time not set");
  if (!item.printer_type_id) throw new Error("Printer type not set");

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
    throw new Error("No printers of this type available");
  }

  // Calculate current load per printer (sum of estimated_minutes for queued/printing jobs)
  const printerLoads: Record<string, number> = {};
  for (const p of printers) {
    printerLoads[p.id] = 0;
  }

  const { data: existingJobs } = await supabase
    .from("print_jobs")
    .select("printer_id, estimated_minutes")
    .in("printer_id", printers.map((p) => p.id))
    .in("status", ["queued", "printing"]);

  if (existingJobs) {
    for (const job of existingJobs) {
      if (job.printer_id) {
        printerLoads[job.printer_id] = (printerLoads[job.printer_id] || 0) + job.estimated_minutes;
      }
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

  // Generate and assign batches with greedy load balancing
  const jobs: Array<{
    project_item_id: string;
    printer_id: string;
    printer_type_id: string;
    batch_number: number;
    pieces_in_batch: number;
    estimated_minutes: number;
    position: number;
  }> = [];

  for (let b = 0; b < totalBatches; b++) {
    const piecesInBatch = Math.min(batchSize, item.quantity - b * batchSize);

    // Find printer with minimum load
    let minPrinterId = printers[0].id;
    let minLoad = printerLoads[minPrinterId];
    for (const p of printers) {
      if (printerLoads[p.id] < minLoad) {
        minLoad = printerLoads[p.id];
        minPrinterId = p.id;
      }
    }

    jobs.push({
      project_item_id: itemId,
      printer_id: minPrinterId,
      printer_type_id: item.printer_type_id,
      batch_number: b + 1,
      pieces_in_batch: piecesInBatch,
      estimated_minutes: item.print_time_minutes,
      position: printerPositions[minPrinterId],
    });

    printerLoads[minPrinterId] += item.print_time_minutes;
    printerPositions[minPrinterId] += 1;
  }

  // Insert all jobs
  const { error } = await supabase.from("print_jobs").insert(jobs);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/projects/${item.project_id}`);
  revalidatePath("/dashboard/queue");
  revalidatePath("/dashboard/printers");
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
