"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export type AttachmentKind = "image" | "pdf" | "other";

export interface AttachmentItem {
  /** Display name shown under the thumbnail and in the lightbox. */
  name: string;
  /** How the gallery should render this item. */
  kind: AttachmentKind;
  /** URL used by the lightbox (image src or iframe src). */
  viewUrl: string;
  /** URL the user opens in a new tab (Descargar) when there's no preview. */
  downloadUrl: string;
}

interface AttachmentGalleryProps {
  items: AttachmentItem[];
}

export default function AttachmentGallery({ items }: AttachmentGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  // Anything we can show in the lightbox (image or PDF) lives in `previewable`;
  // everything else falls through to a download link list.
  const previewable = items.filter((it) => it.kind === "image" || it.kind === "pdf");
  const others = items.filter((it) => it.kind === "other");

  const current = lightboxIndex !== null ? previewable[lightboxIndex] : null;

  return (
    <>
      <div className="mt-4 rounded-lg bg-muted p-4">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Archivos adjuntos ({items.length})
        </p>

        {previewable.length > 0 && (
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {previewable.map((item, i) => (
              <button
                key={item.viewUrl}
                onClick={() => setLightboxIndex(i)}
                className="group relative flex h-32 w-full items-center justify-center overflow-hidden rounded-lg border bg-background"
                type="button"
                title={item.name}
              >
                {item.kind === "image" ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={item.viewUrl}
                    alt={item.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <span className="px-2 text-xs font-medium uppercase">PDF</span>
                  </div>
                )}
                <span className="absolute bottom-0 left-0 right-0 truncate bg-black/55 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
                  {item.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {others.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {others.map((item) => (
              <li key={item.downloadUrl}>
                <a
                  href={item.downloadUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-primary underline underline-offset-2 hover:opacity-80"
                >
                  📎 {item.name}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        open={lightboxIndex !== null}
        onOpenChange={(open) => { if (!open) setLightboxIndex(null); }}
      >
        <DialogContent
          showCloseButton
          className="max-w-[92vw] bg-transparent p-0 ring-0 shadow-none sm:max-w-[92vw]"
        >
          {current && lightboxIndex !== null && (
            <div className="relative flex h-[88vh] items-center justify-center">
              {previewable.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setLightboxIndex((lightboxIndex - 1 + previewable.length) % previewable.length)
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
                      setLightboxIndex((lightboxIndex + 1) % previewable.length)
                    }
                    className="absolute right-2 z-10 bg-white/10 text-white hover:bg-white/20"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Button>
                </>
              )}

              {current.kind === "image" ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={current.viewUrl}
                  alt={current.name}
                  className="max-h-full max-w-full rounded-lg object-contain"
                />
              ) : (
                <iframe
                  src={current.viewUrl}
                  title={current.name}
                  className="h-full w-full rounded-lg bg-white"
                />
              )}

              {previewable.length > 1 && (
                <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
                  {lightboxIndex + 1} / {previewable.length}
                </span>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
