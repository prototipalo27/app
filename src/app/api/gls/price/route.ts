import { NextRequest, NextResponse } from "next/server";
import { estimateGlsPrice, type GlsServiceId } from "@/lib/gls/pricing";

/**
 * GET /api/gls/price?weight=2&width=30&height=20&length=40&postalCode=08001&country=ES&serviceId=business24
 *
 * Returns estimated GLS shipping price.
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

  if (!weight || !postalCode) {
    return NextResponse.json({ error: "Missing weight or postalCode" }, { status: 400 });
  }

  const estimate = estimateGlsPrice({
    serviceId,
    weightKg: weight,
    widthCm: width,
    heightCm: height,
    lengthCm: length,
    destPostalCode: postalCode,
    destCountry: country,
  });

  if (!estimate) {
    return NextResponse.json({ error: "Destination not covered by GLS tariff" }, { status: 404 });
  }

  return NextResponse.json(estimate);
}
