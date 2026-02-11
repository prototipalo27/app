import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServices } from "@/lib/packlink/api";

/**
 * GET /api/packlink/services?fromZip=...&fromCountry=...&toZip=...&toCountry=...&width=...&height=...&length=...&weight=...
 *
 * Fetches available shipping services from Packlink for a given route.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const fromZip = sp.get("fromZip");
  const fromCountry = sp.get("fromCountry");
  const toZip = sp.get("toZip");
  const toCountry = sp.get("toCountry");
  const width = sp.get("width");
  const height = sp.get("height");
  const length = sp.get("length");
  const weight = sp.get("weight");

  if (!fromZip || !fromCountry || !toZip || !toCountry || !width || !height || !length || !weight) {
    return NextResponse.json(
      { error: "Missing required params: fromZip, fromCountry, toZip, toCountry, width, height, length, weight" },
      { status: 400 },
    );
  }

  try {
    const services = await getServices(
      { zip: fromZip, country: fromCountry },
      { zip: toZip, country: toCountry },
      [{ width: Number(width), height: Number(height), length: Number(length), weight: Number(weight) }],
    );

    return NextResponse.json(services);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
