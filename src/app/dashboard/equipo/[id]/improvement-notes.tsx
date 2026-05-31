"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  createImprovementNote,
  resolveImprovementNote,
  deleteImprovementNote,
} from "./actions";

export interface ImprovementNote {
  id: string;
  content: string;
  created_at: string;
  created_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
}

interface Props {
  userId: string;
  notes: ImprovementNote[];
  userMap: Record<string, string>;
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

export default function ImprovementNotes({ userId, notes, userMap }: Props) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showResolved, setShowResolved] = useState(false);

  const { pending, resolved } = useMemo(() => {
    const pending: ImprovementNote[] = [];
    const resolved: ImprovementNote[] = [];
    for (const n of notes) {
      if (n.resolved_at) resolved.push(n);
      else pending.push(n);
    }
    return { pending, resolved };
  }, [notes]);

  const handleAdd = () => {
    setError(null);
    if (!content.trim()) return;
    startTransition(async () => {
      const res = await createImprovementNote(userId, content);
      if (!res.success) {
        setError(res.error || "Error al guardar");
        return;
      }
      setContent("");
      router.refresh();
    });
  };

  const handleResolve = (noteId: string, currentlyResolved: boolean) => {
    startTransition(async () => {
      await resolveImprovementNote(noteId, !currentlyResolved);
      router.refresh();
    });
  };

  const handleDelete = (noteId: string) => {
    if (!confirm("¿Eliminar esta nota?")) return;
    startTransition(async () => {
      await deleteImprovementNote(noteId);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/40 p-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Ej: Hablar sobre uso del móvil en taller, repasar seguimiento de Aico…"
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            Solo visible para managers. Marca como tratada cuando lo comentes en la próxima 1-on-1.
          </p>
          <button
            type="button"
            onClick={handleAdd}
            disabled={isPending || !content.trim()}
            className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand/90 disabled:opacity-50"
          >
            {isPending ? "Guardando..." : "Añadir"}
          </button>
        </div>
      </div>

      {pending.length === 0 && resolved.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Sin puntos pendientes. Anota algo cuando surja para tenerlo a mano en la próxima reunión.
        </p>
      ) : (
        <>
          {pending.length > 0 && (
            <ul className="space-y-2">
              {pending.map((n) => (
                <li
                  key={n.id}
                  className="group flex items-start gap-2 rounded-lg border bg-background p-3"
                >
                  <button
                    type="button"
                    onClick={() => handleResolve(n.id, false)}
                    disabled={isPending}
                    title="Marcar como tratado"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border border-input hover:bg-accent"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap text-sm text-foreground">{n.content}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatDay(n.created_at)}
                      {n.created_by && userMap[n.created_by] && ` · ${userMap[n.created_by]}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(n.id)}
                    disabled={isPending}
                    title="Eliminar"
                    className="shrink-0 text-muted-foreground/40 opacity-0 hover:text-destructive group-hover:opacity-100"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {resolved.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowResolved((v) => !v)}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                {showResolved ? "▾" : "▸"} Tratadas ({resolved.length})
              </button>
              {showResolved && (
                <ul className="mt-2 space-y-1.5 opacity-60">
                  {resolved.map((n) => (
                    <li
                      key={n.id}
                      className="group flex items-start gap-2 rounded-lg border border-dashed bg-background p-2"
                    >
                      <button
                        type="button"
                        onClick={() => handleResolve(n.id, true)}
                        disabled={isPending}
                        title="Reabrir"
                        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-input bg-brand text-white hover:bg-brand/80"
                      >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-wrap text-xs text-foreground line-through">
                          {n.content}
                        </p>
                        {n.resolved_at && (
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            tratada {formatDay(n.resolved_at)}
                            {n.resolved_by && userMap[n.resolved_by] && ` · ${userMap[n.resolved_by]}`}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(n.id)}
                        disabled={isPending}
                        title="Eliminar"
                        className="shrink-0 text-muted-foreground/40 opacity-0 hover:text-destructive group-hover:opacity-100"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
