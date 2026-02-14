import { createServiceClient } from "@/lib/supabase/server";
import { listContacts } from "./api";

/**
 * Sync all Holded contacts into the local `holded_contacts` cache table.
 * Returns the number of contacts upserted.
 */
export async function syncContactsToCache(): Promise<number> {
  const contacts = await listContacts();
  if (contacts.length === 0) return 0;

  const supabase = createServiceClient();

  // Map Holded contacts to cache rows
  const rows = contacts.map((c) => ({
    holded_id: c.id,
    name: c.name,
    trade_name: c.tradeName || null,
    code: c.code || null,
    email: c.email || null,
    phone: c.phone || null,
    mobile: c.mobile || null,
    contact_type: c.type || null,
    address: c.billAddress?.address || null,
    city: c.billAddress?.city || null,
    postal_code: c.billAddress?.postalCode || null,
    province: c.billAddress?.province || null,
    country: c.billAddress?.country || null,
    country_code: c.billAddress?.countryCode || null,
    note: c.note || null,
    updated_at: new Date().toISOString(),
  }));

  // Upsert in batches of 500
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase
      .from("holded_contacts")
      .upsert(batch, { onConflict: "holded_id" });

    if (error) {
      throw new Error(`Failed to upsert contacts batch: ${error.message}`);
    }
  }

  return rows.length;
}

/**
 * Search cached contacts by name, trade_name, email, or code using ILIKE.
 */
export async function searchCachedContacts(
  query: string,
  contactType?: string,
) {
  const supabase = createServiceClient();
  const pattern = `%${query}%`;

  let q = supabase
    .from("holded_contacts")
    .select("*")
    .or(
      `name.ilike.${pattern},trade_name.ilike.${pattern},email.ilike.${pattern},code.ilike.${pattern}`,
    )
    .limit(50);

  if (contactType) {
    q = q.eq("contact_type", contactType);
  }

  const { data, error } = await q;

  if (error) {
    throw new Error(`Failed to search cached contacts: ${error.message}`);
  }

  return data;
}

/**
 * Check if the cache has any contacts stored.
 */
export async function isCachePopulated(): Promise<boolean> {
  const supabase = createServiceClient();

  const { count, error } = await supabase
    .from("holded_contacts")
    .select("*", { count: "exact", head: true });

  if (error) {
    throw new Error(`Failed to check cache: ${error.message}`);
  }

  return (count ?? 0) > 0;
}
