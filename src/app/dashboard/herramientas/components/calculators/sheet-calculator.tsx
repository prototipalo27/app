"use client";

import { useState } from "react";

export default function SheetCalculator() {
  const [units, setUnits] = useState("");
  const [sheetsPerUnit, setSheetsPerUnit] = useState("");
  const [sheetsPerPage, setSheetsPerPage] = useState("");

  const u = parseFloat(units) || 0;
  const spu = parseFloat(sheetsPerUnit) || 0;
  const spp = parseFloat(sheetsPerPage) || 0;
  const result = spp > 0 ? Math.ceil((u * spu) / spp) : 0;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Unidades totales
        </label>
        <input
          type="number"
          min="0"
          value={units}
          onChange={(e) => setUnits(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          placeholder="0"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Hojillas por unidad
        </label>
        <input
          type="number"
          min="0"
          value={sheetsPerUnit}
          onChange={(e) => setSheetsPerUnit(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          placeholder="0"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Hojillas por hoja
        </label>
        <input
          type="number"
          min="0"
          value={sheetsPerPage}
          onChange={(e) => setSheetsPerPage(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          placeholder="0"
        />
      </div>
      <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Hojas a cortar</p>
        <p className="text-3xl font-bold text-green-700 dark:text-green-400">
          {result}
        </p>
      </div>
    </div>
  );
}
