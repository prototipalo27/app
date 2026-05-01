"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import { submitEntryReview } from "../names/actions";

export type ReviewEntry = {
  itemId: string;
  itemName: string;
  entryIndex: number;
  line1: string;
  line2?: string;
  clientStatus: "pending" | "approved" | "issue";
  clientComment?: string;
};

export default function ClientReviewCarousel({
  token,
  projectName,
  entries: initialEntries,
  alreadyConfirmed,
}: {
  token: string;
  projectName: string;
  entries: ReviewEntry[];
  alreadyConfirmed: boolean;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [activeIndex, setActiveIndex] = useState(() => {
    // Empezar en el primer pendiente, si lo hay
    const firstPending = initialEntries.findIndex(
      (e) => e.clientStatus === "pending",
    );
    return firstPending >= 0 ? firstPending : 0;
  });
  const [issueModalIdx, setIssueModalIdx] = useState<number | null>(null);
  const [issueText, setIssueText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const scrollerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  const approvedCount = entries.filter((e) => e.clientStatus === "approved").length;
  const issueCount = entries.filter((e) => e.clientStatus === "issue").length;
  const pendingCount = entries.filter((e) => e.clientStatus === "pending").length;

  // Sincronizar scroll con activeIndex (cuando cambia por programación)
  useEffect(() => {
    const slide = slideRefs.current[activeIndex];
    if (slide) {
      slide.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    }
  }, [activeIndex]);

  // Detectar slide visible al hacer swipe manual
  function handleScroll() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const slideWidth = scroller.clientWidth;
    const idx = Math.round(scroller.scrollLeft / slideWidth);
    if (idx !== activeIndex && idx >= 0 && idx < entries.length) {
      setActiveIndex(idx);
    }
  }

  function advanceToNextPending(currentIdx: number) {
    // Buscar siguiente pendiente desde currentIdx + 1, dando vueltas
    for (let offset = 1; offset <= entries.length; offset++) {
      const next = (currentIdx + offset) % entries.length;
      if (entries[next].clientStatus === "pending") {
        setActiveIndex(next);
        return;
      }
    }
    // No quedan pendientes, quédate donde estás
  }

  function approve(idx: number) {
    if (alreadyConfirmed) return;
    setError(null);
    const entry = entries[idx];
    // Optimistic
    setEntries((prev) =>
      prev.map((e, i) =>
        i === idx ? { ...e, clientStatus: "approved", clientComment: undefined } : e,
      ),
    );
    startTransition(async () => {
      const result = await submitEntryReview(
        token,
        entry.itemId,
        entry.entryIndex,
        "approved",
      );
      if (!result.success) {
        setError(result.error ?? "Error al aprobar");
        setEntries(initialEntries);
        return;
      }
      advanceToNextPending(idx);
    });
  }

  function openIssue(idx: number) {
    if (alreadyConfirmed) return;
    setIssueText(entries[idx].clientComment ?? "");
    setIssueModalIdx(idx);
    setError(null);
  }

  function submitIssue() {
    if (issueModalIdx === null) return;
    const idx = issueModalIdx;
    const entry = entries[idx];
    const trimmed = issueText.trim();
    if (!trimmed) {
      setError("Escribe qué hay que cambiar");
      return;
    }
    setError(null);
    // Optimistic
    setEntries((prev) =>
      prev.map((e, i) =>
        i === idx ? { ...e, clientStatus: "issue", clientComment: trimmed } : e,
      ),
    );
    setIssueModalIdx(null);
    startTransition(async () => {
      const result = await submitEntryReview(
        token,
        entry.itemId,
        entry.entryIndex,
        "issue",
        trimmed,
      );
      if (!result.success) {
        setError(result.error ?? "Error al guardar comentario");
        setEntries(initialEntries);
        return;
      }
      advanceToNextPending(idx);
    });
  }

  const active = entries[activeIndex];

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950 px-4 pt-[max(env(safe-area-inset-top,0px),12px)] pb-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-[11px] uppercase tracking-wider text-zinc-400">
              {projectName}
            </p>
            <h1 className="text-sm font-semibold">
              Revisar fotos · {activeIndex + 1} de {entries.length}
            </h1>
          </div>
          <Link
            href={`/track/${token}/confirm`}
            className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20"
          >
            Hecho
          </Link>
        </div>

        {/* Resumen contadores */}
        <div className="mx-auto mt-3 flex max-w-2xl items-center gap-2 text-[11px]">
          <span className="rounded-full bg-green-500/20 px-2 py-0.5 font-semibold text-green-300">
            ✓ {approvedCount}
          </span>
          {issueCount > 0 && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-semibold text-amber-300">
              💬 {issueCount}
            </span>
          )}
          {pendingCount > 0 && (
            <span className="rounded-full bg-zinc-700 px-2 py-0.5 font-semibold text-zinc-300">
              ⏳ {pendingCount}
            </span>
          )}
        </div>
      </header>

      {/* Carrusel con scroll-snap */}
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth"
        style={{ scrollbarWidth: "none" }}
      >
        {entries.map((entry, idx) => (
          <div
            key={`${entry.itemId}-${entry.entryIndex}`}
            ref={(el) => {
              slideRefs.current[idx] = el;
            }}
            className="flex h-full w-full shrink-0 snap-start flex-col items-center justify-center px-4 py-4"
          >
            <div className="flex h-full w-full max-w-2xl flex-col items-center justify-center">
              {/* Imagen */}
              <div className="flex w-full flex-1 items-center justify-center overflow-hidden rounded-xl bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/track/qc-photos/${entry.itemId}/entry/${entry.entryIndex}`}
                  alt={entry.line1}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              {/* Etiqueta */}
              <div className="mt-3 w-full text-center">
                <h2 className="text-lg font-semibold leading-tight">{entry.line1}</h2>
                {entry.line2 && (
                  <p className="text-sm text-zinc-400">{entry.line2}</p>
                )}
                {entry.clientStatus === "approved" && (
                  <span className="mt-1 inline-block rounded-full bg-green-500/20 px-2 py-0.5 text-[11px] font-semibold text-green-300">
                    ✓ Aprobado
                  </span>
                )}
                {entry.clientStatus === "issue" && (
                  <div className="mt-1 inline-block max-w-full rounded-lg bg-amber-500/15 px-2 py-1 text-left text-[11px] text-amber-300">
                    💬 {entry.clientComment}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Botonera inferior */}
      <div className="border-t border-zinc-800 bg-zinc-950 px-4 pb-[max(env(safe-area-inset-bottom,0px),12px)] pt-3">
        {alreadyConfirmed ? (
          <p className="text-center text-xs text-zinc-400">
            Ya has confirmado el envío. Para cambios contacta con nosotros.
          </p>
        ) : (
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <button
              onClick={() => openIssue(activeIndex)}
              disabled={pending}
              className="flex-1 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
            >
              💬 Algo no encaja
            </button>
            <button
              onClick={() => approve(activeIndex)}
              disabled={pending}
              className="flex-1 rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-50"
            >
              {active?.clientStatus === "approved" ? "✓ Aprobado" : "✓ Aprobar"}
            </button>
          </div>
        )}
        {error && (
          <p className="mt-2 text-center text-xs text-red-400">{error}</p>
        )}
      </div>

      {/* Modal comentario */}
      {issueModalIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-zinc-900 p-5 sm:rounded-2xl">
            <h3 className="mb-1 text-sm font-semibold text-white">
              ¿Qué hay que cambiar?
            </h3>
            <p className="mb-3 text-xs text-zinc-400">
              {entries[issueModalIdx].line1}
              {entries[issueModalIdx].line2 ? ` — ${entries[issueModalIdx].line2}` : ""}
            </p>
            <textarea
              value={issueText}
              onChange={(e) => setIssueText(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Ej: el nombre tiene una errata, el color no coincide…"
              className="block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            {error && (
              <p className="mt-2 text-xs text-red-400">{error}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setIssueModalIdx(null);
                  setIssueText("");
                  setError(null);
                }}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                onClick={submitIssue}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
