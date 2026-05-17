"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export interface AttachmentItem {
  /** Display name shown in the lightbox count tooltip. */
  name: string;
  /** Best-effort guess from the MIME type or filename extension. */
  isImage: boolean;
  /** URL to render as the thumbnail/lightbox image. */
  viewUrl: string;
  /** URL the user opens in a new tab when the file isn't an image. */
  downloadUrl: string;
}

interface AttachmentGalleryProps {
  items: AttachmentItem[];
}

export default function AttachmentGallery({ items }: AttachmentGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  const imageItems = items.filter((it) => it.isImage);
  const nonImageItems = items.filter((it) => !it.isImage);

  return (
    <>
      <div className="mt-4 rounded-lg bg-muted p-4">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Archivos adjuntos ({items.length})
        </p>

        {imageItems.length > 0 && (
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {imageItems.map((item, i) => (
              <button
                key={item.viewUrl}
                onClick={() => setLightboxIndex(i)}
                className="group relative overflow-hidden rounded-lg border"
                type="button"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.viewUrl}
                  alt={item.name}
                  loading="lazy"
                  className="h-32 w-full object-cover transition group-hover:scale-105"
                />
                <span className="absolute bottom-0 left-0 right-0 truncate bg-black/50 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
                  {item.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {nonImageItems.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {nonImageItems.map((item) => (
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
          className="max-w-[90vw] bg-transparent p-0 ring-0 shadow-none sm:max-w-[90vw]"
        >
          {lightboxIndex !== null && (
            <div className="relative flex items-center justify-center">
              {imageItems.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setLightboxIndex((lightboxIndex - 1 + imageItems.length) % imageItems.length)
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
                      setLightboxIndex((lightboxIndex + 1) % imageItems.length)
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
                src={imageItems[lightboxIndex].viewUrl}
                alt={imageItems[lightboxIndex].name}
                className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
              />

              {imageItems.length > 1 && (
                <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
                  {lightboxIndex + 1} / {imageItems.length}
                </span>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
