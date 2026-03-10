"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { updateContact as holdedUpdateContact } from "@/lib/holded/api";
import { syncContactsToCache } from "@/lib/holded/cache";

export type CachedContact = {
  holded_id: string;
  name: string;
  trade_name: string | null;
  code: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  contact_type: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  province: string | null;
  country: string | null;
  note: string | null;
  captador: string | null;
  owner: string | null;
};

export type TeamMember = { id: string; name: string };

export async function getAllContactos(): Promise<CachedContact[]> {
  await requireRole("manager");
  const supabase = createServiceClient();

  const { data: contacts, error } = await supabase
    .from("holded_contacts")
    .select("holded_id, name, trade_name, code, email, phone, mobile, contact_type, address, city, postal_code, province, country, note, captador, owner")
    .order("name")
    .range(0, 4999);

  if (error) throw new Error(error.message);
  return contacts || [];
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  await requireRole("manager");
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("user_profiles")
    .select("id, email")
    .eq("is_active", true)
    .order("email");

  return (data || []).map((p) => ({ id: p.id, name: p.email.split("@")[0] }));
}

export async function updateContacto(
  holdedId: string,
  fields: {
    name?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    code?: string;
    address?: string;
    city?: string;
    postal_code?: string;
    province?: string;
    country?: string;
    captador?: string;
    owner?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  await requireRole("manager");

  try {
    // Separate local-only fields from Holded fields
    const { captador, owner, ...holdedFields } = fields;

    // Update Holded API (only non-local fields)
    const holdedData: Parameters<typeof holdedUpdateContact>[1] = {};
    if (holdedFields.name) holdedData.name = holdedFields.name;
    if (holdedFields.code) holdedData.code = holdedFields.code;
    if (holdedFields.email) holdedData.email = holdedFields.email;
    if (holdedFields.phone) holdedData.phone = holdedFields.phone;
    if (holdedFields.mobile) holdedData.mobile = holdedFields.mobile;

    const billAddress: Record<string, string> = {};
    if (holdedFields.address) billAddress.address = holdedFields.address;
    if (holdedFields.city) billAddress.city = holdedFields.city;
    if (holdedFields.postal_code) billAddress.postalCode = holdedFields.postal_code;
    if (holdedFields.province) billAddress.province = holdedFields.province;
    if (holdedFields.country) billAddress.country = holdedFields.country;
    if (Object.keys(billAddress).length > 0) holdedData.billAddress = billAddress;

    if (Object.keys(holdedData).length > 0) {
      await holdedUpdateContact(holdedId, holdedData);
    }

    // Update local cache (all fields including captador/owner)
    const supabase = createServiceClient();
    const cacheUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) cacheUpdate[key] = value;
    }

    await supabase
      .from("holded_contacts")
      .update(cacheUpdate)
      .eq("holded_id", holdedId);

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function refreshContactCache(): Promise<{ success: boolean; count?: number; error?: string }> {
  await requireRole("manager");
  try {
    const count = await syncContactsToCache();
    return { success: true, count };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}
