"use client";

import { useState } from "react";

export default function MaterialCalculator() {
  const [qtyA, setQtyA] = useState("");
  const [weightA, setWeightA] = useState("");
  const [qtyB, setQtyB] = useState("");
  const [weightB, setWeightB] = useState("");
  const [margin, setMargin] = useState("5");

  const a = (parseFloat(qtyA) || 0) * (parseFloat(weightA) || 0);
  const b = (parseFloat(qtyB) || 0) * (parseFloat(weightB) || 0);
  const m = parseFloat(margin) || 0;
  const result = (a + b) * (1 + m / 100);

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Tipo A
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Cantidad
          </label>
          <input
            type="number"
            min="0"
            value={qtyA}
            onChange={(e) => setQtyA(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Peso unitario (g)
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={weightA}
            onChange={(e) => setWeightA(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            placeholder="0"
          />
        </div>
      </div>

      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Tipo B
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Cantidad
          </label>
          <input
            type="number"
            min="0"
            value={qtyB}
            onChange={(e) => setQtyB(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Peso unitario (g)
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={weightB}
            onChange={(e) => setWeightB(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            placeholder="0"
          />
        </div>
      </div>

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

      <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Material total</p>
        <p className="text-3xl font-bold text-green-700 dark:text-green-400">
          {result.toFixed(1)} g
        </p>
        {m > 0 && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Base: {(a + b).toFixed(1)} g + {m}% desperdicio
          </p>
        )}
      </div>
    </div>
  );
}
