"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSignature, clearSignature } from "./actions";

interface Props {
  current: string | null;
  isCanonical: boolean;
}

export default function SignaturePad({ current, isCanonical }: Props) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1a1a1a";
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSigned(true);
  };

  const stopDraw = () => setIsDrawing(false);

  const wipeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSigned) {
      setFeedback({ kind: "error", msg: "Dibuja una firma antes de guardar" });
      return;
    }
    const data = canvas.toDataURL("image/png");
    setFeedback(null);
    startTransition(async () => {
      const result = await saveSignature(data);
      if (result.success) {
        setFeedback({ kind: "ok", msg: "Firma guardada" });
        wipeCanvas();
        router.refresh();
      } else {
        setFeedback({ kind: "error", msg: result.error ?? "Error al guardar" });
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("¿Borrar firma actual? Los próximos NDAs saldrán sin firma de Prototipalo hasta que dibujes una nueva.")) {
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      const result = await clearSignature();
      if (result.success) {
        setFeedback({ kind: "ok", msg: "Firma borrada" });
        router.refresh();
      } else {
        setFeedback({ kind: "error", msg: result.error ?? "Error al borrar" });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Firma actual */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Firma actual
        </h2>
        {current ? (
          <div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current} alt="Tu firma" className="mx-auto block max-h-32" />
            </div>
            {!isCanonical && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                Tienes una firma guardada, pero no eres super_admin — la firma que aparecerá en los NDAs es la del super_admin del sistema, no la tuya.
              </p>
            )}
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="text-xs text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
              >
                Borrar firma guardada
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Aún no tienes firma guardada. Dibújala abajo y los NDAs saldrán firmados por ti.
          </p>
        )}
      </div>

      {/* Canvas para dibujar */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Dibujar nueva firma
          </h2>
          {hasSigned && (
            <button
              type="button"
              onClick={wipeCanvas}
              className="text-xs text-zinc-500 hover:underline dark:text-zinc-400"
            >
              Limpiar
            </button>
          )}
        </div>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Firma con el ratón o el dedo (en móvil). Cuando estés conforme, pulsa Guardar.
        </p>
        <div className="overflow-hidden rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-600">
          <canvas
            ref={canvasRef}
            className="h-40 w-full cursor-crosshair touch-none bg-white"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />
        </div>

        {feedback && (
          <p
            className={`mt-3 text-sm ${
              feedback.kind === "ok"
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {feedback.msg}
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !hasSigned}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-zinc-900"
          >
            {isPending ? "Guardando…" : "Guardar firma"}
          </button>
        </div>
      </div>
    </div>
  );
}
