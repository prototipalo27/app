import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { estimateDelivery } from "@/lib/cabify/api";
import { CABIFY_SENDER } from "@/lib/cabify/sender";

/**
 * GET /api/cabify/estimate
 *
 * Estimate Cabify delivery price for a given destination.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const dropoffAddress = params.get("dropoffAddress");
  const dropoffCity = params.get("dropoffCity");
  const dropoffPostalCode = params.get("dropoffPostalCode");

  if (!dropoffAddress || !dropoffCity || !dropoffPostalCode) {
    return NextResponse.json(
      { error: "Missing required params: dropoffAddress, dropoffCity, dropoffPostalCode" },
      { status: 400 },
    );
  }

  try {
    const estimate = await estimateDelivery(CABIFY_SENDER, {
      street: dropoffAddress,
      city: dropoffCity,
      postal_code: dropoffPostalCode,
      country: "ES",
    });

    return NextResponse.json(estimate);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
