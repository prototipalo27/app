"use client";

import { useState, useCallback, useRef } from "react";

interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  size: string | null;
  modifiedTime: string | null;
}

interface ClientPortalProps {
  token: string;
  projectId: string;
  clientEmail: string | null;
  hasDriveFolder: boolean;
  isVerified: boolean;
  designVisible: boolean;
  designApprovedAt: string | null;
  deliverableVisible: boolean;
  deliverableApprovedAt: string | null;
  paymentConfirmedAt: string | null;
}

type VerifyState = "locked" | "email-input" | "code-input" | "verified";

export default function ClientPortal({
  token,
  clientEmail,
  hasDriveFolder,
  isVerified: initialVerified,
  designVisible,
  designApprovedAt: initialDesignApproved,
  deliverableVisible,
  deliverableApprovedAt: initialDeliverableApproved,
  paymentConfirmedAt: initialPaymentConfirmed,
}: ClientPortalProps) {
  // Verification state
  const [verifyState, setVerifyState] = useState<VerifyState>(
    initialVerified ? "verified" : "locked",
  );
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Section data
  const [briefingFiles, setBriefingFiles] = useState<FileItem[]>([]);
  const [designFiles, setDesignFiles] = useState<FileItem[]>([]);
  const [deliverableFiles, setDeliverableFiles] = useState<FileItem[]>([]);
  const [briefingLoaded, setBriefingLoaded] = useState(false);
  const [designLoaded, setDesignLoaded] = useState(false);
  const [deliverableLoaded, setDeliverableLoaded] = useState(false);

  // Approval state
  const [designApproved, setDesignApproved] = useState(!!initialDesignApproved);
  const [deliverableApproved, setDeliverableApproved] = useState(!!initialDeliverableApproved);
  const [paymentConfirmed, setPaymentConfirmed] = useState(!!initialPaymentConfirmed);

  // UI state
  const [uploading, setUploading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveDelivCheck, setApproveDelivCheck] = useState(false);
  const [confirmPayCheck, setConfirmPayCheck] = useState(false);
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [lightboxSection, setLightboxSection] = useState<string>("deliverable");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isVerified = verifyState === "verified";

  // ── Verification flow ──
  const sendCode = useCallback(async () => {
    setVerifyError("");
    setVerifyLoading(true);
    try {
      const res = await fetch("/api/track/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", token, email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setVerifyError(data?.error || "Error al enviar el código");
        return;
      }
      setVerifyState("code-input");
    } catch {
      setVerifyError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setVerifyLoading(false);
    }
  }, [token, email]);

  const checkCode = useCallback(async () => {
    setVerifyError("");
    setVerifyLoading(true);
    try {
      const res = await fetch("/api/track/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check", token, code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setVerifyError(data?.error || "Error al verificar");
        return;
      }
      setVerifyState("verified");
    } catch {
      setVerifyError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setVerifyLoading(false);
    }
  }, [token, code]);

  // ── Fetch files for a section ──
  const loadFiles = useCallback(async (section: "briefing" | "design" | "deliverable") => {
    try {
      const res = await fetch(`/api/track/files?section=${section}`);
      if (!res.ok) return;
      const data = await res.json();
      if (section === "briefing") {
        setBriefingFiles(data.files);
        setBriefingLoaded(true);
      } else if (section === "design") {
        setDesignFiles(data.files);
        setDesignLoaded(true);
      } else {
        setDeliverableFiles(data.files);
        setDeliverableLoaded(true);
      }
    } catch {
      // silently fail
    }
  }, []);

  // Load files on first render when verified
  const loadedRef = useRef(false);
  if (isVerified && !loadedRef.current) {
    loadedRef.current = true;
    loadFiles("briefing");
    if (designVisible) loadFiles("design");
    if (deliverableVisible) loadFiles("deliverable");
  }

  // ── Upload to Briefing ──
  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/track/upload", { method: "POST", body: formData });
      if (!res.ok) return;
      const data = await res.json();
      setBriefingFiles((prev) => [...prev, data.file]);
    } finally {
      setUploading(false);
    }
  }, []);

  // ── Approve section ──
  const handleApprove = useCallback(async (section: "design" | "deliverable") => {
    setApproving(true);
    try {
      const body: Record<string, unknown> = { section };
      if (section === "deliverable" && confirmPayCheck) {
        body.confirmPayment = true;
      }
      const res = await fetch("/api/track/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return;
      if (section === "design") {
        setDesignApproved(true);
      } else {
        setDeliverableApproved(true);
        if (confirmPayCheck) setPaymentConfirmed(true);
      }
    } finally {
      setApproving(false);
    }
  }, [confirmPayCheck]);

  if (!hasDriveFolder) return null;

  // ── Verification UI ──
  if (!isVerified) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
          <LockIcon />
          Portal de cliente
        </h2>

        {verifyState === "locked" && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 py-8 dark:border-zinc-700 dark:bg-zinc-800/50">
            <svg className="h-10 w-10 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Verifica tu email para acceder al portal
            </p>
            <button
              onClick={() => setVerifyState("email-input")}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              Verificar email
            </button>
          </div>
        )}

        {verifyState === "email-input" && (
          <>
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              Introduce el email asociado al proyecto.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                onKeyDown={(e) => e.key === "Enter" && !verifyLoading && email && sendCode()}
              />
              <button
                onClick={sendCode}
                disabled={verifyLoading || !email}
                className="shrink-0 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                {verifyLoading ? "Enviando..." : "Enviar código"}
              </button>
            </div>
            {verifyError && <p className="mt-2 text-sm text-red-500">{verifyError}</p>}
            <button onClick={() => { setVerifyState("locked"); setVerifyError(""); }} className="mt-3 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
              Cancelar
            </button>
          </>
        )}

        {verifyState === "code-input" && (
          <>
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              Hemos enviado un código de 6 dígitos a <strong className="text-zinc-700 dark:text-zinc-300">{email}</strong>
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
                onKeyDown={(e) => e.key === "Enter" && !verifyLoading && code.length === 6 && checkCode()}
              />
              <button
                onClick={checkCode}
                disabled={verifyLoading || code.length !== 6}
                className="shrink-0 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                {verifyLoading ? "Verificando..." : "Verificar"}
              </button>
            </div>
            {verifyError && <p className="mt-2 text-sm text-red-500">{verifyError}</p>}
            <button onClick={() => { setVerifyState("email-input"); setCode(""); setVerifyError(""); }} className="mt-3 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
              Usar otro email
            </button>
          </>
        )}
      </div>
    );
  }

  // ── Verified: show 3 sections ──
  return (
    <div className="space-y-6">
      {/* ── Briefing ── */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
          <FolderIcon />
          Briefing
        </h2>

        {!briefingLoaded ? (
          <p className="text-sm text-zinc-400">Cargando...</p>
        ) : (
          <>
            <FileList files={briefingFiles} section="briefing" onOpenLightbox={(id, sec) => { setLightboxId(id); setLightboxSection(sec); }} />

            <div className="mt-3">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {uploading ? "Subiendo..." : "Subir archivo"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Diseño ── */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
          <PaletteIcon />
          Diseño
          {designApproved && <ApprovedBadge />}
        </h2>

        {!designVisible ? (
          <PendingCard label="El equipo aún no ha compartido los diseños." />
        ) : !designLoaded ? (
          <p className="text-sm text-zinc-400">Cargando...</p>
        ) : (
          <>
            <FileList files={designFiles} section="design" onOpenLightbox={(id, sec) => { setLightboxId(id); setLightboxSection(sec); }} />

            {!designApproved && designFiles.length > 0 && (
              <button
                onClick={() => handleApprove("design")}
                disabled={approving}
                className="mt-3 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                {approving ? "Aprobando..." : "Aprobar diseños"}
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Entregable ── */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
          <PhotoIcon />
          Entregable
          {deliverableApproved && <ApprovedBadge />}
          {paymentConfirmed && <PaidBadge />}
        </h2>

        {!deliverableVisible ? (
          <PendingCard label="El equipo aún no ha compartido el entregable." />
        ) : !deliverableLoaded ? (
          <p className="text-sm text-zinc-400">Cargando...</p>
        ) : (
          <>
            <PhotoGrid files={deliverableFiles} onOpenLightbox={(id) => { setLightboxId(id); setLightboxSection("deliverable"); }} />

            {!deliverableApproved && deliverableFiles.length > 0 && (
              <div className="mt-4 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={approveDelivCheck}
                    onChange={(e) => setApproveDelivCheck(e.target.checked)}
                    className="mt-0.5 rounded border-zinc-300 text-green-600 focus:ring-green-500 dark:border-zinc-600 dark:bg-zinc-800"
                  />
                  <span className="text-zinc-700 dark:text-zinc-300">Apruebo el entregable y confirmo que las piezas son correctas</span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={confirmPayCheck}
                    onChange={(e) => setConfirmPayCheck(e.target.checked)}
                    className="mt-0.5 rounded border-zinc-300 text-green-600 focus:ring-green-500 dark:border-zinc-600 dark:bg-zinc-800"
                  />
                  <span className="text-zinc-700 dark:text-zinc-300">Confirmo que he realizado la transferencia bancaria</span>
                </label>
                <button
                  onClick={() => handleApprove("deliverable")}
                  disabled={approving || !approveDelivCheck}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                >
                  {approving ? "Confirmando..." : "Confirmar"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

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
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/track/photos/${lightboxId}?section=${lightboxSection}`}
            alt="Archivo ampliado"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function FileList({
  files,
  section,
  onOpenLightbox,
}: {
  files: FileItem[];
  section: string;
  onOpenLightbox: (id: string, section: string) => void;
}) {
  if (files.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No hay archivos.</p>;
  }

  return (
    <div className="space-y-1.5">
      {files.map((f) => {
        const isImage = f.mimeType.startsWith("image/");
        return (
          <div
            key={f.id}
            className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50/50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/50"
          >
            {isImage ? (
              <button
                onClick={() => onOpenLightbox(f.id, section)}
                className="shrink-0 text-zinc-400 hover:text-green-600"
                title="Ver imagen"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
            ) : (
              <svg className="h-4 w-4 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            <span className="flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">{f.name}</span>
            {f.size && (
              <span className="shrink-0 text-xs text-zinc-400">
                {formatBytes(Number(f.size))}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PhotoGrid({
  files,
  onOpenLightbox,
}: {
  files: FileItem[];
  onOpenLightbox: (id: string) => void;
}) {
  const images = files.filter((f) => f.mimeType.startsWith("image/"));
  if (images.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No hay fotos.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {images.map((photo) => (
        <button
          key={photo.id}
          onClick={() => onOpenLightbox(photo.id)}
          className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/track/photos/${photo.id}?section=deliverable`}
            alt={photo.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
        </button>
      ))}
    </div>
  );
}

function PendingCard({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 py-6 dark:border-zinc-700 dark:bg-zinc-800/50">
      <svg className="h-8 w-8 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}

function ApprovedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      Aprobado
    </span>
  );
}

function PaidBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
      Pago confirmado
    </span>
  );
}

function LockIcon() {
  return (
    <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
