"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import * as THREE from "three";
import {
  generateCarcasaStl,
  measureDxf,
  type DxfUnit,
  type DxfMeasure,
  type GenerateResult,
} from "@/lib/dxf-carcasa";

const UNIT_MM: Record<Exclude<DxfUnit, "auto">, number> = { mm: 1, cm: 10, m: 1000, in: 25.4 };

// ── Previsualización 3D del STL generado ───────────────

function Model({ buffer }: { buffer: ArrayBuffer }) {
  const geometry = useMemo(() => {
    const geo = new STLLoader().parse(buffer.slice(0));
    geo.center();
    geo.computeVertexNormals();
    return geo;
  }, [buffer]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color="#9ca3af" metalness={0.2} roughness={0.6} />
    </mesh>
  );
}

function Preview({ buffer }: { buffer: ArrayBuffer }) {
  return (
    <div className="h-64 w-full overflow-hidden rounded-xl bg-zinc-900">
      <Canvas camera={{ position: [1.5, 1.5, 2.5], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={1} />
        <directionalLight position={[-5, -3, -5]} intensity={0.3} />
        <Suspense fallback={null}>
          <Stage adjustCamera={1.1} intensity={0.4} environment={null} shadows={false}>
            <Model buffer={buffer} />
          </Stage>
        </Suspense>
        <OrbitControls enableDamping dampingFactor={0.1} />
      </Canvas>
    </div>
  );
}

// ── Campo numérico ─────────────────────────────────────

function NumField({
  label,
  value,
  onChange,
  step = "0.5",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</span>
      <input
        type="number"
        step={step}
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
      />
      {hint && <span className="mt-0.5 block text-[10px] text-zinc-400">{hint}</span>}
    </label>
  );
}

// ── Componente principal ───────────────────────────────

const DEFAULTS = { depth: "35", back: "2", wall: "3", frontLip: "1.5", acrylic: "2" };

export default function CarcasaCalculator() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [dxfText, setDxfText] = useState<string | null>(null);
  const [measure, setMeasure] = useState<DxfMeasure | null>(null);
  const [targetWidth, setTargetWidth] = useState("");
  const [unit, setUnit] = useState<DxfUnit>("auto");
  const [mirror, setMirror] = useState(false);
  const [p, setP] = useState(DEFAULTS);

  const hasOverride = parseFloat(targetWidth) > 0;
  const unitMmDisplay = unit === "auto" ? measure?.unitMmAuto ?? 1 : UNIT_MM[unit];
  const detectedMm = measure ? measure.widthRaw * unitMmDisplay : null;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const urlRef = useRef<string | null>(null);

  const set = (k: keyof typeof DEFAULTS) => (v: string) => setP((s) => ({ ...s, [k]: v }));

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setResult(null);
    setFileName(f.name);
    setMeasure(null);
    setTargetWidth("");
    try {
      const text = await f.text();
      setDxfText(text);
      try {
        setMeasure(measureDxf(text));
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo leer el DXF.");
      }
    } catch {
      setError("No se pudo leer el archivo.");
      setDxfText(null);
    }
  }

  async function generate() {
    if (!dxfText) return;
    setBusy(true);
    setError(null);
    // ceder al hilo para pintar el spinner antes del cálculo síncrono
    await new Promise((r) => setTimeout(r, 20));
    try {
      const res = generateCarcasaStl(dxfText, {
        depth: parseFloat(p.depth) || 35,
        back: parseFloat(p.back) || 2,
        wall: parseFloat(p.wall) || 3,
        frontLip: parseFloat(p.frontLip) || 1.5,
        acrylic: parseFloat(p.acrylic) || 2,
        unit,
        mirror,
        overrideWidthMm: hasOverride ? parseFloat(targetWidth) : null,
      });
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(new Blob([res.stl], { type: "model/stl" }));
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar la carcasa.");
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!urlRef.current) return;
    const base = (fileName ?? "carcasa").replace(/\.dxf$/i, "");
    const a = document.createElement("a");
    a.href = urlRef.current;
    a.download = `${base}_carcasa.stl`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Sube el DXF con el contorno de la letra y genera la carcasa 3D (STL) para letras corpóreas
        con frontal de metacrilato.
      </p>

      {/* Subida de DXF */}
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center transition hover:border-green-400 dark:border-zinc-700 dark:bg-zinc-800/50">
        <svg className="h-7 w-7 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.88-7.9A5 5 0 1115.9 6H16a5 5 0 011 9.9M12 11v6m0 0l-2.5-2.5M12 17l2.5-2.5" />
        </svg>
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          {fileName ?? "Seleccionar archivo DXF"}
        </span>
        <span className="text-[11px] text-zinc-400">Formato .dxf con contornos cerrados</span>
        <input type="file" accept=".dxf" onChange={onFile} className="hidden" />
      </label>

      {/* Dimensiones detectadas + corrección de escala */}
      {measure && (
        <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Ancho detectado</span>
            <span className="font-semibold text-zinc-900 dark:text-white">
              {detectedMm != null
                ? `${detectedMm.toFixed(1)} mm${detectedMm >= 1000 ? ` (${(detectedMm / 1000).toFixed(2)} m)` : ""}`
                : "—"}
            </span>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Ancho real de la letra (mm) — opcional
            </span>
            <input
              type="number"
              step="1"
              min="0"
              value={targetWidth}
              onChange={(e) => setTargetWidth(e.target.value)}
              placeholder={detectedMm != null ? detectedMm.toFixed(0) : "p. ej. 1000"}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
            <span className="mt-0.5 block text-[10px] text-zinc-400">
              Si el ancho detectado no es correcto, indica el real y se reescalará todo el DXF a esa medida.
            </span>
          </label>
        </div>
      )}

      {/* Parámetros */}
      <div className="grid grid-cols-2 gap-3">
        <NumField label="Profundidad total (mm)" value={p.depth} onChange={set("depth")} hint="Ajustable: más gruesa o fina" />
        <NumField label="Fondo (mm)" value={p.back} onChange={set("back")} />
        <NumField label="Pared (mm)" value={p.wall} onChange={set("wall")} />
        <NumField label="Metacrilato (mm)" value={p.acrylic} onChange={set("acrylic")} hint="Grosor del acrílico frontal" />
        <NumField label="Labio frontal (mm)" value={p.frontLip} onChange={set("frontLip")} hint="Pared por delante del acrílico" />
        <label className="block">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Unidades del DXF</span>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as DxfUnit)}
            disabled={hasOverride}
            title={hasOverride ? "Ignorado: se usa el ancho real indicado" : undefined}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-green-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            <option value="auto">Auto (según el archivo)</option>
            <option value="mm">Milímetros</option>
            <option value="cm">Centímetros</option>
            <option value="m">Metros</option>
            <option value="in">Pulgadas</option>
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
        <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} className="h-4 w-4 rounded border-zinc-300 text-green-600 focus:ring-green-400" />
        Espejar en X (si la letra queda invertida)
      </label>

      <button
        onClick={generate}
        disabled={!dxfText || busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:disabled:bg-zinc-700"
      >
        {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
        {busy ? "Generando…" : "Generar carcasa STL"}
      </button>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {result && urlRef.current && (
        <div className="space-y-3">
          <Preview buffer={result.stl} />

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-zinc-100 py-2 dark:bg-zinc-800">
              <p className="font-semibold text-zinc-900 dark:text-white">
                {result.sizeMm.x.toFixed(0)} × {result.sizeMm.y.toFixed(0)} mm
              </p>
              <p className="text-zinc-500">Tamaño letra</p>
            </div>
            <div className="rounded-lg bg-zinc-100 py-2 dark:bg-zinc-800">
              <p className="font-semibold text-zinc-900 dark:text-white">{p.depth} mm</p>
              <p className="text-zinc-500">Profundidad</p>
            </div>
            <div className="rounded-lg bg-zinc-100 py-2 dark:bg-zinc-800">
              <p className="font-semibold text-zinc-900 dark:text-white">
                {result.triangleCount.toLocaleString("es")}
              </p>
              <p className="text-zinc-500">Triángulos</p>
            </div>
          </div>

          {result.warnings.map((w, i) => (
            <div key={i} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
              ⚠️ {w}
            </div>
          ))}
          {result.skippedEntities.length > 0 && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
              ⚠️ Se ignoraron entidades no soportadas: {result.skippedEntities.join(", ")}
            </div>
          )}

          <button
            onClick={download}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-green-600 px-4 py-2.5 text-sm font-semibold text-green-700 transition hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            Descargar STL
          </button>
        </div>
      )}
    </div>
  );
}
