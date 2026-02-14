import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  searchCachedContacts,
  isCachePopulated,
  syncContactsToCache,
} from "@/lib/holded/cache";

/**
 * GET /api/holded/contacts?search=texto&type=client
 *
 * Searches contacts from the local cache (Supabase).
 * If the cache is empty (first time), syncs from Holded automatically.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const search = request.nextUrl.searchParams.get("search");
  const type = request.nextUrl.searchParams.get("type");

  try {
    // Auto-sync if cache is empty (first time)
    const populated = await isCachePopulated();
    if (!populated) {
      await syncContactsToCache();
    }

    // If no search query, return empty — require at least a search term
    if (!search || search.trim().length < 2) {
      return NextResponse.json([]);
    }

    const cached = await searchCachedContacts(search.trim(), type || undefined);

    // Map cache rows back to the shape the frontend expects (HoldedContact-like)
    const contacts = cached.map((row) => ({
      id: row.holded_id,
      name: row.name,
      tradeName: row.trade_name ?? "",
      code: row.code ?? "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      mobile: row.mobile ?? "",
      type: row.contact_type ?? "",
      billAddress: {
        address: row.address ?? "",
        city: row.city ?? "",
        postalCode: row.postal_code ?? "",
        province: row.province ?? "",
        country: row.country ?? "",
        countryCode: row.country_code ?? "",
      },
    }));

    return NextResponse.json(contacts);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
