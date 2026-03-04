"use client";

import { useState } from "react";

const BLADES_PER_SHEET = 24;

export default function SheetCalculator() {
  const [recambios, setRecambios] = useState("");
  const [tacos, setTacos] = useState("");

  const r = parseInt(recambios) || 0;
  const t = parseInt(tacos) || 0;

  // Recambios: 4 blancas + 4 negras | Tacos: 2 blancas + 2 negras
  const totalWhite = r * 4 + t * 2;
  const totalBlack = r * 4 + t * 2;

  const whiteSheets = Math.ceil(totalWhite / BLADES_PER_SHEET);
  const blackSheets = Math.ceil(totalBlack / BLADES_PER_SHEET);

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Cada hoja = 24 hojillas. Recambios = 4B + 4N. Tacos = 2B + 2N.
      </p>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Uds. Recambios
        </label>
        <input
          type="number"
          min="0"
          value={recambios}
          onChange={(e) => setRecambios(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          placeholder="0"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Uds. Tacos
        </label>
        <input
          type="number"
          min="0"
          value={tacos}
          onChange={(e) => setTacos(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          placeholder="0"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Hojas blancas</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">
            {whiteSheets}
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            {totalWhite} hojillas
          </p>
        </div>
        <div className="rounded-lg bg-zinc-900 p-4 dark:bg-zinc-950">
          <p className="text-xs text-zinc-400">Hojas negras</p>
          <p className="text-2xl font-bold text-white">
            {blackSheets}
          </p>
          <p className="text-xs text-zinc-500">
            {totalBlack} hojillas
          </p>
        </div>
      </div>

      <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Total hojas a cortar</p>
        <p className="text-3xl font-bold text-green-700 dark:text-green-400">
          {whiteSheets + blackSheets}
        </p>
      </div>
    </div>
  );
}
