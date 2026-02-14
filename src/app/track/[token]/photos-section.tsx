"use client";

import { useState, useCallback } from "react";

interface Photo {
  id: string;
  name: string;
}

interface PhotosSectionProps {
  token: string;
  photoCount: number;
  isVerified: boolean;
  photos: Photo[];
}

type ViewState = "locked" | "email-input" | "code-input" | "verified";

export default function PhotosSection({
  token,
  photoCount,
  isVerified: initialVerified,
  photos: initialPhotos,
}: PhotosSectionProps) {
  const [state, setState] = useState<ViewState>(
    initialVerified ? "verified" : "locked",
  );
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [lightboxId, setLightboxId] = useState<string | null>(null);

  const sendCode = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/track/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", token, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al enviar el codigo");
        return;
      }
      setState("code-input");
    } finally {
      setLoading(false);
    }
  }, [token, email]);

  const checkCode = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/track/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check", token, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al verificar");
        return;
      }
      // Reload page to get photos from server
      window.location.reload();
    } finally {
      setLoading(false);
    }
  }, [token, code]);

  // Locked state
  if (state === "locked") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
          <svg
            className="h-4 w-4 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Fotos del entregable
        </h2>

        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 py-8 dark:border-zinc-700 dark:bg-zinc-800/50">
          <svg
            className="h-10 w-10 text-zinc-300 dark:text-zinc-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {photoCount} foto{photoCount !== 1 ? "s" : ""} disponible
            {photoCount !== 1 ? "s" : ""}
          </p>
          <button
            onClick={() => setState("email-input")}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
          >
            Verificar email para ver fotos
          </button>
        </div>
      </div>
    );
  }

  // Email input state
  if (state === "email-input") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
          <svg
            className="h-4 w-4 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Verificar email
        </h2>

        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Introduce el email asociado al proyecto para acceder a las fotos.
        </p>

        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
            onKeyDown={(e) => e.key === "Enter" && !loading && email && sendCode()}
          />
          <button
            onClick={sendCode}
            disabled={loading || !email}
            className="shrink-0 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Enviar codigo"}
          </button>
        </div>

        {error && (
          <p className="mt-2 text-sm text-red-500 dark:text-red-400">{error}</p>
        )}

        <button
          onClick={() => {
            setState("locked");
            setError("");
          }}
          className="mt-3 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          Cancelar
        </button>
      </div>
    );
  }

  // Code input state
  if (state === "code-input") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
          <svg
            className="h-4 w-4 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Introduce el codigo
        </h2>

        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Hemos enviado un codigo de 6 digitos a <strong className="text-zinc-700 dark:text-zinc-300">{email}</strong>
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            className="w-36 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center font-mono text-lg tracking-widest text-zinc-900 placeholder:text-zinc-300 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-600"
            onKeyDown={(e) =>
              e.key === "Enter" && !loading && code.length === 6 && checkCode()
            }
          />
          <button
            onClick={checkCode}
            disabled={loading || code.length !== 6}
            className="shrink-0 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Verificando..." : "Verificar"}
          </button>
        </div>

        {error && (
          <p className="mt-2 text-sm text-red-500 dark:text-red-400">{error}</p>
        )}

        <button
          onClick={() => {
            setState("email-input");
            setCode("");
            setError("");
          }}
          className="mt-3 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          Usar otro email
        </button>
      </div>
    );
  }

  // Verified state — photo gallery
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
        <svg
          className="h-4 w-4 text-zinc-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        Fotos del entregable
        <span className="text-xs font-normal text-zinc-400">
          ({photos.length})
        </span>
      </h2>

      {photos.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Aun no hay fotos disponibles.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((photo) => (
            <button
              key={photo.id}
              onClick={() => setLightboxId(photo.id)}
              className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/track/photos/${photo.id}`}
                alt={photo.name}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxId(null)}
        >
          <button
            onClick={() => setLightboxId(null)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/track/photos/${lightboxId}`}
            alt="Foto ampliada"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
