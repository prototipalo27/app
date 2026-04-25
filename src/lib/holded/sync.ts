import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listDocuments, getContact, getDocument } from "./api";
import type { HoldedDocType } from "./types";
import {
  getOrCreateClientFolder,
  createProjectFolder,
} from "@/lib/google-drive/client";
import { sendPushForEvent } from "@/lib/push-notifications/server";
import { classifyAndApplyTemplate } from "@/lib/ai-classify-project";

export interface SyncResult {
  newUpcoming: number;
  converted: number;
  newFromInvoice: number;
  itemsBackfilled: number;
  errors: string[];
}

/**
 * Fetch the full Holded document via the single-doc endpoint (which reliably
 * includes line items, unlike the list endpoint) and insert its products as
 * project_items. By default skips if the project already has items.
 */
export async function syncProjectItemsFromHolded(
  supabase: SupabaseClient,
  projectId: string,
  docType: Extract<HoldedDocType, "invoice" | "proform">,
  documentId: string,
  opts: { skipIfHasItems?: boolean } = {},
): Promise<{ inserted: number; error?: string }> {
  const skipIfHasItems = opts.skipIfHasItems ?? true;

  if (skipIfHasItems) {
    const { count } = await supabase
      .from("project_items")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId);
    if ((count ?? 0) > 0) return { inserted: 0 };
  }

  let doc;
  try {
    doc = await getDocument(docType, documentId);
  } catch (e) {
    return {
      inserted: 0,
      error: e instanceof Error ? e.message : "Holded fetch failed",
    };
  }

  const products = (doc.products ?? []).filter((p) => p.name?.trim());
  if (products.length === 0) return { inserted: 0 };

  const items = products.map((prod) => ({
    project_id: projectId,
    name: prod.name.trim(),
    quantity: Math.max(1, Math.round(prod.units)),
  }));

  const { error } = await supabase.from("project_items").insert(items);
  if (error) return { inserted: 0, error: error.message };

  return { inserted: items.length };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function autoLinkLead(
  supabase: any,
  projectId: string,
  contactId: string,
) {
  try {
    const contact = await getContact(contactId);
    if (!contact?.email) return;

    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .ilike("email", contact.email.toLowerCase().trim())
      .limit(1)
      .single();

    if (lead) {
      await supabase
        .from("projects")
        .update({ lead_id: lead.id })
        .eq("id", projectId);
    }
  } catch {
    // Non-critical — skip if contact lookup fails
  }
}

