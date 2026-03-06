"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface AttachmentGalleryProps {
  attachments: string;
}

export default function AttachmentGallery({ attachments }: AttachmentGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const url = attachments.trim();
  const groupMatch = url.match(/~(\d+)\/?$/);
  const fileCount = groupMatch ? parseInt(groupMatch[1]) : 0;
  const baseUrl = url.replace(/\/$/, "");

  const fileUrls =
    fileCount > 0
      ? Array.from({ length: fileCount }, (_, i) => `${baseUrl}/nth/${i}/`)
      : [url];

  return (
    <>
      <div className="mt-4 rounded-lg bg-muted p-4">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Archivos adjuntos ({fileUrls.length})
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {fileUrls.map((fileUrl, i) => (
            <button
              key={i}
              onClick={() => setLightboxIndex(i)}
              className="group relative overflow-hidden rounded-lg border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${fileUrl}-/preview/400x400/-/quality/lighter/`}
                alt={`Adjunto ${i + 1}`}
                className="h-32 w-full object-cover transition group-hover:scale-105"
              />
              <span className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
                Ver archivo {i + 1}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
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
              {/* Prev / Next */}
              {fileUrls.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setLightboxIndex((lightboxIndex - 1 + fileUrls.length) % fileUrls.length)}
                    className="absolute left-2 z-10 bg-white/10 text-white hover:bg-white/20"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setLightboxIndex((lightboxIndex + 1) % fileUrls.length)}
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
                src={`${fileUrls[lightboxIndex]}-/preview/1600x1600/-/quality/normal/`}
                alt={`Adjunto ${lightboxIndex + 1}`}
                className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
              />

              {fileUrls.length > 1 && (
                <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
                  {lightboxIndex + 1} / {fileUrls.length}
                </span>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
