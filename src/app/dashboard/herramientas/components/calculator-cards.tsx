"use client";

import { useState } from "react";
import SheetCalculator from "./calculators/sheet-calculator";
import MaterialCalculator from "./calculators/material-calculator";

const CALCULATORS = [
  {
    id: "sheets",
    title: "Hojillas Crux",
    description: "Hojas blancas y negras para recambios y tacos",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    component: SheetCalculator,
  },
  {
    id: "material",
    title: "Calculadora de material",
    description: "Calcula gramos totales de material necesario",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
    component: MaterialCalculator,
  },
];

export default function CalculatorCards() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CALCULATORS.map((calc) => (
          <button
            key={calc.id}
            onClick={() => setOpenId(calc.id)}
            className="flex items-start gap-4 rounded-xl border border-zinc-200 bg-white p-5 text-left transition hover:border-green-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-green-700"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {calc.icon}
            </div>
            <div>
              <p className="font-semibold text-zinc-900 dark:text-white">
                {calc.title}
              </p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {calc.description}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Modal */}
      {openId && (() => {
        const calc = CALCULATORS.find((c) => c.id === openId)!;
        const Component = calc.component;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {calc.title}
                </h3>
                <button
                  onClick={() => setOpenId(null)}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <Component />
            </div>
          </div>
        );
      })()}
    </>
  );
}
