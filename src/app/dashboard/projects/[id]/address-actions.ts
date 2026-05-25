"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Push the chosen default shipping address into the paid quote_requests for
 * every lead that belongs to the same Holded contact, so the CRM kanban's
 * "falta dirección" alert clears as soon as someone fills it in from the
 * project page. Best-effort — never blocks the original save.
 */
async function syncDefaultAddressToQuoteRequests(
  supabase: Awaited<ReturnType<typeof createClient>>,
  holdedContactId: string,
  addr: {
    addressLine?: string | null;
    city?: string | null;
    postalCode?: string | null;
    province?: string | null;
    country?: string | null;
    recipientName?: string | null;
    recipientPhone?: string | null;
    recipientEmail?: string | null;
  },
) {
  const line = (addr.addressLine || "").trim();
  if (!line) return;

  const { data: projects } = await supabase
    .from("projects")
    .select("lead_id")
    .eq("holded_contact_id", holdedContactId)
    .not("lead_id", "is", null);

  const leadIds = Array.from(
    new Set((projects ?? []).map((p) => p.lead_id).filter((id): id is string => !!id)),
  );
  if (leadIds.length === 0) return;

  await supabase
    .from("quote_requests")
    .update({
      shipping_address: line,
      shipping_postal_code: addr.postalCode?.trim() || null,
      shipping_city: addr.city?.trim() || null,
      shipping_province: addr.province?.trim() || null,
      shipping_country: addr.country?.trim() || null,
      shipping_recipient_name: addr.recipientName?.trim() || null,
      shipping_recipient_phone: addr.recipientPhone?.trim() || null,
      shipping_recipient_email: addr.recipientEmail?.trim() || null,
      pickup_in_person: false,
    })
    .in("lead_id", leadIds);
}

export async function getClientAddresses(holdedContactId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_addresses")
    .select("*")
    .eq("holded_contact_id", holdedContactId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return { success: false as const, error: error.message };
  return { success: true as const, data };
}

export async function saveClientAddress(input: {
  holdedContactId: string;
  label?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  addressLine?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  province?: string;
  isDefault?: boolean;
}) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { success: false as const, error: "Not authenticated" };

  // If setting as default, unset other defaults for this contact
  if (input.isDefault) {
    await supabase
      .from("client_addresses")
      .update({ is_default: false })
      .eq("holded_contact_id", input.holdedContactId);
  }

  const { data, error } = await supabase
    .from("client_addresses")
    .insert({
      holded_contact_id: input.holdedContactId,
      label: input.label || null,
      recipient_name: input.recipientName || null,
      recipient_phone: input.recipientPhone || null,
      recipient_email: input.recipientEmail || null,
      address_line: input.addressLine || null,
      city: input.city || null,
      postal_code: input.postalCode || null,
      country: input.country || "ES",
      province: input.province || null,
      is_default: input.isDefault ?? false,
      created_by: userData.user.id,
    })
    .select()
    .single();

  if (error) return { success: false as const, error: error.message };

  if (input.isDefault) {
    await syncDefaultAddressToQuoteRequests(supabase, input.holdedContactId, {
      addressLine: input.addressLine,
      city: input.city,
      postalCode: input.postalCode,
      province: input.province,
      country: input.country,
      recipientName: input.recipientName,
      recipientPhone: input.recipientPhone,
      recipientEmail: input.recipientEmail,
    });
  }

  return { success: true as const, data };
}

export async function updateClientAddress(
  id: string,
  input: {
    label?: string;
    recipientName?: string;
    recipientPhone?: string;
    recipientEmail?: string;
    addressLine?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    province?: string;
    isDefault?: boolean;
  },
) {
  const supabase = await createClient();

  // If setting as default, need to unset other defaults
  if (input.isDefault) {
    const { data: addr } = await supabase
      .from("client_addresses")
      .select("holded_contact_id")
      .eq("id", id)
      .single();

    if (addr) {
      await supabase
        .from("client_addresses")
        .update({ is_default: false })
        .eq("holded_contact_id", addr.holded_contact_id);
    }
  }

  const { error } = await supabase
    .from("client_addresses")
    .update({
      label: input.label,
      recipient_name: input.recipientName,
      recipient_phone: input.recipientPhone,
      recipient_email: input.recipientEmail,
      address_line: input.addressLine,
      city: input.city,
      postal_code: input.postalCode,
      country: input.country,
      province: input.province,
      is_default: input.isDefault,
    })
    .eq("id", id);

  if (error) return { success: false as const, error: error.message };

  if (input.isDefault) {
    const { data: addr } = await supabase
      .from("client_addresses")
      .select("holded_contact_id")
      .eq("id", id)
      .single();
    if (addr?.holded_contact_id) {
      await syncDefaultAddressToQuoteRequests(supabase, addr.holded_contact_id, {
        addressLine: input.addressLine,
        city: input.city,
        postalCode: input.postalCode,
        province: input.province,
        country: input.country,
        recipientName: input.recipientName,
        recipientPhone: input.recipientPhone,
        recipientEmail: input.recipientEmail,
      });
    }
  }

  return { success: true as const };
}

export async function deleteClientAddress(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_addresses")
    .delete()
    .eq("id", id);

  if (error) return { success: false as const, error: error.message };
  return { success: true as const };
}
