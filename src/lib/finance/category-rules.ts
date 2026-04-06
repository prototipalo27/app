/**
 * Keyword-based category rules for auto-categorizing bank transaction vendors.
 * Rules are matched against the normalized vendor name (from bbva-parser).
 * First matching rule wins.
 */

interface CategoryRule {
  pattern: RegExp;
  category: string;
  confidence: number;
}

const CATEGORY_RULES: CategoryRule[] = [
  // ── Payroll ──
  { pattern: /nomina/i, category: "payroll", confidence: 0.95 },

  // ── Taxes ──
  { pattern: /tgss|seguridad\s*social|seguros\s*sociales|cotizacion/i, category: "taxes", confidence: 0.95 },
  { pattern: /pago\s*de\s*impuestos|tributos|agencia\s*tributaria|modelo\s*\d{3}/i, category: "taxes", confidence: 0.95 },

  // ── Facilities ──
  { pattern: /alquiler|plaza\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i, category: "facilities", confidence: 0.95 },
  { pattern: /repsol.*electricidad|iberdrola|endesa|naturgy|canal\s*de?\s*isabel/i, category: "facilities", confidence: 0.95 },
  { pattern: /\bagua\b.*(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i, category: "facilities", confidence: 0.9 },
  { pattern: /guarconsa/i, category: "facilities", confidence: 0.9 },
  { pattern: /\bo2\b.*(?:fijo|movil|fibra)|vodafone|movistar|orange\b|digi\b|masmovil|lowi|pepephone|telefonica/i, category: "facilities", confidence: 0.9 },

  // ── Production (materials, shipping, supplies for the workshop) ──
  { pattern: /filamento|filament|pla\b|abs\b|petg|resina|3djake|smart\s*materials/i, category: "production", confidence: 0.95 },
  { pattern: /mouser|igus|misumi|digikey|farnell|rs[- ]?online|rs\s*components/i, category: "production", confidence: 0.95 },
  { pattern: /amazon|amzn|aliexpress|temu/i, category: "production", confidence: 0.85 },
  { pattern: /ferreteria|maderas|merlin|leroy|bricomart|retif|ikea/i, category: "production", confidence: 0.9 },
  { pattern: /3dworld|3d-informatik|akhaluki/i, category: "production", confidence: 0.9 },
  { pattern: /seur|correos\s*express|gls|mrw|nacex|dhl|ups\b|fedex|packlink|ctt\b|ponchexpress/i, category: "production", confidence: 0.9 },
  { pattern: /decor\s*boom|framun|bazar|mundo\s*de\s*cosas|sancer|greca|ceplasa|electronicaembajadores/i, category: "production", confidence: 0.85 },

  // ── Software / SaaS ──
  { pattern: /claude\.ai|anthropic|openai|chatgpt/i, category: "software", confidence: 0.95 },
  { pattern: /holded|github|vercel|supabase|notion|figma|slack|linear|1password/i, category: "software", confidence: 0.95 },
  { pattern: /adobe|canva|dropbox|zoom|twilio|stripe|apple\.com\/bill/i, category: "software", confidence: 0.9 },

  // ── Finance (banking, insurance, financing) ──
  { pattern: /comision.*(?:servicio|telematic|tarjeta)|liquidacion.*(?:interes|comision|gasto)/i, category: "finance", confidence: 0.9 },
  { pattern: /cuota\s*bono|regul.*descuento\s*fijo|adeudo\s*mensual\s*de\s*tarjeta/i, category: "finance", confidence: 0.85 },
  { pattern: /axa\s*seguros|mapfre|allianz|zurich|liberty|mutua/i, category: "finance", confidence: 0.9 },
  { pattern: /sequra|findirect/i, category: "finance", confidence: 0.85 },
  { pattern: /offboarding/i, category: "finance", confidence: 0.7 },

  // ── Marketing ──
  { pattern: /google\s*\*?\s*ads|meta\s*ads|facebook\s*ads|instagram\s*ads|linkedin\s*ads/i, category: "marketing", confidence: 0.95 },
  { pattern: /google\s*\*?\s*workspace|webflow/i, category: "marketing", confidence: 0.85 },
  { pattern: /mydigitly/i, category: "marketing", confidence: 0.9 },
  { pattern: /mailchimp|sendinblue|brevo|hubspot/i, category: "marketing", confidence: 0.9 },

  // ── Operations (fuel, meals, travel, professional services) ──
  { pattern: /cabify|uber|bolt|glovo|taxi/i, category: "operations", confidence: 0.9 },
  { pattern: /repsol(?!.*electricidad)|cepsa|bp\b|shell\b|gasolinera|e\.\s*s\.|tarjeta\s*gasolina/i, category: "operations", confidence: 0.9 },
  { pattern: /restaurante|comida|burger|mcdonald|telepizza|starbucks|golondrina/i, category: "operations", confidence: 0.85 },
  { pattern: /hotel|booking|airbnb|renfe|iberia|vueling|ryanair/i, category: "operations", confidence: 0.9 },
  { pattern: /notaria|fiverr|freelan/i, category: "operations", confidence: 0.85 },
  { pattern: /\bcred\b.*(?:rosas|engracia|santa)/i, category: "operations", confidence: 0.8 },

  // ── Income ──
  { pattern: /liquidacion\s*remesa\s*de\s*comercios/i, category: "income", confidence: 0.9 },
  { pattern: /^(?:factura|fra\.?|pago)\s*f?\d{6}/i, category: "income", confidence: 0.85 },
  { pattern: /^(?:pro|npro)\d{6}/i, category: "income", confidence: 0.85 },
  { pattern: /^proforma\s*\d+/i, category: "income", confidence: 0.85 },
  { pattern: /prototipalo\s*(?:fra|f\d)/i, category: "income", confidence: 0.9 },
];

/**
 * Match a vendor name against the keyword rules.
 * Returns the first matching rule's category and confidence, or null if none match.
 */
export function matchCategoryByRules(
  vendorName: string
): { category: string; confidence: number } | null {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(vendorName)) {
      return { category: rule.category, confidence: rule.confidence };
    }
  }
  return null;
}
