"use server";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import {
  parseMrwInvoicePdf,
  computeInvoiceTotals,
  proratedLineCost,
} from "@/lib/shipping/mrw-invoice";

export interface PreviewLine {
  albaran: string;
  date: string | null;
  service: string | null;
  kind: "delivery" | "pickup";
  party_name: string | null;
  city: string | null;
  postal_code: string | null;
  /** Importe base de la línea (sin recargos). */
  amount: number;
  /** Coste imputado = base + parte prorrateada de recargos. */
  proratedCost: number;
  /** Envío existente casado por albarán (si lo hay). */
  shippingInfoId: string | null;
  /** Proyecto asignado (auto por albarán, luego editable en la revisión). */
  projectId: string | null;
  projectName: string | null;
  clientName: string | null;
  matchType: "albaran" | "none";
}

export interface InvoicePreview {
  invoiceNumber: string | null;
  invoiceDate: string | null;
  period: string | null;
  costCenter: string | null;
  linesAmount: number;
  surchargeAmount: number;
  grossAmount: number;
  taxAmount: number | null;
  totalAmount: number | null;
  prorationFactor: number;
  surcharges: { concept: string; amount: number }[];
  lines: PreviewLine[];
  alreadyImported: boolean;
}

type MatchRow = {
  id: string;
  mrw_albaran: string | null;
  project_id: string | null;
  projects: { name: string | null; client_name: string | null } | null;
};

