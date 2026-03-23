"use client";

import { useState } from "react";

const DEFAULT_WEIGHTS = { small: 30, medium: 50, large: 70 };
const STORAGE_KEY = "urbieta_weights";

const SIZES = [
  { key: "small", label: "Pequeñas" },
  { key: "medium", label: "Medianas" },
  { key: "large", label: "Grandes" },
];

function loadWeights(): Record<string, number> {
  if (typeof window === "undefined") return DEFAULT_WEIGHTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_WEIGHTS;
}

export default function MaterialCalculator() {
  const [weights, setWeights] = useState<Record<string, number>>(loadWeights);
  const [editWeights, setEditWeights] = useState<Record<string, string>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [qtys, setQtys] = useState<Record<string, string>>({
    small: "",
    medium: "",
    large: "",
  });
  const [margin, setMargin] = useState("5");

  const m = parseFloat(margin) || 0;

  const breakdown = SIZES.map((s) => {
    const qty = parseInt(qtys[s.key]) || 0;
    const w = weights[s.key] ?? DEFAULT_WEIGHTS[s.key as keyof typeof DEFAULT_WEIGHTS];
    return { ...s, weight: w, qty, subtotal: qty * w };
  });

  const base = breakdown.reduce((sum, b) => sum + b.subtotal, 0);
  const total = base * (1 + m / 100);

  const openSettings = () => {
    setEditWeights({
      small: String(weights.small),
      medium: String(weights.medium),
      large: String(weights.large),
    });
    setShowSettings(true);
  };

  const saveSettings = () => {
    const newWeights = {
      small: parseFloat(editWeights.small) || DEFAULT_WEIGHTS.small,
      medium: parseFloat(editWeights.medium) || DEFAULT_WEIGHTS.medium,
      large: parseFloat(editWeights.large) || DEFAULT_WEIGHTS.large,
    };
    setWeights(newWeights);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newWeights));
    setShowSettings(false);
  };

  if (showSettings) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">Ajustes</h4>
          <button
            onClick={() => setShowSettings(false)}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Cancelar
          </button>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Gramos por unidad de cada tamaño
        </p>
        {SIZES.map((size) => (
          <div key={size.key}>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {size.label}
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="1"
                value={editWeights[size.key]}
                onChange={(e) =>
                  setEditWeights((prev) => ({ ...prev, [size.key]: e.target.value }))
                }
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <span className="text-xs text-zinc-400">g/ud</span>
            </div>
          </div>
        ))}
        <button
          onClick={saveSettings}
          className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          Guardar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {SIZES.map((s) => `${s.label[0]}. ${weights[s.key]}g`).join(" · ")}
        </p>
        <button
          onClick={openSettings}
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          title="Ajustar gramos"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {SIZES.map((size) => (
        <div key={size.key}>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {size.label} ({weights[size.key]} g/ud)
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
                  {b.qty} × {b.weight} g
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
