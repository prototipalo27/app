/**
 * UTM traffic source classification and color mapping.
 * Used by dashboard analytics charts and lead detail page.
 */

export type TrafficSource =
  | "SEO"
  | "Google Ads"
  | "Facebook/Instagram"
  | "LinkedIn"
  | "Email"
  | "WhatsApp"
  | "Teléfono"
  | "Presencial"
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

  // No UTM data → Directo (includes webflow without tracking params)
  if (!utm) return "Directo";

  const source = (utm.utm_source ?? "").toLowerCase();
  const medium = (utm.utm_medium ?? "").toLowerCase();

  // Google Ads (gclid or explicit cpc/ppc)
  if (utm.gclid || (source === "google" && (medium === "cpc" || medium === "ppc"))) {
    return "Google Ads";
  }
  // Search engine organic (Google, Bing, etc.)
  if (source === "google" || source === "bing" || source === "duckduckgo" || source === "yahoo" || (medium === "organic" && !source)) {
    return "SEO";
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
  // Referral — but check if referrer is actually a search engine
  if (medium === "referral" || (utm.referrer && !source)) {
    const ref = (utm.referrer ?? "").toLowerCase();
    if (ref.includes("google.")) return "SEO";
    if (ref.includes("bing.") || ref.includes("duckduckgo.") || ref.includes("yahoo.")) return "SEO";
    return "Referral";
  }

  return source ? "Otros" : "Directo";
}

/** Consistent color palette for traffic source charts */
export const SOURCE_COLORS: Record<TrafficSource, string> = {
  "SEO": "#34a853",
  "Google Ads": "#4285f4",
  "Facebook/Instagram": "#e1306c",
  "LinkedIn": "#0a66c2",
  "Email": "#f59e0b",
  "WhatsApp": "#25d366",
  "Teléfono": "#0ea5e9",
  "Presencial": "#f97316",
  "Directo": "#6b7280",
  "Referral": "#8b5cf6",
  "Otros Paid": "#ef4444",
  "Otros": "#a1a1aa",
};

/** All possible sources in display order */
export const ALL_SOURCES: TrafficSource[] = [
  "SEO",
  "Google Ads",
  "Facebook/Instagram",
  "LinkedIn",
  "Email",
  "WhatsApp",
  "Teléfono",
  "Presencial",
  "Directo",
  "Referral",
  "Otros Paid",
  "Otros",
];
