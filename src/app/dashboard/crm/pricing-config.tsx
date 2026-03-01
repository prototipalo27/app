"use client";

import { useState, useTransition } from "react";
import { updateBasePrice } from "./actions";

interface PricingConfigProps {
  basePrices: Record<string, number>;
}

export default function PricingConfig({ basePrices }: PricingConfigProps) {
  const [open, setOpen] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>(basePrices);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categories = Object.keys(prices).sort();

  const startEdit = (category: string) => {
    setEditing(category);
    setEditValue(String(prices[category]));
    setError(null);
    setSaved(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue("");
  };

  const saveEdit = (category: string) => {
    const newPrice = parseFloat(editValue);
    if (isNaN(newPrice) || newPrice < 0) {
      setError("Precio no valido");
      return;
    }

    startTransition(async () => {
      const result = await updateBasePrice(category, newPrice);
      if (result.success) {
        setPrices((prev) => ({ ...prev, [category]: newPrice }));
        setEditing(null);
        setSaved(category);
        setError(null);
        setTimeout(() => setSaved(null), 2000);
      } else {
        setError(result.error || "Error al guardar");
      }
    });
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-zinc-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-sm font-semibold text-zinc-900 dark:text-white">
            Precios base por categoria
          </span>
        </div>
        <svg
          className={`h-4 w-4 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-zinc-200 px-4 pb-4 dark:border-zinc-800">
          <p className="mb-3 mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            Estos precios se usan para estimar el valor de los leads y pre-rellenar presupuestos.
          </p>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {categories.map((cat) => (
              <div
                key={cat}
                className="flex items-center justify-between py-2.5"
              >
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  {cat}
                </span>

                {editing === cat ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(cat);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      autoFocus
                      className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 text-right text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                    />
                    <span className="text-xs text-zinc-400">&euro;/ud</span>
                    <button
                      onClick={() => saveEdit(cat)}
                      disabled={isPending}
                      className="rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {isPending ? "..." : "OK"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    >
                      X
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEdit(cat)}
                    className="group flex items-center gap-1.5"
                  >
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">
                      {prices[cat].toFixed(2)} &euro;/ud
                    </span>
                    {saved === cat ? (
                      <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg
                        className="h-3.5 w-3.5 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>

          {error && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
