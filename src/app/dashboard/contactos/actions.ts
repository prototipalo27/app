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
  /** "holded" for Holded contacts, "lead" for CRM leads */
  _source: "holded" | "lead";
  /** Lead ID (only for leads) */
  _lead_id?: string;
};

export type TeamMember = { id: string; name: string };

export async function getAllContactos(): Promise<CachedContact[]> {
  await requireRole("manager");
  const supabase = createServiceClient();

  // 1. Fetch Holded contacts
  const PAGE_SIZE = 1000;
  let holdedContacts: CachedContact[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("holded_contacts")
      .select("holded_id, name, trade_name, code, email, phone, mobile, contact_type, address, city, postal_code, province, country, note, captador, owner")
      .order("name")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    holdedContacts = holdedContacts.concat(data.map((c) => ({ ...c, _source: "holded" as const })));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  // 2. Fetch leads that are NOT already linked to a Holded contact
  // A lead is "linked" when its quote_request has a holded_contact_id
  const { data: linkedLeadIds } = await supabase
    .from("quote_requests")
    .select("lead_id")
    .not("holded_contact_id", "is", null);

  const linkedIds = new Set((linkedLeadIds || []).map((r) => r.lead_id));

  // Also exclude leads whose email already exists in Holded contacts
  const holdedEmails = new Set(
    holdedContacts
      .filter((c) => c.email)
      .map((c) => c.email!.toLowerCase()),
  );

  const { data: leads } = await supabase
    .from("leads")
    .select("id, full_name, email, phone, company, owned_by, status")
    .not("status", "eq", "lost")
    .order("full_name");

  const leadContacts: CachedContact[] = (leads || [])
    .filter((l) => !linkedIds.has(l.id))
    .filter((l) => !l.email || !holdedEmails.has(l.email.toLowerCase()))
    .map((l) => ({
      holded_id: `lead-${l.id}`,
      name: l.full_name,
      trade_name: l.company,
      code: null,
      email: l.email,
      phone: l.phone,
      mobile: null,
      contact_type: "lead",
      address: null,
      city: null,
      postal_code: null,
      province: null,
      country: null,
      note: null,
      captador: l.owned_by,
      owner: l.owned_by,
      _source: "lead" as const,
      _lead_id: l.id,
    }));

  // 3. Merge and sort by name
  const all = [...holdedContacts, ...leadContacts];
  all.sort((a, b) => a.name.localeCompare(b.name, "es"));

  return all;
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

export async function deleteContacto(
  holdedId: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  await requireRole("manager");

  try {
    const supabase = createServiceClient();

    // Delete from Holded
    const { deleteHoldedContact } = await import("@/lib/holded/api");
    await deleteHoldedContact(holdedId).catch((err) => {
      console.error("[deleteContacto] Holded delete failed:", err);
    });

    // Add to exclusion list so it doesn't reappear on next sync
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("holded_contacts_excluded")
      .upsert({ holded_id: holdedId, name });

    // Remove from local cache
    await supabase
      .from("holded_contacts")
      .delete()
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
