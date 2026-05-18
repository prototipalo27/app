"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/rbac";
import { getLabel as getMrwLabel } from "@/lib/mrw/api";
import { getLabel as getGlsLabel } from "@/lib/gls/api";

type PrintShipmentInput = {
  shipmentId: string;
  carrier: string;
  ref: string;
};

type Result = { ok: true } | { ok: false; error: string };

export async function enqueueShipmentPrint(
  input: PrintShipmentInput,
): Promise<Result> {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) {
    return { ok: false, error: "No autenticado" };
  }

  const supabase = await createClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return { ok: false, error: "Falta NEXT_PUBLIC_SUPABASE_URL" };

  // Resolver (bucket, path, función para descargar del carrier) por carrier.
  let bucket: string;
  let path: string;
  let downloadFromCarrier: () => Promise<Buffer>;

  if (input.carrier === "MRW") {
    bucket = "mrw-labels";
    path = `${input.ref}.pdf`;
    downloadFromCarrier = async () => {
      const base64 = await getMrwLabel(input.ref);
      return Buffer.from(base64, "base64");
    };
  } else if (input.carrier === "GLS") {
    bucket = "gls-labels";
    path = `${input.ref}.pdf`;
    downloadFromCarrier = async () => {
      const base64 = await getGlsLabel(input.ref);
      return Buffer.from(base64, "base64");
    };
  } else {
    return {
      ok: false,
      error: `Imprimir etiquetas de ${input.carrier} todavía no está soportado.`,
    };
  }

  // Asegurar que el PDF está en Storage (cachea si es la primera vez).
  const { data: existing } = await supabase.storage
    .from(bucket)
    .download(path);
  const cachedBuffer = existing
    ? Buffer.from(await existing.arrayBuffer())
    : null;
  const needsUpload = !cachedBuffer || cachedBuffer.length < 100;

  if (needsUpload) {
    try {
      const fresh = await downloadFromCarrier();
      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(path, fresh, { contentType: "application/pdf", upsert: true });
      if (uploadErr) {
        console.error("[print-label] upload failed:", uploadErr);
        return { ok: false, error: `No se pudo guardar la etiqueta: ${uploadErr.message}` };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      console.error("[print-label] carrier fetch failed:", err);
      return { ok: false, error: `No se pudo obtener la etiqueta del carrier: ${message}` };
    }
  }

  const labelUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;

  const { error: insertErr } = await supabase.from("label_print_jobs").insert({
    label_url: labelUrl,
    source_kind: "shipping_info",
    source_id: input.shipmentId,
    created_by: profile.id,
  });

  if (insertErr) {
    console.error("[print-label] enqueue failed:", insertErr);
    return { ok: false, error: insertErr.message };
  }

  return { ok: true };
}
