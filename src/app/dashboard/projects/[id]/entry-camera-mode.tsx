"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  uploadEntryPhoto,
  saveEntryNote,
  type NameEntry,
} from "../checklist-actions";

type Props = {
  itemId: string;
  itemName: string;
  projectId: string;
  entries: NameEntry[];
  onClose: () => void;
  onPhotoUploaded: (entryIndex: number, photoPath: string) => void;
  onNoteSaved?: (entryIndex: number, note: string) => void;
};

type Phase = "loading" | "live" | "preview" | "uploading" | "error" | "done";

export default function EntryCameraMode({
  itemId,
  itemName,
  projectId,
  entries,
  onClose,
  onPhotoUploaded,
  onNoteSaved,
}: Props) {
  // Cola: entries sin foto, o con issue (re-foto solicitada por cliente)
  const initialQueueRef = useRef<number[]>(
    entries
      .map((entry, idx) =>
        !entry.photo_path || entry.client_status === "issue" ? idx : -1,
      )
      .filter((i) => i >= 0),
  );
  const queue = initialQueueRef.current;

  const [queuePos, setQueuePos] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [fallbackMode, setFallbackMode] = useState(false);

  // Notas por índice de entry (inicializadas desde las entradas existentes)
  const [notes, setNotes] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      entries
        .map((e, idx) => [idx, e.note ?? ""] as const)
        .filter(([, note]) => note),
    ),
  );
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentEntryIndex = queue[queuePos];
  const currentEntry =
    currentEntryIndex !== undefined ? entries[currentEntryIndex] : null;

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setPhase("loading");
    try {
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setPhase("live");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al abrir la cámara";
      setError(msg);
      setFallbackMode(true);
      setPhase("error");
    }
  }, [stopStream]);

  // Inicializar cámara al montar (si hay cola)
  useEffect(() => {
    if (queue.length === 0) {
      setPhase("done");
      return;
    }
    startCamera();
    return () => {
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Limpiar URL de preview al cambiar
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("No se pudo capturar la foto");
          return;
        }
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setPhase("preview");
      },
      "image/jpeg",
      0.92,
    );
  }

  function retake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewBlob(null);
    setPreviewUrl(null);
    if (fallbackMode) {
      // En fallback, volvemos a abrir el file picker
      fileInputRef.current?.click();
    } else {
      setPhase("live");
    }
  }

  async function confirmAndNext() {
    if (!previewBlob || currentEntryIndex === undefined) return;
    setPhase("uploading");
    const fd = new FormData();
    fd.append(
      "photo",
      new File([previewBlob], `entry-${currentEntryIndex}.jpg`, {
        type: "image/jpeg",
      }),
    );
    const result = await uploadEntryPhoto(itemId, currentEntryIndex, projectId, fd);
    if (!result.success || !result.photo_path) {
      setError(result.error ?? "Error al subir la foto");
      setPhase("preview");
      return;
    }
    onPhotoUploaded(currentEntryIndex, result.photo_path);
    setCompletedCount((c) => c + 1);

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewBlob(null);
    setPreviewUrl(null);

    advanceQueue();
  }

  // Avanza a la siguiente entrada de la cola, o termina si era la última.
  function advanceQueue() {
    const nextPos = queuePos + 1;
    if (nextPos >= queue.length) {
      stopStream();
      setPhase("done");
      return;
    }
    setQueuePos(nextPos);
    setPhase("live");
  }

  // Saltar el trofeo actual (no está listo): se queda sin foto y reaparecerá
  // en la próxima sesión de fotos.
  function skipCurrent() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewBlob(null);
    setPreviewUrl(null);
    setSkippedCount((c) => c + 1);
    advanceQueue();
  }

  function openNoteEditor() {
    if (currentEntryIndex === undefined) return;
    setNoteDraft(notes[currentEntryIndex] ?? "");
    setNoteEditorOpen(true);
  }

  async function saveNote() {
    if (currentEntryIndex === undefined) return;
    setSavingNote(true);
    const text = noteDraft.trim();
    const result = await saveEntryNote(
      itemId,
      currentEntryIndex,
      projectId,
      text,
    );
    setSavingNote(false);
    if (!result.success) {
      setError(result.error ?? "Error al guardar la nota");
      return;
    }
    setNotes((prev) => {
      const next = { ...prev };
      if (text) next[currentEntryIndex] = text;
      else delete next[currentEntryIndex];
      return next;
    });
    onNoteSaved?.(currentEntryIndex, text);
    setNoteEditorOpen(false);
  }

  function handleClose() {
    stopStream();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onClose();
  }

  function handleFallbackFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewBlob(file);
    setPreviewUrl(URL.createObjectURL(file));
    setPhase("preview");
  }

  function triggerFallback() {
    fileInputRef.current?.click();
  }

  // Pantalla de "ya está todo hecho"
  if (phase === "done" || queue.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black p-6 text-white">
        <div className="max-w-sm text-center">
          <div className="mb-4 text-5xl">✓</div>
          <h2 className="mb-2 text-xl font-semibold">
            {completedCount > 0
              ? `${completedCount} foto${completedCount === 1 ? "" : "s"} guardada${completedCount === 1 ? "" : "s"}`
              : "Todo fotografiado"}
          </h2>
          <p className="mb-6 text-sm text-zinc-400">
            {queue.length === 0
              ? "No hay trofeos pendientes de foto."
              : skippedCount > 0
                ? `Has terminado la sesión. ${skippedCount} trofeo${skippedCount === 1 ? "" : "s"} saltado${skippedCount === 1 ? "" : "s"} quedan pendientes de foto.`
                : "Has terminado la sesión de fotos."}
          </p>
          <button
            onClick={handleClose}
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      {/* Header overlay */}
      <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/80 to-transparent px-4 pt-[env(safe-area-inset-top,0px)] pb-6">
        <div className="flex items-start justify-between gap-3 pt-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-300">
              {itemName} · {queuePos + 1} de {queue.length}
            </p>
            <h2 className="mt-1 truncate text-2xl font-bold leading-tight">
              {currentEntry?.line1 ?? ""}
            </h2>
            {currentEntry?.line2 && (
              <p className="truncate text-sm text-zinc-300">
                {currentEntry.line2}
              </p>
            )}
            {currentEntryIndex !== undefined && notes[currentEntryIndex] && (
              <p className="mt-1 truncate text-xs text-amber-300">
                📝 {notes[currentEntryIndex]}
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="shrink-0 rounded-full bg-white/15 p-2 backdrop-blur hover:bg-white/25"
            aria-label="Cerrar"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Barra de progreso */}
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full bg-white transition-all"
            style={{ width: `${(queuePos / queue.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Viewfinder o preview */}
      <div className="relative flex-1 overflow-hidden bg-black">
        {phase === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
            Abriendo cámara…
          </div>
        )}

        {phase === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm text-zinc-300">
              No se ha podido abrir la cámara: {error}
            </p>
            <button
              onClick={triggerFallback}
              className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200"
            >
              Usar cámara del sistema
            </button>
            <button
              onClick={startCamera}
              className="text-xs text-zinc-400 underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {!fallbackMode && (
          <video
            ref={videoRef}
            playsInline
            muted
            className={`h-full w-full object-cover ${
              phase === "live" ? "" : "opacity-0"
            }`}
          />
        )}

        {phase === "preview" && previewUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Captura"
              className="h-full w-full object-contain"
            />
          </div>
        )}

        {phase === "uploading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm">
            Subiendo foto…
          </div>
        )}
      </div>

      {/* Controles inferiores */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 to-transparent px-4 pb-[max(env(safe-area-inset-bottom,0px),16px)] pt-8">
        {phase === "live" && (
          <div className="flex items-center justify-between">
            <button
              onClick={skipCurrent}
              className="flex w-20 shrink-0 flex-col items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-200 hover:bg-white/10"
              aria-label="Saltar este trofeo"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5l7 7-7 7M13 5l7 7-7 7" />
              </svg>
              Saltar
            </button>

            {fallbackMode ? (
              <button
                onClick={triggerFallback}
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black"
              >
                Hacer foto
              </button>
            ) : (
              <button
                onClick={capture}
                className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/40 bg-white/10 active:scale-95 active:bg-white/30 transition-transform"
                aria-label="Capturar"
              >
                <span className="block h-16 w-16 rounded-full bg-white" />
              </button>
            )}

            <button
              onClick={openNoteEditor}
              className="flex w-20 shrink-0 flex-col items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-200 hover:bg-white/10"
              aria-label="Añadir nota"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {currentEntryIndex !== undefined && notes[currentEntryIndex]
                ? "Nota ✓"
                : "Nota"}
            </button>
          </div>
        )}

        {phase === "preview" && (
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={retake}
              className="flex-1 rounded-lg border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold backdrop-blur hover:bg-white/20"
            >
              Repetir
            </button>
            <button
              onClick={confirmAndNext}
              className="flex-1 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-zinc-200"
            >
              {queuePos + 1 >= queue.length ? "Usar y terminar" : "Usar y siguiente"}
            </button>
          </div>
        )}

        {error && phase === "preview" && (
          <p className="mt-2 text-center text-xs text-red-300">{error}</p>
        )}
      </div>

      {/* Editor de nota */}
      {noteEditorOpen && (
        <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-xl bg-zinc-900 p-4 ring-1 ring-white/10">
            <h3 className="mb-1 text-sm font-semibold text-white">
              Nota para {currentEntry?.line1 || "este trofeo"}
            </h3>
            <p className="mb-3 text-xs text-zinc-400">
              Ej. &quot;no estaba listo&quot;, &quot;falta pintar&quot;, etc.
            </p>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={3}
              autoFocus
              placeholder="Escribe una nota…"
              className="w-full resize-none rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-white/40 focus:outline-none"
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                onClick={() => setNoteEditorOpen(false)}
                disabled={savingNote}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveNote}
                disabled={savingNote}
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
              >
                {savingNote ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input fallback (cuando getUserMedia no funciona) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFallbackFile}
      />
    </div>
  );
}
