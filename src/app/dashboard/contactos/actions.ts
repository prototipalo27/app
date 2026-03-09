"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { getContact, updateContact as holdedUpdateContact, createContact as holdedCreateContact } from "@/lib/holded/api";
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
};

export async function searchContactos(query: string): Promise<CachedContact[]> {
  await requireRole("manager");
  const supabase = createServiceClient();
  const pattern = `%${query}%`;

  const { data, error } = await supabase
    .from("holded_contacts")
    .select("holded_id, name, trade_name, code, email, phone, mobile, contact_type, address, city, postal_code, province, country, note")
    .or(`name.ilike.${pattern},trade_name.ilike.${pattern},email.ilike.${pattern},code.ilike.${pattern},phone.ilike.${pattern},mobile.ilike.${pattern}`)
    .order("name")
    .limit(30);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getContactDetail(holdedId: string): Promise<CachedContact | null> {
  await requireRole("manager");
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("holded_contacts")
    .select("holded_id, name, trade_name, code, email, phone, mobile, contact_type, address, city, postal_code, province, country, note")
    .eq("holded_id", holdedId)
    .maybeSingle();

  return data || null;
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
  }
): Promise<{ success: boolean; error?: string }> {
  await requireRole("manager");

  try {
    // Update in Holded API
    const holdedData: Parameters<typeof holdedUpdateContact>[1] = {};
    if (fields.name) holdedData.name = fields.name;
    if (fields.code) holdedData.code = fields.code;
    if (fields.email) holdedData.email = fields.email;
    if (fields.phone) holdedData.phone = fields.phone;
    if (fields.mobile) holdedData.mobile = fields.mobile;

    const billAddress: Record<string, string> = {};
    if (fields.address) billAddress.address = fields.address;
    if (fields.city) billAddress.city = fields.city;
    if (fields.postal_code) billAddress.postalCode = fields.postal_code;
    if (fields.province) billAddress.province = fields.province;
    if (fields.country) billAddress.country = fields.country;
    if (Object.keys(billAddress).length > 0) holdedData.billAddress = billAddress;

    await holdedUpdateContact(holdedId, holdedData);

    // Update local cache
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
