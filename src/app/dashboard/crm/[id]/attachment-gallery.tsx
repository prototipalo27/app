"use client";

import { useState } from "react";

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
      <div className="mt-4 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
        <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
          Archivos adjuntos ({fileUrls.length})
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {fileUrls.map((fileUrl, i) => (
            <button
              key={i}
              onClick={() => setLightboxIndex(i)}
              className="group relative overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700"
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
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Close */}
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Prev / Next */}
          {fileUrls.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((lightboxIndex - 1 + fileUrls.length) % fileUrls.length);
                }}
                className="absolute left-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((lightboxIndex + 1) % fileUrls.length);
                }}
                className="absolute right-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${fileUrls[lightboxIndex]}-/preview/1600x1600/-/quality/normal/`}
            alt={`Adjunto ${lightboxIndex + 1}`}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Counter */}
          {fileUrls.length > 1 && (
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
              {lightboxIndex + 1} / {fileUrls.length}
            </span>
          )}
        </div>
      )}
    </>
  );
}