export async function syncHoldedDocuments(): Promise<SyncResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service role configuration");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const result: SyncResult = { newUpcoming: 0, converted: 0, newFromInvoice: 0, itemsBackfilled: 0, errors: [] };

  // ── Load exclusions (deleted projects blocklist) ─────────
  const { data: exclusionRows } = await supabase
    .from("holded_sync_exclusions")
    .select("holded_document_id, doc_type");

  const excludedProformaIds = new Set(
    (exclusionRows ?? [])
      .filter((e) => e.doc_type === "proforma")
      .map((e) => e.holded_document_id),
  );
  const excludedInvoiceIds = new Set(
    (exclusionRows ?? [])
      .filter((e) => e.doc_type === "invoice")
      .map((e) => e.holded_document_id),
  );

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

  const newProformas = allProformas.filter(
    (p) => !syncedIds.has(p.id) && !excludedProformaIds.has(p.id),
  );

  for (const proforma of newProformas) {
    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        name: proforma.contactName,
        description: proforma.desc || null,
        project_type: "upcoming",
        status: "pending",
        price: proforma.total,
        client_name: proforma.contactName,
        holded_contact_id: proforma.contact,
        holded_proforma_id: proforma.id,
        invoice_date: proforma.date
          ? new Date(proforma.date * 1000).toISOString().slice(0, 10)
          : null,
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

    // Auto-link lead by contact email
    if (proforma.contact && project) {
      autoLinkLead(supabase, project.id, proforma.contact);
    }

    // Notify about new project
    sendPushForEvent("new_project", {
      title: "Nuevo proyecto",
      body: proforma.contactName,
      url: project ? `/dashboard/projects/${project.id}` : "/dashboard",
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

    // Create project_items from full proforma document (single-doc endpoint
    // is the reliable source — list endpoint sometimes omits products)
    if (project) {
      const { error: itemsError } = await syncProjectItemsFromHolded(
        supabase,
        project.id,
        "proform",
        proforma.id,
        { skipIfHasItems: false },
      );
      if (itemsError) {
        result.errors.push(`Items for ${proforma.docNumber}: ${itemsError}`);
      }
    }

    // AI: auto-classify project and apply matching template
    if (project) {
      const productNames = proforma.products
        ?.filter((p) => p.name?.trim())
        .map((p) => p.name.trim());

      // Try to get lead message for extra context
      let leadMessage: string | null = null;
      if (proforma.contact) {
        try {
          const contact = await getContact(proforma.contact);
          if (contact?.email) {
            const { data: lead } = await supabase
              .from("leads")
              .select("message")
              .ilike("email", contact.email.toLowerCase().trim())
              .limit(1)
              .single();
            leadMessage = lead?.message || null;
          }
        } catch { /* non-critical */ }
      }

      classifyAndApplyTemplate(project.id, {
        projectName: proforma.contactName,
        description: proforma.desc || null,
        products: productNames,
        leadMessage,
      }).catch((err) => console.error("AI classify error:", err));
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
    let invoiceDocNum: string | null = null;
    try {
      if (project.holded_contact_id) {
        const invoices = await listDocuments("invoice", {
          contactid: project.holded_contact_id,
        });
        const match = invoices.find(
          (inv) => Math.abs(inv.total - (project.price ?? 0)) < 0.01,
        );
        if (match) {
          invoiceId = match.id;
          invoiceDocNum = match.docNumber || null;
        }
      }
    } catch {
      // Invoice lookup failed — still convert the project
    }

    const { error } = await supabase
      .from("projects")
      .update({
        project_type: "confirmed",
        holded_invoice_id: invoiceId,
        invoice_doc_number: invoiceDocNum,
        updated_at: new Date().toISOString(),
      })
      .eq("id", project.id);

    if (error) {
      result.errors.push(
        `Failed to convert project ${project.id}: ${error.message}`,
      );
    } else {
      result.converted++;

      // Sync items from the new invoice (only if project has none — preserves
      // any items that were created from the original proforma)
      if (invoiceId) {
        const { error: itemsError } = await syncProjectItemsFromHolded(
          supabase,
          project.id,
          "invoice",
          invoiceId,
          { skipIfHasItems: true },
        );
        if (itemsError) {
          result.errors.push(
            `Items on conversion for ${invoiceDocNum ?? project.id}: ${itemsError}`,
          );
        }
      }
    }
  }

  // ── Phase C: Standalone invoices → confirmed projects ────

  const allInvoices = await listDocuments("invoice");

  // Get already-synced invoice IDs
  const { data: projectsWithInvoice } = await supabase
    .from("projects")
    .select("holded_invoice_id")
    .not("holded_invoice_id", "is", null);

  const syncedInvoiceIds = new Set(
    (projectsWithInvoice ?? []).map((p) => p.holded_invoice_id),
  );

  const newInvoices = allInvoices.filter(
    (inv) => !syncedInvoiceIds.has(inv.id) && !excludedInvoiceIds.has(inv.id),
  );

  for (const invoice of newInvoices) {
    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        name: invoice.contactName,
        description: invoice.desc || null,
        project_type: "confirmed",
        status: "pending",
        price: invoice.total,
        client_name: invoice.contactName,
        holded_contact_id: invoice.contact,
        holded_invoice_id: invoice.id,
        invoice_doc_number: invoice.docNumber || null,
        invoice_date: invoice.date
          ? new Date(invoice.date * 1000).toISOString().slice(0, 10)
          : null,
      })
      .select("id")
      .single();

    if (error) {
      result.errors.push(
        `Failed to create project from invoice ${invoice.docNumber}: ${error.message}`,
      );
      continue;
    }

    result.newFromInvoice++;

    // Auto-link lead by contact email
    if (invoice.contact && project) {
      autoLinkLead(supabase, project.id, invoice.contact);
    }

    // Notify about new project from invoice
    sendPushForEvent("new_order", {
      title: "Nuevo pedido (factura)",
      body: invoice.contactName,
      url: project ? `/dashboard/projects/${project.id}` : "/dashboard",
    }).catch(() => {});

    // Create Google Drive folder structure
    const driveParentIdInv = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
    if (driveParentIdInv && project && invoice.contact) {
      try {
        const { data: existing } = await supabase
          .from("client_drive_folders")
          .select("drive_folder_id")
          .eq("holded_contact_id", invoice.contact)
          .single();

        let clientFolderId: string;

        if (existing) {
          clientFolderId = existing.drive_folder_id;
        } else {
          clientFolderId = await getOrCreateClientFolder(
            invoice.contactName,
            driveParentIdInv,
          );
          await supabase.from("client_drive_folders").insert({
            holded_contact_id: invoice.contact,
            client_name: invoice.contactName,
            drive_folder_id: clientFolderId,
          });
        }

        const projectFolderId = await createProjectFolder(
          invoice.docNumber,
          clientFolderId,
        );
        await supabase
          .from("projects")
          .update({ google_drive_folder_id: projectFolderId })
          .eq("id", project.id);
      } catch (driveErr) {
        result.errors.push(
          `Drive folder for invoice ${invoice.docNumber}: ${driveErr instanceof Error ? driveErr.message : "Unknown error"}`,
        );
      }
    }

    // Create project_items from full invoice document (single-doc endpoint
    // is the reliable source — list endpoint sometimes omits products)
    if (project) {
      const { error: itemsError } = await syncProjectItemsFromHolded(
        supabase,
        project.id,
        "invoice",
        invoice.id,
        { skipIfHasItems: false },
      );
      if (itemsError) {
        result.errors.push(`Items for invoice ${invoice.docNumber}: ${itemsError}`);
      }
    }

    // AI: auto-classify project and apply matching template
    if (project) {
      const productNames = invoice.products
        ?.filter((p) => p.name?.trim())
        .map((p) => p.name.trim());

      classifyAndApplyTemplate(project.id, {
        projectName: invoice.contactName,
        description: invoice.desc || null,
        products: productNames,
      }).catch((err) => console.error("AI classify error:", err));
    }
  }

  // ── Phase D: Backfill invoice_date for existing projects ─
  // Uses the already-fetched proforma/invoice lists to fill NULL invoice_dates.

  const proformaDateMap = new Map<string, string>();
  for (const p of allProformas) {
    if (p.date) {
      proformaDateMap.set(p.id, new Date(p.date * 1000).toISOString().slice(0, 10));
    }
  }
  const invoiceDateMap = new Map<string, string>();
  const invoiceDocNumMap = new Map<string, string>();
  for (const inv of allInvoices) {
    if (inv.date) {
      invoiceDateMap.set(inv.id, new Date(inv.date * 1000).toISOString().slice(0, 10));
    }
    if (inv.docNumber) {
      invoiceDocNumMap.set(inv.id, inv.docNumber);
    }
  }

  const { data: missingDateProjects } = await supabase
    .from("projects")
    .select("id, holded_proforma_id, holded_invoice_id, invoice_doc_number")
    .or("invoice_date.is.null,invoice_doc_number.is.null")
    .or("holded_proforma_id.not.is.null,holded_invoice_id.not.is.null");

  for (const proj of missingDateProjects ?? []) {
    const dateFromInvoice = proj.holded_invoice_id
      ? invoiceDateMap.get(proj.holded_invoice_id)
      : undefined;
    const dateFromProforma = proj.holded_proforma_id
      ? proformaDateMap.get(proj.holded_proforma_id)
      : undefined;
    const resolvedDate = dateFromInvoice ?? dateFromProforma;
    const resolvedDocNum = proj.holded_invoice_id
      ? invoiceDocNumMap.get(proj.holded_invoice_id)
      : undefined;

    const updates: Record<string, string> = {};
    if (resolvedDate && !proj.invoice_doc_number) updates.invoice_date = resolvedDate;
    if (resolvedDocNum && !proj.invoice_doc_number) updates.invoice_doc_number = resolvedDocNum;

    if (Object.keys(updates).length > 0) {
      await supabase
        .from("projects")
        .update(updates)
        .eq("id", proj.id);
    }
  }

  // ── Phase E: Backfill missing items for existing projects ─
  // Catches projects that were synced before the single-doc fetch fix landed,
  // or where Holded's list endpoint returned an empty products array.

  const { data: candidateProjects } = await supabase
    .from("projects")
    .select("id, holded_invoice_id, holded_proforma_id, invoice_doc_number")
    .or("holded_invoice_id.not.is.null,holded_proforma_id.not.is.null");

  for (const proj of candidateProjects ?? []) {
    // Skip if project already has items
    const { count } = await supabase
      .from("project_items")
      .select("*", { count: "exact", head: true })
      .eq("project_id", proj.id);
    if ((count ?? 0) > 0) continue;

    const docType: "invoice" | "proform" | null = proj.holded_invoice_id
      ? "invoice"
      : proj.holded_proforma_id
        ? "proform"
        : null;
    const docId = proj.holded_invoice_id ?? proj.holded_proforma_id;
    if (!docType || !docId) continue;

    const { inserted, error: itemsError } = await syncProjectItemsFromHolded(
      supabase,
      proj.id,
      docType,
      docId,
      { skipIfHasItems: false },
    );
    if (itemsError) {
      result.errors.push(
        `Backfill items for ${proj.invoice_doc_number ?? proj.id}: ${itemsError}`,
      );
    } else if (inserted > 0) {
      result.itemsBackfilled += inserted;
    }
  }

  // ── Record sync timestamp ──────────────────────────────
  await supabase
    .from("app_metadata")
    .update({ value: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("key", "last_holded_sync");

  return result;
}
