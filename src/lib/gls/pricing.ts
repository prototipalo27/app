/**
 * GLS Spain pricing for Prototipalo SL (2025 tariff).
 * BusinessParcel 24H (service code 96) — national peninsular.
 * Prices are per expedition, excluding VAT.
 * Includes energy surcharge 7.5% and Climate Protect 1.5%.
 */

// Weight brackets: [maxKg, provincialPrice, nationalPrice]
const BUSINESS_PARCEL_RATES: [number, number, number][] = [
  [1, 4.92, 6.23],
  [3, 5.38, 6.82],
  [5, 6.04, 7.87],
  [10, 6.56, 9.25],
  [15, 8.00, 12.33],
];

const BUSINESS_PARCEL_EXTRA_KG = { provincial: 0.52, national: 0.79 };

// Portugal has same rates as national peninsular
const PORTUGAL_RATES = BUSINESS_PARCEL_RATES.map(
  ([kg, , nat]) => [kg, nat, nat] as [number, number, number],
);
const PORTUGAL_EXTRA_KG = { provincial: 0.79, national: 0.79 };

// Volumetric weight factor: 200 kg/m³ → dimensions in cm / 5000
function volumetricWeight(widthCm: number, heightCm: number, lengthCm: number): number {
  return (widthCm * heightCm * lengthCm) / 5000;
}

type Zone = "provincial" | "national" | "portugal" | "unknown";

/**
 * Determine the zone based on origin and destination postal codes + country.
 * Origin is Madrid (28xxx).
 */
function getZone(destPostalCode: string, destCountry: string): Zone {
  const country = destCountry.toUpperCase();
  if (country === "PT") return "portugal";
  if (country !== "ES") return "unknown";

  // Provincial = Madrid province (postal codes starting with 28)
  if (destPostalCode.startsWith("28")) return "provincial";
  return "national";
}

export interface GlsPriceEstimate {
  price: number;
  zone: string;
  billedWeight: number; // the weight used for pricing (max of real vs volumetric)
  service: string;
}

/**
 * Estimate GLS shipping price based on package dimensions and destination.
 */
export function estimateGlsPrice(params: {
  weightKg: number;
  widthCm?: number;
  heightCm?: number;
  lengthCm?: number;
  destPostalCode: string;
  destCountry: string;
}): GlsPriceEstimate | null {
  const zone = getZone(params.destPostalCode, params.destCountry);
  if (zone === "unknown") return null;

  // Calculate volumetric weight if dimensions provided
  let billedWeight = params.weightKg;
  if (params.widthCm && params.heightCm && params.lengthCm) {
    const volWeight = volumetricWeight(params.widthCm, params.heightCm, params.lengthCm);
    billedWeight = Math.max(billedWeight, volWeight);
  }

  const rates = zone === "portugal" ? PORTUGAL_RATES : BUSINESS_PARCEL_RATES;
  const extraKg = zone === "portugal" ? PORTUGAL_EXTRA_KG : BUSINESS_PARCEL_EXTRA_KG;
  const col = zone === "provincial" ? 1 : 2; // column index in rates

  // Find the right bracket
  for (const row of rates) {
    if (billedWeight <= row[0]) {
      return {
        price: row[col],
        zone: zone === "provincial" ? "Provincial (Madrid)" : zone === "portugal" ? "Portugal" : "Nacional peninsular",
        billedWeight: Math.round(billedWeight * 100) / 100,
        service: "BusinessParcel 24H",
      };
    }
  }

  // Over 15kg: use 15kg base + extra per additional kg
  const base15 = rates[rates.length - 1][col];
  const extraKgs = Math.ceil(billedWeight - 15);
  const extraRate = zone === "provincial" ? extraKg.provincial : extraKg.national;
  const price = base15 + extraKgs * extraRate;

  return {
    price: Math.round(price * 100) / 100,
    zone: zone === "provincial" ? "Provincial (Madrid)" : zone === "portugal" ? "Portugal" : "Nacional peninsular",
    billedWeight: Math.round(billedWeight * 100) / 100,
    service: "BusinessParcel 24H",
  };
}
