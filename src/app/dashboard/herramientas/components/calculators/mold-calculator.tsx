"use client";

import { useState } from "react";

// Densidades típicas (g/cm³)
const SILICONE_DENSITY = 1.15; // Silicona de moldeo (RTV)
const PLASTER_DENSITY = 1.44; // Yeso de moldeo (calibrado: 14.5×8×1.5 cm → 250 g)

export default function MoldCalculator() {
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [siliconeWall, setSiliconeWall] = useState("15"); // mm
  const [quantity, setQuantity] = useState("1");
  const [margin, setMargin] = useState("10"); // %

  const l = parseFloat(length) || 0; // cm
  const w = parseFloat(width) || 0;  // cm
  const h = parseFloat(height) || 0; // cm
  const sw = (parseFloat(siliconeWall) || 0) / 10; // mm → cm
  const qty = parseInt(quantity) || 1;
  const m = parseFloat(margin) || 0;

  const pieceVolume = l * w * h; // cm³

  // Silicona: caja exterior - pieza (molde abierto por arriba)
  const silOuterL = l + sw * 2;
  const silOuterW = w + sw * 2;
  const silOuterH = h + sw; // fondo + laterales, abierto arriba
  const silOuterVol = silOuterL * silOuterW * silOuterH;
  const siliconeVolume = silOuterVol - pieceVolume;
  const siliconeWeight = siliconeVolume * SILICONE_DENSITY;

  // Yeso: bloque macizo del tamaño de la pieza (lo que rellena el molde)
  const plasterWeight = pieceVolume * PLASTER_DENSITY;

  const hasDimensions = l > 0 && w > 0 && h > 0;

  const applyMargin = (val: number) => val * (1 + m / 100);

  const formatWeight = (grams: number) =>
    grams >= 1000
      ? `${(grams / 1000).toFixed(2)} kg`
      : `${grams.toFixed(0)} g`;

  // Totales con cantidad y margen
  const totalSilicone = applyMargin(siliconeWeight) * qty;
  const totalPlaster = applyMargin(plasterWeight) * qty;

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Introduce las dimensiones de la pieza a moldear
      </p>

      {/* Dimensiones de la pieza */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Largo (cm)", value: length, set: setLength },
          { label: "Ancho (cm)", value: width, set: setWidth },
          { label: "Alto (cm)", value: height, set: setHeight },
        ].map((field) => (
          <div key={field.label}>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {field.label}
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={field.value}
              onChange={(e) => field.set(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              placeholder="0"
            />
          </div>
        ))}
      </div>

      {hasDimensions && (
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          Volumen pieza: {pieceVolume.toFixed(1)} cm³
        </div>
      )}

      {/* Pared silicona + Cantidad */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Pared silicona (mm)
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={siliconeWall}
            onChange={(e) => setSiliconeWall(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            placeholder="15"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Cantidad (moldes/piezas)
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            placeholder="1"
          />
        </div>
      </div>

      {/* Margen */}
      <div>
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Margen desperdicio (%)
        </label>
        <input
          type="number"
          min="0"
          step="1"
          value={margin}
          onChange={(e) => setMargin(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          placeholder="10"
        />
      </div>

      {/* Resultados */}
      {hasDimensions && (
        <div className="space-y-3">
          {/* Silicona */}
          <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
              Silicona RTV
            </p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              {formatWeight(totalSilicone)}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {formatWeight(applyMargin(siliconeWeight))}/molde
              {qty > 1 && ` × ${qty} moldes`}
              {m > 0 && ` · +${m}% margen`}
            </p>
          </div>

          {/* Yeso */}
          <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Yeso (macizo)
            </p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
              {formatWeight(totalPlaster)}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {formatWeight(applyMargin(plasterWeight))}/pieza
              {qty > 1 && ` × ${qty} piezas`}
              {m > 0 && ` · +${m}% margen`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
