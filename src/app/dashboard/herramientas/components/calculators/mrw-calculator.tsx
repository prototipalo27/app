"use client";

import { useState, useMemo } from "react";

// ── Tarifa GO 200 – Peninsular ──────────────────────────────────────────────

type Zone = "urbano" | "provincial" | "regional" | "peninsular" | "portugal";
type Service = "10h" | "14h" | "19h";

const ZONE_LABELS: Record<Zone, string> = {
  urbano: "Urbano",
  provincial: "Provincial",
  regional: "Regional / Limítrofe",
  peninsular: "España Peninsular",
  portugal: "Portugal Peninsular",
};

const SERVICE_LABELS: Record<Service, string> = {
  "10h": "Mañana 10 h",
  "14h": "Mañana 14 h",
  "19h": "Mañana 19 h",
};

// Weight tiers: [maxKg, urbano, provincial, regional, peninsular, portugal]
const TIERS: Record<Service, { brackets: [number, number, number, number, number, number][]; extra: [number, number, number, number, number] }> = {
  "10h": {
    brackets: [
      [2, 8.47, 8.47, 12.53, 13.45, 13.45],
      [5, 8.74, 8.74, 13.38, 14.62, 14.62],
      [10, 14.94, 14.94, 22.86, 24.97, 24.97],
    ],
    extra: [1.78, 1.73, 2.43, 2.66, 2.66],
  },
  "14h": {
    brackets: [
      [2, 6.25, 6.25, 7.35, 8.31, 8.31],
      [5, 6.71, 6.71, 7.96, 9.35, 9.35],
      [10, 10.82, 10.82, 12.67, 14.85, 14.85],
    ],
    extra: [0.83, 0.83, 1.08, 1.27, 1.27],
  },
  "19h": {
    brackets: [
      [2, 5.42, 5.42, 5.85, 6.34, 6.34],
      [5, 5.72, 5.72, 6.35, 6.93, 6.93],
      [10, 7.19, 7.19, 7.85, 8.67, 8.67],
    ],
    extra: [0.38, 0.38, 0.44, 0.50, 0.50],
  },
};

// Size surcharges per service [urbano, provincial, regional, peninsular, portugal]
const SIZE_SURCHARGES: Record<Service, Record<string, [number, number, number, number, number]>> = {
  "10h": {
    "151-200": [20.46, 27.10, 51.70, 56.78, 56.78],
    "201-250": [30.69, 40.65, 77.55, 85.17, 85.17],
    "251-300": [49.92, 63.20, 112.40, 122.56, 122.56],
  },
  "14h": {
    "151-200": [17.38, 17.38, 24.80, 34.10, 34.10],
    "201-250": [26.07, 26.07, 37.20, 51.15, 51.15],
    "251-300": [43.76, 43.76, 58.60, 77.20, 77.20],
  },
  "19h": {
    "151-200": [17.38, 17.38, 24.80, 34.10, 34.10],
    "201-250": [26.07, 26.07, 37.20, 51.15, 51.15],
    "251-300": [43.76, 43.76, 58.60, 77.20, 77.20],
  },
};

const ZONE_INDEX: Record<Zone, number> = {
  urbano: 0,
  provincial: 1,
  regional: 2,
  peninsular: 3,
  portugal: 4,
};

const ENVELOPE_COSTS = [
  { label: "Sobre Mini", price: 0.05 },
  { label: "Sobre Standard", price: 0.10 },
  { label: "Sobre XL", price: 0.15 },
];

function getBasePrice(service: Service, zone: Zone, weightKg: number): number {
  const zi = ZONE_INDEX[zone];
  const tier = TIERS[service];

  for (const bracket of tier.brackets) {
    if (weightKg <= bracket[0]) {
      return bracket[zi + 1];
    }
  }

  // Over 10 kg: last bracket price + extra per additional kg
  const lastBracket = tier.brackets[tier.brackets.length - 1];
  const base = lastBracket[zi + 1];
  const extraKg = Math.ceil(weightKg) - lastBracket[0];
  return base + extraKg * tier.extra[zi];
}

function getSizeSurcharge(service: Service, zone: Zone, totalCm: number): number {
  const zi = ZONE_INDEX[zone];
  if (totalCm <= 150) return 0;
  if (totalCm <= 200) return SIZE_SURCHARGES[service]["151-200"][zi];
  if (totalCm <= 250) return SIZE_SURCHARGES[service]["201-250"][zi];
  if (totalCm <= 300) return SIZE_SURCHARGES[service]["251-300"][zi];
  return 0; // exceeds limit
}

