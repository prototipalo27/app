import { createClient } from "@supabase/supabase-js";
import { listDocuments } from "./api";
import {
  getOrCreateClientFolder,
  createProjectFolder,
} from "@/lib/google-drive/client";
import { sendPushToAll } from "@/lib/push-notifications/server";

export interface SyncResult {
  newUpcoming: number;
  converted: number;
  errors: string[];
}

export async function syncHoldedDocuments(): Promise<SyncResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service role configuration");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const result: SyncResult = { newUpcoming: 0, converted: 0, errors: [] };

  // ── Phase A: New proformas → upcoming projects ───────────

  const allProformas = await listDocuments("proform");

  // Get already-synced proforma IDs
  const { data: existingProjects } = await supabase
    .from("projects")
    .select("holded_proforma_id")
    .not("holded_proforma_id", "is", null);

  const syncedIds = new Set(
    (existingProjects ?? []).map((p) => p.holded_proforma_id),
  );

  const newProformas = allProformas.filter((p) => !syncedIds.has(p.id));

  for (const proforma of newProformas) {
    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        name: `${proforma.docNumber} — ${proforma.contactName}`,
        description: proforma.desc || null,
        project_type: "upcoming",
        status: "pending",
        price: proforma.total,
        client_name: proforma.contactName,
        holded_contact_id: proforma.contact,
        holded_proforma_id: proforma.id,
      })
      .select("id")
      .single();

    if (error) {
      result.errors.push(
        `Failed to create project for ${proforma.docNumber}: ${error.message}`,
      );
      continue;
    }

    result.newUpcoming++;

    // Notify about new project
    sendPushToAll({
      title: "Nuevo proyecto",
      body: `${proforma.docNumber} — ${proforma.contactName}`,
      url: "/dashboard",
    }).catch(() => {});

    // Create Google Drive folder structure: Client / Project / subfolders
    const driveParentId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
    if (driveParentId && project && proforma.contact) {
      try {
        // Check if client already has a Drive folder
        const { data: existing } = await supabase
          .from("client_drive_folders")
          .select("drive_folder_id")
          .eq("holded_contact_id", proforma.contact)
          .single();

        let clientFolderId: string;

        if (existing) {
          clientFolderId = existing.drive_folder_id;
        } else {
          // Create client folder and save mapping
          clientFolderId = await getOrCreateClientFolder(
            proforma.contactName,
            driveParentId,
          );
          await supabase.from("client_drive_folders").insert({
            holded_contact_id: proforma.contact,
            client_name: proforma.contactName,
            drive_folder_id: clientFolderId,
          });
        }

        // Create project folder inside client folder
        const projectFolderId = await createProjectFolder(
          proforma.docNumber,
          clientFolderId,
        );
        await supabase
          .from("projects")
          .update({ google_drive_folder_id: projectFolderId })
          .eq("id", project.id);
      } catch (driveErr) {
        result.errors.push(
          `Drive folder for ${proforma.docNumber}: ${driveErr instanceof Error ? driveErr.message : "Unknown error"}`,
        );
      }
    }

    // Create project_items from proforma products
    const products = proforma.products?.filter((p) => p.name?.trim());
    if (products?.length && project) {
      const items = products.map((prod) => ({
        project_id: project.id,
        name: prod.name.trim(),
        quantity: Math.max(1, Math.round(prod.units)),
      }));

      const { error: itemsError } = await supabase
        .from("project_items")
        .insert(items);

      if (itemsError) {
        result.errors.push(
          `Items for ${proforma.docNumber}: ${itemsError.message}`,
        );
      }
    }
  }

  // ── Phase B: Billed proformas → confirmed projects ───────

  const billedProformas = await listDocuments("proform", { billed: 1 });
  const billedIds = new Set(billedProformas.map((p) => p.id));

  const { data: upcomingProjects } = await supabase
    .from("projects")
    .select("id, holded_proforma_id, holded_contact_id, price")
    .eq("project_type", "upcoming")
    .not("holded_proforma_id", "is", null);

  for (const project of upcomingProjects ?? []) {
    if (!billedIds.has(project.holded_proforma_id)) continue;

    // Try to find matching invoice by contact + total
    let invoiceId: string | null = null;
    try {
      if (project.holded_contact_id) {
        const invoices = await listDocuments("invoice", {
          contactid: project.holded_contact_id,
        });
        const match = invoices.find(
          (inv) => Math.abs(inv.total - (project.price ?? 0)) < 0.01,
        );
        if (match) invoiceId = match.id;
      }
    } catch {
      // Invoice lookup failed — still convert the project
    }

    const { error } = await supabase
      .from("projects")
      .update({
        project_type: "confirmed",
        holded_invoice_id: invoiceId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", project.id);

    if (error) {
      result.errors.push(
        `Failed to convert project ${project.id}: ${error.message}`,
      );
    } else {
      result.converted++;
    }
  }

  return result;
}