export async function previewMrwInvoice(
  formData: FormData,
): Promise<InvoicePreview> {
  await requireRole("manager");

  const file = formData.get("file") as File | null;
  if (!file) throw new Error("Falta el archivo PDF de la factura");
  if (file.type && file.type !== "application/pdf") {
    throw new Error("El archivo debe ser un PDF");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const inv = await parseMrwInvoicePdf(buffer);
  if (inv.lines.length === 0) {
    throw new Error(
      "No se detectaron envíos en el PDF. ¿Es el resumen mensual de MRW?",
    );
  }
  const totals = computeInvoiceTotals(inv);

  const supabase = await createClient();

  const [{ data: existing }, { data: matchesRaw }] = await Promise.all([
    supabase
      .from("carrier_invoices")
      .select("id")
      .eq("carrier", "MRW")
      .eq("invoice_number", inv.invoice_number ?? "__none__")
      .maybeSingle(),
    supabase
      .from("shipping_info")
      .select("id, mrw_albaran, project_id, projects(name, client_name)")
      .in(
        "mrw_albaran",
        inv.lines.map((l) => l.albaran),
      ),
  ]);

  const byAlbaran = new Map<string, MatchRow>();
  for (const m of (matchesRaw ?? []) as unknown as MatchRow[]) {
    // Preferimos la primera fila con proyecto asignado por albarán.
    if (m.mrw_albaran && !byAlbaran.has(m.mrw_albaran)) {
      byAlbaran.set(m.mrw_albaran, m);
    }
  }

  const lines: PreviewLine[] = inv.lines.map((l) => {
    const m = byAlbaran.get(l.albaran);
    const proj = m?.projects
      ? Array.isArray(m.projects)
        ? m.projects[0]
        : m.projects
      : null;
    return {
      albaran: l.albaran,
      date: l.date,
      service: l.service,
      kind: l.kind,
      party_name: l.party_name,
      city: l.city,
      postal_code: l.postal_code,
      amount: l.amount,
      proratedCost: proratedLineCost(l.amount, totals.prorationFactor),
      shippingInfoId: m?.id ?? null,
      projectId: m?.project_id ?? null,
      projectName: proj?.name ?? null,
      clientName: proj?.client_name ?? null,
      matchType: m?.project_id ? "albaran" : "none",
    };
  });

  return {
    invoiceNumber: inv.invoice_number,
    invoiceDate: inv.invoice_date,
    period: inv.invoice_date ? inv.invoice_date.slice(0, 7) : null,
    costCenter: inv.cost_center,
    linesAmount: totals.linesAmount,
    surchargeAmount: totals.surchargeAmount,
    grossAmount: totals.grossAmount,
    taxAmount: inv.tax_amount,
    totalAmount: inv.total_amount,
    prorationFactor: totals.prorationFactor,
    surcharges: inv.surcharges,
    lines,
    alreadyImported: !!existing,
  };
}

export interface ApplyLine {
  albaran: string;
  date: string | null;
  kind: "delivery" | "pickup";
  party_name: string | null;
  city: string | null;
  postal_code: string | null;
  proratedCost: number;
  shippingInfoId: string | null;
  /** Proyecto al que se imputa. null = dejar como gasto general (no imputar). */
  projectId: string | null;
}

export interface ApplyPayload {
  invoiceNumber: string | null;
  invoiceDate: string | null;
  period: string | null;
  costCenter: string | null;
  linesAmount: number;
  surchargeAmount: number;
  grossAmount: number;
  taxAmount: number | null;
  totalAmount: number | null;
  lines: ApplyLine[];
}

export interface ApplyResult {
  invoiceId: string;
  imputed: number;
  imputedAmount: number;
  skipped: number;
}

export async function applyMrwInvoice(
  payload: ApplyPayload,
): Promise<ApplyResult> {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  if (!payload.invoiceNumber) {
    throw new Error("La factura no tiene número; no se puede guardar.");
  }

  const assigned = payload.lines.filter((l) => l.projectId);

  // 1) Cabecera de la factura (idempotente por carrier + invoice_number).
  const { data: invoice, error: invErr } = await supabase
    .from("carrier_invoices")
    .upsert(
      {
        carrier: "MRW",
        invoice_number: payload.invoiceNumber,
        invoice_date: payload.invoiceDate,
        period: payload.period,
        cost_center: payload.costCenter,
        lines_amount: payload.linesAmount,
        surcharge_amount: payload.surchargeAmount,
        gross_amount: payload.grossAmount,
        tax_amount: payload.taxAmount,
        total_amount: payload.totalAmount,
        line_count: payload.lines.length,
        matched_count: assigned.length,
        parsed: payload.lines as unknown as Json,
        applied_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        uploaded_by: profile.id,
      },
      { onConflict: "carrier,invoice_number" },
    )
    .select("id")
    .single();

  if (invErr || !invoice) {
    throw new Error(`No se pudo guardar la factura: ${invErr?.message}`);
  }

  // 2) Imputar el coste de cada línea asignada a shipping_info.price.
  let imputed = 0;
  let imputedAmount = 0;

  for (const line of assigned) {
    if (line.shippingInfoId) {
      // Envío ya existente (casado por albarán): fijamos su coste real.
      const { error } = await supabase
        .from("shipping_info")
        .update({
          price: line.proratedCost,
          carrier: "MRW",
          cost_source: "mrw_invoice",
          carrier_invoice_id: invoice.id,
          project_id: line.projectId,
        })
        .eq("id", line.shippingInfoId);
      if (error) throw new Error(`Envío ${line.albaran}: ${error.message}`);
    } else {
      // Sin registro previo: creamos una fila de envío para este albarán.
      const { error } = await supabase.from("shipping_info").insert({
        project_id: line.projectId,
        carrier: "MRW",
        mrw_albaran: line.albaran,
        price: line.proratedCost,
        recipient_name: line.party_name,
        city: line.city,
        postal_code: line.postal_code,
        shipped_at: line.date,
        // Fijamos created_at a la fecha del envío (no la de importación) para
        // que el reporte financiero mensual lo atribuya al mes correcto.
        created_at: line.date ?? undefined,
        // 'partial' (no 'final'): estas filas solo registran el coste imputado y
        // no deben mover el estado del proyecto ni chocar con el índice único
        // shipping_info_one_final_per_project (un 'final' por proyecto).
        shipment_kind: line.kind === "pickup" ? "pickup" : "partial",
        cost_source: "mrw_invoice",
        carrier_invoice_id: invoice.id,
        created_by: profile.id,
      });
      if (error) throw new Error(`Envío ${line.albaran}: ${error.message}`);
    }
    imputed++;
    imputedAmount += line.proratedCost;
  }

  revalidatePath("/dashboard/finanzas");
  revalidatePath("/dashboard/finanzas/importar-envios");

  return {
    invoiceId: invoice.id,
    imputed,
    imputedAmount: Math.round(imputedAmount * 100) / 100,
    skipped: payload.lines.length - imputed,
  };
}

export interface ProjectOption {
  id: string;
  name: string;
  client_name: string | null;
  price: number | null;
}

/** Lista de proyectos para asignar manualmente las líneas no casadas. */
export async function listProjectsForAssignment(): Promise<ProjectOption[]> {
  await requireRole("manager");
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, name, client_name, price")
    .order("created_at", { ascending: false })
    .limit(1000);
  return (data ?? []) as ProjectOption[];
}
