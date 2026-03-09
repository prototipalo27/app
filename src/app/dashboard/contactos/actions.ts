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
  captador: string | null;
  owner: string | null;
};

export async function getAllContactos(): Promise<CachedContact[]> {
  await requireRole("manager");
  const supabase = createServiceClient();

  // 1. Load all cached contacts
  const { data: contacts, error } = await supabase
    .from("holded_contacts")
    .select("holded_id, name, trade_name, code, email, phone, mobile, contact_type, address, city, postal_code, province, country, note")
    .order("name");

  if (error) throw new Error(error.message);
  if (!contacts || contacts.length === 0) return [];

  // 2. Get holded_contact_id → lead owner mapping via quote_requests + leads
  const { data: qrLinks } = await supabase
    .from("quote_requests")
    .select("holded_contact_id, lead_id, leads(owned_by, created_at)")
    .not("holded_contact_id", "is", null);

  // 3. Load user names for owners
  const ownerIds = new Set<string>();
  for (const qr of qrLinks || []) {
    const lead = qr.leads as any;
    if (lead?.owned_by) ownerIds.add(lead.owned_by);
  }

  const ownerMap = new Map<string, string>();
  if (ownerIds.size > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, email")
      .in("id", [...ownerIds]);
    for (const p of profiles || []) {
      ownerMap.set(p.id, p.email.split("@")[0]);
    }
  }

  // 4. Build per-holded_contact: earliest lead owner = captador, latest = owner
  const contactLeads = new Map<string, { owned_by: string; created_at: string }[]>();
  for (const qr of qrLinks || []) {
    if (!qr.holded_contact_id) continue;
    const lead = qr.leads as any;
    if (!lead?.owned_by) continue;
    if (!contactLeads.has(qr.holded_contact_id)) contactLeads.set(qr.holded_contact_id, []);
    contactLeads.get(qr.holded_contact_id)!.push({ owned_by: lead.owned_by, created_at: lead.created_at });
  }

  // 5. Merge into contacts
  return contacts.map((c) => {
    const leads = contactLeads.get(c.holded_id);
    let captador: string | null = null;
    let owner: string | null = null;

    if (leads && leads.length > 0) {
      const sorted = leads.sort((a, b) => a.created_at.localeCompare(b.created_at));
      captador = ownerMap.get(sorted[0].owned_by) || null;
      owner = ownerMap.get(sorted[sorted.length - 1].owned_by) || null;
    }

    return { ...c, captador, owner };
  });
}

export async function getContactDetail(holdedId: string): Promise<CachedContact | null> {
  await requireRole("manager");
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("holded_contacts")
    .select("holded_id, name, trade_name, code, email, phone, mobile, contact_type, address, city, postal_code, province, country, note")
    .eq("holded_id", holdedId)
    .maybeSingle();

  if (!data) return null;
  return { ...data, captador: null, owner: null };
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
