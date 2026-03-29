"use client";

import { useState, useCallback, useRef } from "react";
import { calculateSTLVolumeCm3 } from "@/lib/stl-volume";
import dynamic from "next/dynamic";

const ModelViewer = dynamic(
  () => import("@/components/stl-viewer").then((m) => m.ModelViewer),
  { ssr: false },
);

const PRICE_PER_HOUR = 10;
// Empirical factor: minutes per cm³ of solid volume for PLA, 15% infill, 0.2mm layer
// Accounts for perimeters, infill, travel, and overhead
const MINUTES_PER_CM3 = 3.5;
const BASE_MINUTES = 8; // Warmup, bed leveling, purge

interface QuoteResult {
  volumeCm3: number;
  estimatedMinutes: number;
  estimatedPrice: number;
  fileName: string;
  fileUrl: string;
}

export function QuoteCalculator() {
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [units, setUnits] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [formSent, setFormSent] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".stl")) {
      setError("Solo se aceptan archivos STL");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setError("El archivo es demasiado grande (max 100MB)");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const volumeCm3 = calculateSTLVolumeCm3(buffer);

      if (volumeCm3 < 0.01) {
        setError("No se ha podido calcular el volumen. Comprueba que el STL es valido.");
        setLoading(false);
        return;
      }

      const estimatedMinutes = Math.ceil(BASE_MINUTES + volumeCm3 * MINUTES_PER_CM3);
      const estimatedPrice = Math.ceil((estimatedMinutes / 60) * PRICE_PER_HOUR * 100) / 100;
      const fileUrl = URL.createObjectURL(file);

      setResult({
        volumeCm3,
        estimatedMinutes,
        estimatedPrice,
        fileName: file.name,
        fileUrl,
      });
      setUnits(1);
      setShowForm(false);
      setFormSent(false);
    } catch {
      setError("Error al procesar el archivo STL");
    }

    setLoading(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const totalMinutes = result ? result.estimatedMinutes * units : 0;
  const totalPrice = result
    ? Math.ceil((totalMinutes / 60) * PRICE_PER_HOUR * 100) / 100
    : 0;

  const handleSubmitLead = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!result) return;

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value;
    const message = (form.elements.namedItem("message") as HTMLTextAreaElement)?.value || "";

    setSending(true);
    try {
      const res = await fetch("/api/cotizador/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          message: `[Cotizador 3D] ${result.fileName}\nVolumen: ${result.volumeCm3.toFixed(1)} cm³\nTiempo estimado: ${totalMinutes} min\nUnidades: ${units}\nPrecio estimado: ${totalPrice.toFixed(2)}€\n\n${message}`,
        }),
      });
      if (res.ok) {
        setFormSent(true);
      }
    } catch {
      // silent
    }
    setSending(false);
  };

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition-colors ${
          dragOver
            ? "border-brand bg-brand/5"
            : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
        }`}
      >
        <svg
          className="mb-3 h-12 w-12 text-zinc-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
          />
        </svg>
        {loading ? (
          <p className="text-sm text-zinc-500">Procesando...</p>
        ) : (
          <>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Arrastra tu archivo STL aqui
            </p>
            <p className="mt-1 text-xs text-zinc-400">o haz click para seleccionar</p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".stl"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-900/10 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {/* 3D Preview */}
          <div className="h-64 overflow-hidden rounded-xl border bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
            <ModelViewer url={result.fileUrl} fileName={result.fileName} />
          </div>

          {/* File info */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-900 dark:text-white">{result.fileName}</p>
            <button
              onClick={() => {
                setResult(null);
                setError(null);
              }}
              className="text-xs text-zinc-400 hover:text-zinc-600"
            >
              Cambiar archivo
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-zinc-50 p-3 text-center dark:bg-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Volumen</p>
              <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-white">
                {result.volumeCm3.toFixed(1)}
              </p>
              <p className="text-xs text-zinc-400">cm³</p>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 text-center dark:bg-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Tiempo est.</p>
              <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-white">
                {totalMinutes >= 60
                  ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
                  : `${totalMinutes}m`}
              </p>
              <p className="text-xs text-zinc-400">por {units} ud{units > 1 ? "s" : ""}</p>
            </div>
            <div className="rounded-lg bg-brand/10 p-3 text-center">
              <p className="text-xs text-brand/70">Precio est.</p>
              <p className="text-2xl font-bold tabular-nums text-brand">
                {totalPrice.toFixed(0)}€
              </p>
              <p className="text-xs text-brand/50">+ IVA</p>
            </div>
          </div>

          {/* Units selector */}
          <div className="flex items-center justify-center gap-3">
            <label className="text-sm text-zinc-500 dark:text-zinc-400">Unidades:</label>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setUnits(Math.max(1, units - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                -
              </button>
              <input
                type="number"
                min={1}
                value={units}
                onChange={(e) => setUnits(Math.max(1, parseInt(e.target.value) || 1))}
                className="h-8 w-16 rounded-lg border bg-white px-2 text-center text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-800"
              />
              <button
                onClick={() => setUnits(units + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                +
              </button>
            </div>
          </div>

          {/* CTA */}
          {!showForm && !formSent && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              Solicitar presupuesto formal
            </button>
          )}

          {/* Lead form */}
          {showForm && !formSent && (
            <form onSubmit={handleSubmitLead} className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Dejanos tus datos y te enviamos un presupuesto detallado
              </p>
              <input
                name="name"
                type="text"
                required
                placeholder="Nombre"
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <input
                name="email"
                type="email"
                required
                placeholder="Email"
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <textarea
                name="message"
                placeholder="Comentarios (material, acabado, plazo...)"
                rows={2}
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <button
                type="submit"
                disabled={sending}
                className="w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
              >
                {sending ? "Enviando..." : "Enviar solicitud"}
              </button>
            </form>
          )}

          {formSent && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center text-sm text-green-700 dark:border-green-900/50 dark:bg-green-900/10 dark:text-green-400">
              Solicitud enviada. Te contactaremos pronto con un presupuesto detallado.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
