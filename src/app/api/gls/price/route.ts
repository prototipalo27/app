import { NextRequest, NextResponse } from "next/server";
import { estimateGlsPrice, GLS_SERVICES, type GlsServiceId } from "@/lib/gls/pricing";

/**
 * GET /api/gls/price?weight=2&postalCode=08001&country=ES
 * GET /api/gls/price?weight=2&postalCode=08001&country=ES&serviceId=business24
 * GET /api/gls/price?weight=2&postalCode=08001&country=ES&all=true
 *
 * Returns estimated GLS shipping price(s).
 * With all=true, returns prices for all services.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const weight = Number(sp.get("weight") || "0");
  const width = Number(sp.get("width") || "0") || undefined;
  const height = Number(sp.get("height") || "0") || undefined;
  const length = Number(sp.get("length") || "0") || undefined;
  const postalCode = sp.get("postalCode") || "";
  const country = sp.get("country") || "ES";
  const serviceId = (sp.get("serviceId") || undefined) as GlsServiceId | undefined;
  const all = sp.get("all") === "true";

  if (!weight || !postalCode) {
    return NextResponse.json({ error: "Missing weight or postalCode" }, { status: 400 });
  }

  const baseParams = {
    weightKg: weight,
    widthCm: width,
    heightCm: height,
    lengthCm: length,
    destPostalCode: postalCode,
    destCountry: country,
  };

  // Return all service prices at once
  if (all) {
    const prices: Record<string, { price: number; zone: string; service: string; horario: string }> = {};
    for (const svc of GLS_SERVICES) {
      const estimate = estimateGlsPrice({ ...baseParams, serviceId: svc.id });
      if (estimate) {
        prices[svc.id] = estimate;
      }
    }
    if (Object.keys(prices).length === 0) {
      return NextResponse.json({ error: "Destination not covered by GLS tariff" }, { status: 404 });
    }
    return NextResponse.json(prices);
  }

  const estimate = estimateGlsPrice({ ...baseParams, serviceId });

  if (!estimate) {
    return NextResponse.json({ error: "Destination not covered by GLS tariff" }, { status: 404 });
  }

  return NextResponse.json(estimate);
}
