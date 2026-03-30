/**
 * UTM traffic source classification and color mapping.
 * Used by dashboard analytics charts and lead detail page.
 */

export type TrafficSource =
  | "Google Organic"
  | "Google Ads"
  | "Facebook/Instagram"
  | "LinkedIn"
  | "Email"
  | "WhatsApp"
  | "Teléfono"
  | "Presencial"
  | "Web Orgánico"
  | "Directo"
  | "Referral"
  | "Otros Paid"
  | "Otros";

interface UtmData {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  msclkid?: string | null;
  ttclid?: string | null;
  referrer?: string | null;
}

/**
 * Classifies a lead into a human-readable traffic source category
 * based on lead.source and UTM/click-id data.
 */
export function classifyTrafficSource(
  leadSource: string | null,
  utm?: UtmData | null
): TrafficSource {
  // Non-web sources take priority
  if (leadSource === "whatsapp") return "WhatsApp";
  if (leadSource === "email") return "Email";
  if (leadSource === "phone") return "Teléfono";
  if (leadSource === "in_person") return "Presencial";
  if (leadSource === "manual") return "Directo";

  // Webflow leads without UTM data
  if (leadSource === "webflow" && !utm) return "Web Orgánico";
  if (!utm) return "Directo";

  const source = (utm.utm_source ?? "").toLowerCase();
  const medium = (utm.utm_medium ?? "").toLowerCase();

  // Google Ads (gclid or explicit cpc/ppc)
  if (utm.gclid || (source === "google" && (medium === "cpc" || medium === "ppc"))) {
    return "Google Ads";
  }
  // Google Organic
  if (source === "google" || (medium === "organic" && !source)) {
    return "Google Organic";
  }
  // Facebook / Instagram
  if (
    utm.fbclid ||
    source === "facebook" ||
    source === "instagram" ||
    source === "fb" ||
    source === "ig" ||
    source === "meta"
  ) {
    return "Facebook/Instagram";
  }
  // Microsoft Ads
  if (utm.msclkid) return "Otros Paid";
  // TikTok Ads
  if (utm.ttclid) return "Otros Paid";
  // LinkedIn
  if (source === "linkedin") return "LinkedIn";
  // Email campaigns
  if (medium === "email" || source === "email" || source === "newsletter") return "Email";
  // Other paid
  if (medium === "cpc" || medium === "ppc" || medium === "paid" || medium === "display") {
    return "Otros Paid";
  }
  // Referral
  if (medium === "referral" || (utm.referrer && !source)) return "Referral";

  return source ? "Otros" : "Directo";
}

/** Consistent color palette for traffic source charts */
export const SOURCE_COLORS: Record<TrafficSource, string> = {
  "Google Organic": "#34a853",
  "Google Ads": "#4285f4",
  "Facebook/Instagram": "#e1306c",
  "LinkedIn": "#0a66c2",
  "Email": "#f59e0b",
  "WhatsApp": "#25d366",
  "Teléfono": "#0ea5e9",
  "Presencial": "#f97316",
  "Web Orgánico": "#14b8a6",
  "Directo": "#6b7280",
  "Referral": "#8b5cf6",
  "Otros Paid": "#ef4444",
  "Otros": "#a1a1aa",
};

/** All possible sources in display order */
export const ALL_SOURCES: TrafficSource[] = [
  "Google Organic",
  "Google Ads",
  "Facebook/Instagram",
  "LinkedIn",
  "Email",
  "WhatsApp",
  "Teléfono",
  "Presencial",
  "Web Orgánico",
  "Directo",
  "Referral",
  "Otros Paid",
  "Otros",
];
