"use client";

import { useState } from "react";

const SIZES = [
  { key: "small", label: "Pequeñas", weight: 30 },
  { key: "medium", label: "Medianas", weight: 50 },
  { key: "large", label: "Grandes", weight: 70 },
] as const;

export default function MaterialCalculator() {
  const [qtys, setQtys] = useState<Record<string, string>>({
    small: "",
    medium: "",
    large: "",
  });
  const [margin, setMargin] = useState("5");

  const m = parseFloat(margin) || 0;

  const breakdown = SIZES.map((s) => {
    const qty = parseInt(qtys[s.key]) || 0;
    return { ...s, qty, subtotal: qty * s.weight };
  });

  const base = breakdown.reduce((sum, b) => sum + b.subtotal, 0);
  const total = base * (1 + m / 100);

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Pequeña 30 g · Mediana 50 g · Grande 70 g
      </p>

      {SIZES.map((size) => (
        <div key={size.key}>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {size.label} ({size.weight} g/ud)
          </label>
          <input
            type="number"
            min="0"
            value={qtys[size.key]}
            onChange={(e) =>
              setQtys((prev) => ({ ...prev, [size.key]: e.target.value }))
            }
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            placeholder="0"
          />
        </div>
      ))}

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Margen desperdicio (%)
        </label>
        <input
          type="number"
          min="0"
          step="1"
          value={margin}
          onChange={(e) => setMargin(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          placeholder="5"
        />
      </div>

      {/* Desglose */}
      {base > 0 && (
        <div className="space-y-1 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800">
          {breakdown
            .filter((b) => b.qty > 0)
            .map((b) => (
              <div
                key={b.key}
                className="flex justify-between text-zinc-600 dark:text-zinc-400"
              >
                <span>
                  {b.qty} {b.label.toLowerCase()}
                </span>
                <span>{b.subtotal.toLocaleString()} g</span>
              </div>
            ))}
        </div>
      )}

      <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Material total</p>
        <p className="text-3xl font-bold text-green-700 dark:text-green-400">
          {total >= 1000
            ? `${(total / 1000).toFixed(2)} kg`
            : `${total.toFixed(0)} g`}
        </p>
        {m > 0 && base > 0 && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Base: {base.toLocaleString()} g + {m}% desperdicio
          </p>
        )}
      </div>
    </div>
  );
}
