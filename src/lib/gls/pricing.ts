/**
 * GLS Spain pricing for Prototipalo SL (2025 tariff).
 * Prices are per expedition, excluding VAT.
 * Includes energy surcharge 7.5% and Climate Protect 1.5%.
 */

export type GlsServiceId = "economy" | "business24" | "express14" | "express1030" | "express830";

export interface GlsServiceOption {
  id: GlsServiceId;
  name: string;
  delivery: string;
  /** GLS <Horario> code for SOAP */
  horario: string;
}

export const GLS_SERVICES: GlsServiceOption[] = [
  { id: "business24", name: "BusinessParcel 24H", delivery: "24h", horario: "18" },
  { id: "express14", name: "Express14", delivery: "Antes de las 14:00", horario: "14" },
  { id: "express1030", name: "Express 10:30", delivery: "Antes de las 10:30", horario: "10" },
  { id: "express830", name: "Express 8:30", delivery: "Antes de las 8:30", horario: "8" },
  { id: "economy", name: "EconomyParcel 48-72H", delivery: "48-72h", horario: "18" },
];

// Weight brackets: [maxKg, provincialPrice, nationalPrice]
type RateTable = [number, number, number][];
type ExtraKg = { provincial: number; national: number };

const RATES: Record<GlsServiceId, { rates: RateTable; extraKg: ExtraKg }> = {
  economy: {
    rates: [
      [1, 4.52, 5.12],
      [3, 4.64, 5.71],
      [5, 4.88, 6.55],
      [10, 5.47, 7.85],
      [15, 7.14, 10.47],
    ],
    extraKg: { provincial: 0.48, national: 0.65 },
  },
  business24: {
    rates: [
      [1, 4.92, 6.23],
      [3, 5.38, 6.82],
      [5, 6.04, 7.87],
      [10, 6.56, 9.25],
      [15, 8.00, 12.33],
    ],
    extraKg: { provincial: 0.52, national: 0.79 },
  },
  express14: {
    rates: [
      [1, 5.64, 8.39],
      [3, 5.91, 8.73],
      [5, 6.40, 9.63],
      [10, 7.01, 11.42],
      [15, 8.39, 14.72],
    ],
    extraKg: { provincial: 0.62, national: 0.89 },
  },
  express1030: {
    rates: [
      [1, 7.56, 10.25],
      [3, 7.70, 10.45],
      [5, 8.60, 11.90],
      [10, 9.83, 14.30],
      [15, 11.76, 18.15],
    ],
    extraKg: { provincial: 0.76, national: 1.03 },
  },
  express830: {
    rates: [
      [1, 17.47, 23.38],
      [3, 19.94, 26.96],
      [5, 22.56, 30.26],
      [10, 28.88, 39.20],
      [15, 35.35, 48.14],
    ],
    extraKg: { provincial: 1.38, national: 2.06 },
  },
};

// Portugal has same rates as national BusinessParcel
const PORTUGAL_RATES = RATES.business24;

// Volumetric weight factor: 200 kg/m³ → dimensions in cm / 5000
function volumetricWeight(widthCm: number, heightCm: number, lengthCm: number): number {
  return (widthCm * heightCm * lengthCm) / 5000;
}

type Zone = "provincial" | "national" | "portugal" | "unknown";

function getZone(destPostalCode: string, destCountry: string): Zone {
  const country = destCountry.toUpperCase();
  if (country === "PT") return "portugal";
  if (country !== "ES") return "unknown";
  if (destPostalCode.startsWith("28")) return "provincial";
  return "national";
}

export interface GlsPriceEstimate {
  price: number;
  zone: string;
  billedWeight: number;
  service: string;
  serviceId: GlsServiceId;
  horario: string;
}

export function estimateGlsPrice(params: {
  serviceId?: GlsServiceId;
  weightKg: number;
  widthCm?: number;
  heightCm?: number;
  lengthCm?: number;
  destPostalCode: string;
  destCountry: string;
}): GlsPriceEstimate | null {
  const zone = getZone(params.destPostalCode, params.destCountry);
  if (zone === "unknown") return null;

  const serviceId = params.serviceId || "business24";
  const serviceOpt = GLS_SERVICES.find((s) => s.id === serviceId)!;

  let billedWeight = params.weightKg;
  if (params.widthCm && params.heightCm && params.lengthCm) {
    const volWeight = volumetricWeight(params.widthCm, params.heightCm, params.lengthCm);
    billedWeight = Math.max(billedWeight, volWeight);
  }

  // Portugal only supports BusinessParcel rates
  const rateData = zone === "portugal" ? PORTUGAL_RATES : RATES[serviceId];
  const col = zone === "provincial" ? 1 : 2;

  const zoneName =
    zone === "provincial" ? "Provincial (Madrid)" :
    zone === "portugal" ? "Portugal" :
    "Nacional peninsular";

  for (const row of rateData.rates) {
    if (billedWeight <= row[0]) {
      return {
        price: row[col],
        zone: zoneName,
        billedWeight: Math.round(billedWeight * 100) / 100,
        service: serviceOpt.name,
        serviceId,
        horario: serviceOpt.horario,
      };
    }
  }

  // Over 15kg
  const base15 = rateData.rates[rateData.rates.length - 1][col];
  const extraKgs = Math.ceil(billedWeight - 15);
  const extraRate = zone === "provincial" ? rateData.extraKg.provincial : rateData.extraKg.national;
  const price = base15 + extraKgs * extraRate;

  return {
    price: Math.round(price * 100) / 100,
    zone: zoneName,
    billedWeight: Math.round(billedWeight * 100) / 100,
    service: serviceOpt.name,
    serviceId,
    horario: serviceOpt.horario,
  };
}
