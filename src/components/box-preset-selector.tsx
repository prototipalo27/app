"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface BoxPreset {
  id: string;
  name: string;
  width_cm: number;
  height_cm: number;
  length_cm: number;
  weight_kg: number;
}

export interface PackageItem {
  width: string;
  height: string;
  length: string;
  weight: string;
  presetId: string; // "" = custom
}

interface PackageListEditorProps {
  packages: PackageItem[];
  onChange: (packages: PackageItem[]) => void;
  inputClass: string;
}

export function createEmptyPackage(): PackageItem {
  return { width: "", height: "", length: "", weight: "", presetId: "" };
}

export function PackageListEditor({ packages, onChange, inputClass }: PackageListEditorProps) {
  const [presets, setPresets] = useState<BoxPreset[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("box_presets")
      .select("*")
      .order("name")
      .then(({ data }) => {
        if (data) setPresets(data);
      });
  }, []);

  function updatePackage(index: number, patch: Partial<PackageItem>) {
    const updated = packages.map((p, i) => (i === index ? { ...p, ...patch } : p));
    onChange(updated);
  }

  function handlePresetChange(index: number, presetId: string) {
    if (presetId === "") {
      updatePackage(index, { presetId: "" });
      return;
    }
    const preset = presets.find((p) => p.id === presetId);
    if (preset) {
      updatePackage(index, {
        presetId,
        width: String(preset.width_cm),
        height: String(preset.height_cm),
        length: String(preset.length_cm),
        weight: String(preset.weight_kg),
      });
    }
  }

  function addPackage() {
    onChange([...packages, createEmptyPackage()]);
  }

  function removePackage(index: number) {
    if (packages.length <= 1) return;
    onChange(packages.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
          Paquetes ({packages.length})
        </p>
        <button
          type="button"
          onClick={addPackage}
          className="text-xs font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
        >
          + Añadir paquete
        </button>
      </div>

      <div className="space-y-3">
        {packages.map((pkg, index) => (
          <div
            key={index}
            className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Paquete {index + 1}
              </span>
              {packages.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePackage(index)}
                  className="text-xs text-red-500 hover:text-red-600 dark:text-red-400"
                >
                  Eliminar
                </button>
              )}
            </div>

            {presets.length > 0 && (
              <select
                value={pkg.presetId}
                onChange={(e) => handlePresetChange(index, e.target.value)}
                className={inputClass + " mb-2"}
              >
                <option value="">Personalizado</option>
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name} ({preset.width_cm}x{preset.height_cm}x{preset.length_cm}cm, {preset.weight_kg}kg)
                  </option>
                ))}
              </select>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Width (cm)</label>
                <input
                  type="number"
                  value={pkg.width}
                  onChange={(e) => updatePackage(index, { width: e.target.value, presetId: "" })}
                  min="1"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Height (cm)</label>
                <input
                  type="number"
                  value={pkg.height}
                  onChange={(e) => updatePackage(index, { height: e.target.value, presetId: "" })}
                  min="1"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Length (cm)</label>
                <input
                  type="number"
                  value={pkg.length}
                  onChange={(e) => updatePackage(index, { length: e.target.value, presetId: "" })}
                  min="1"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Weight (kg)</label>
                <input
                  type="number"
                  value={pkg.weight}
                  onChange={(e) => updatePackage(index, { weight: e.target.value, presetId: "" })}
                  min="0.1"
                  step="0.1"
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
