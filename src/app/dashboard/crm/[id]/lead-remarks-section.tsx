"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLeadRemark, deleteLeadRemark } from "../actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatDayMonthTime } from "@/lib/dates";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";

const REMARK_PHOTO_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const REMARK_PHOTO_MAX_FILES = 12;

export interface LeadRemark {
  id: string;
  content: string | null;
  photo_paths: string[];
  created_at: string;
  created_by: string | null;
}

const STYLE_SUGGESTIONS = [
  "Corporativo",
  "Deportivo",
  "Lujo",
  "Minimalista",
  "Infantil",
  "Vintage",
];

interface Props {
  leadId: string;
  remarks: LeadRemark[];
  userMap: Record<string, string>;
}

export default function LeadRemarksSection({ leadId, remarks, userMap }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ remarkId: string; index: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const handleAddFiles = (newFiles: FileList | File[] | null) => {
    if (!newFiles) return;
    const arr = Array.from(newFiles).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    setFiles((prev) => [...prev, ...arr].slice(0, 12));
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    if (!showForm) setShowForm(true);
    handleAddFiles(e.dataTransfer.files);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.files;
    if (items && items.length > 0) {
      const imgs = Array.from(items).filter((f) => f.type.startsWith("image/"));
      if (imgs.length > 0) {
        e.preventDefault();
        if (!showForm) setShowForm(true);
        handleAddFiles(imgs);
      }
    }
  };

  const removeFileAt = (i: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  };

  const resetForm = () => {
    setContent("");
    setFiles([]);
    setError(null);
    setShowForm(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = () => {
    setError(null);
    if (!content.trim() && files.length === 0) {
      setError("Escribe una nota o adjunta una foto");
      return;
    }
    if (files.length > REMARK_PHOTO_MAX_FILES) {
      setError(`Máximo ${REMARK_PHOTO_MAX_FILES} fotos por nota`);
      return;
    }
    for (const f of files) {
      if (f.size > REMARK_PHOTO_MAX_BYTES) {
        setError(`"${f.name}" supera 10 MB`);
        return;
      }
    }

    startTransition(async () => {
      // Subimos las fotos directamente al bucket desde el navegador para
      // esquivar el límite de payload de las server actions (~1 MB).
      const supabase = createBrowserSupabase();
      const uploadedPaths: string[] = [];
      try {
        for (const file of files) {
          const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
          const path = `${leadId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("lead-remarks")
            .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
          if (uploadError) {
            throw new Error(`Error subiendo "${file.name}": ${uploadError.message}`);
          }
          uploadedPaths.push(path);
        }
      } catch (e) {
        if (uploadedPaths.length > 0) {
          await supabase.storage.from("lead-remarks").remove(uploadedPaths);
        }
        setError(e instanceof Error ? e.message : "Error subiendo fotos");
        return;
      }

      const res = await createLeadRemark(leadId, {
        content,
        photo_paths: uploadedPaths,
      });
      if (!res.success) {
        if (uploadedPaths.length > 0) {
          await supabase.storage.from("lead-remarks").remove(uploadedPaths);
        }
        setError(res.error || "Error al guardar");
        return;
      }
      resetForm();
      router.refresh();
    });
  };

  const handleDelete = (remarkId: string) => {
    if (!confirm("¿Eliminar esta nota?")) return;
    startTransition(async () => {
      await deleteLeadRemark(remarkId);
      router.refresh();
    });
  };

  const appendSuggestion = (s: string) => {
    setContent((prev) => (prev ? `${prev.trim()} ${s}` : s));
  };

  const activeRemark = lightbox ? remarks.find((r) => r.id === lightbox.remarkId) : null;

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPaste={handlePaste}
      className="relative"
    >
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-brand bg-brand/10 backdrop-blur-sm">
          <p className="text-sm font-semibold text-brand">Suelta las fotos aquí</p>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">Notas comerciales</h3>
          <p className="text-[11px] text-muted-foreground">
            Lo que ha contado el cliente: estilo, referencias, decisiones…
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          className="h-7 px-2 text-xs"
        >
          {showForm ? "Cancelar" : "+ Añadir"}
        </Button>
      </div>

      {showForm && (
        <div className="mb-3 space-y-2 rounded-lg border bg-muted/50 p-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Ej: Quiere algo corporativo, sobrio. Prefiere acabados mate."
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />

          <div className="flex flex-wrap gap-1">
            {STYLE_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => appendSuggestion(s)}
                className="rounded-full border border-input bg-background px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                + {s}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-input bg-background px-3 py-4 text-xs text-muted-foreground transition-colors hover:border-brand hover:bg-accent hover:text-foreground"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span>Arrastra fotos aquí, pega con ⌘V o haz clic</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              handleAddFiles(e.target.files);
              if (e.target) e.target.value = "";
            }}
            className="hidden"
          />

          {files.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {files.map((f, i) => {
                const url = URL.createObjectURL(f);
                return (
                  <div key={i} className="relative aspect-square overflow-hidden rounded-md border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={f.name}
                      className="h-full w-full object-cover"
                      onLoad={() => URL.revokeObjectURL(url)}
                    />
                    <button
                      type="button"
                      onClick={() => removeFileAt(i)}
                      className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full"
          >
            {isPending ? "Guardando..." : "Guardar nota"}
          </Button>
        </div>
      )}

      {remarks.length === 0 && !showForm ? (
        <p className="text-xs text-muted-foreground">
          Sin notas todavía. Añade lo que el cliente quiere para tenerlo siempre a mano.
        </p>
      ) : (
        <div className="space-y-3">
          {remarks.map((r) => {
            const author = r.created_by ? userMap[r.created_by] : null;
            return (
              <div key={r.id} className="group rounded-lg border bg-background p-3">
                <div className="mb-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{formatDayMonthTime(r.created_at)}</span>
                  {author && <span>· {author}</span>}
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={isPending}
                    className="ml-auto text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    title="Eliminar"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {r.content && (
                  <p className="whitespace-pre-wrap text-sm text-foreground">{r.content}</p>
                )}

                {r.photo_paths.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {r.photo_paths.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setLightbox({ remarkId: r.id, index: i })}
                        className="group/photo relative aspect-square overflow-hidden rounded-md border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/lead-remarks/${r.id}/photo/${i}`}
                          alt={`Foto ${i + 1}`}
                          loading="lazy"
                          className="h-full w-full object-cover transition group-hover/photo:scale-105"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={lightbox !== null}
        onOpenChange={(open) => { if (!open) setLightbox(null); }}
      >
        <DialogContent
          showCloseButton
          className="max-w-[90vw] bg-transparent p-0 ring-0 shadow-none sm:max-w-[90vw]"
        >
          {lightbox && activeRemark && (
            <div className="relative flex items-center justify-center">
              {activeRemark.photo_paths.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setLightbox({
                        remarkId: lightbox.remarkId,
                        index: (lightbox.index - 1 + activeRemark.photo_paths.length) % activeRemark.photo_paths.length,
                      })
                    }
                    className="absolute left-2 z-10 bg-white/10 text-white hover:bg-white/20"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setLightbox({
                        remarkId: lightbox.remarkId,
                        index: (lightbox.index + 1) % activeRemark.photo_paths.length,
                      })
                    }
                    className="absolute right-2 z-10 bg-white/10 text-white hover:bg-white/20"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Button>
                </>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/lead-remarks/${lightbox.remarkId}/photo/${lightbox.index}`}
                alt={`Foto ${lightbox.index + 1}`}
                className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
              />
              {activeRemark.photo_paths.length > 1 && (
                <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
                  {lightbox.index + 1} / {activeRemark.photo_paths.length}
                </span>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