function getWeightSurcharge(bultoKg: number): number {
  if (bultoKg > 60) return 23.60;
  if (bultoKg > 40) return 17.25;
  return 0;
}

export default function MrwCalculator() {
  const [service, setService] = useState<Service>("19h");
  const [zone, setZone] = useState<Zone>("peninsular");
  const [bultos, setBultos] = useState("1");
  const [weight, setWeight] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [envelope, setEnvelope] = useState<string>("none");

  const result = useMemo(() => {
    const w = parseFloat(weight) || 0;
    const b = parseInt(bultos) || 1;
    const dim = parseInt(dimensions) || 0;

    if (w <= 0) return null;

    // Min average weight: 2 kg per bulto
    const minWeight = b * 2;
    const effectiveWeight = Math.max(w, minWeight);

    const basePrice = getBasePrice(service, zone, effectiveWeight);
    const sizeSurcharge = dim > 150 ? getSizeSurcharge(service, zone, dim) * b : 0;

    // Per-bulto weight surcharges
    const avgBultoKg = effectiveWeight / b;
    const weightSurcharge = getWeightSurcharge(avgBultoKg) * b;

    const envelopeCost =
      envelope !== "none"
        ? (ENVELOPE_COSTS.find((e) => e.label === envelope)?.price || 0) * b
        : 0;

    const total = basePrice + sizeSurcharge + weightSurcharge + envelopeCost;

    return {
      basePrice,
      sizeSurcharge,
      weightSurcharge,
      envelopeCost,
      total,
      effectiveWeight,
      minWeightApplied: effectiveWeight > w,
    };
  }, [service, zone, bultos, weight, dimensions, envelope]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Tarifa GO 200 · IVA no incluido
      </p>

      {/* Service */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Servicio
        </label>
        <div className="mt-1 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
          {(["19h", "14h", "10h"] as Service[]).map((s) => (
            <button
              key={s}
              onClick={() => setService(s)}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                service === s
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              {SERVICE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Zone */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Zona
        </label>
        <select
          value={zone}
          onChange={(e) => setZone(e.target.value as Zone)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
        >
          {Object.entries(ZONE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* Weight + Bultos */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Peso total (kg)
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Bultos
          </label>
          <input
            type="number"
            min="1"
            value={bultos}
            onChange={(e) => setBultos(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            placeholder="1"
          />
        </div>
      </div>

      {/* Dimensions */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Medidas (alto+largo+ancho en cm)
        </label>
        <input
          type="number"
          min="0"
          value={dimensions}
          onChange={(e) => setDimensions(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          placeholder="Opcional"
        />
      </div>

      {/* Envelope */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Sobre plástico
        </label>
        <select
          value={envelope}
          onChange={(e) => setEnvelope(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
        >
          <option value="none">Sin sobre</option>
          {ENVELOPE_COSTS.map((e) => (
            <option key={e.label} value={e.label}>
              {e.label} ({e.price.toFixed(2)} €)
            </option>
          ))}
        </select>
      </div>

      {/* Result */}
      {result && (
        <>
          <div className="space-y-1 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800">
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
              <span>Transporte</span>
              <span>{result.basePrice.toFixed(2)} €</span>
            </div>
            {result.minWeightApplied && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Peso mínimo aplicado: {result.effectiveWeight} kg (2 kg/bulto)
              </p>
            )}
            {result.sizeSurcharge > 0 && (
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Recargo medidas</span>
                <span>+{result.sizeSurcharge.toFixed(2)} €</span>
              </div>
            )}
            {result.weightSurcharge > 0 && (
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Recargo peso bulto</span>
                <span>+{result.weightSurcharge.toFixed(2)} €</span>
              </div>
            )}
            {result.envelopeCost > 0 && (
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Sobre plástico</span>
                <span>+{result.envelopeCost.toFixed(2)} €</span>
              </div>
            )}
          </div>

          <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Total (sin IVA)
            </p>
            <p className="text-3xl font-bold text-green-700 dark:text-green-400">
              {result.total.toFixed(2)} €
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Con IVA (21%): {(result.total * 1.21).toFixed(2)} €
            </p>
          </div>
        </>
      )}
    </div>
  );
}
