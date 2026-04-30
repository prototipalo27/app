"use server";

import { createServiceClient } from "@/lib/supabase/server";

interface SampleAddressData {
  recipient_name: string;
  recipient_phone: string;
  recipient_email: string;
  street: string;
  postal_code: string;
  city: string;
  province: string;
  country: string;
  notes: string;
}

export async function submitSampleAddress(
  token: string,
  data: SampleAddressData,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  const { data: req, error: reqError } = await supabase
    .from("sample_address_requests")
    .select("id, lead_id, status")
    .eq("token", token)
    .in("status", ["pending"])
    .maybeSingle();

  if (reqError || !req) {
    return { success: false, error: "Enlace no válido o ya utilizado" };
  }

  const { error: updateError } = await supabase
    .from("sample_address_requests")
    .update({
      recipient_name: data.recipient_name.trim() || null,
      recipient_phone: data.recipient_phone.trim() || null,
      recipient_email: data.recipient_email.trim() || null,
      street: data.street.trim() || null,
      postal_code: data.postal_code.trim() || null,
      city: data.city.trim() || null,
      province: data.province.trim() || null,
      country: data.country.trim() || null,
      notes: data.notes.trim() || null,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", req.id);

  if (updateError) {
    return { success: false, error: "Error al guardar los datos" };
  }

  await supabase.from("lead_activities").insert({
    lead_id: req.lead_id,
    activity_type: "note",
    content: "Cliente ha enviado dirección para envío de muestra",
    metadata: {
      auto: true,
      type: "sample_address_submitted",
      sample_request_id: req.id,
    },
  });

  return { success: true };
}
