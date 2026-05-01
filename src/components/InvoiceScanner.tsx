"use client";

import { useState, useRef, useCallback } from "react";
import { slugifyCompany } from "@/lib/invoice-slug";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface UploadedFile {
  id: string;
  name: string;
  company: string | null;
  total: string | null;
  webViewLink: string | null;
  timestamp: number;
}

interface InvoiceScannerProps {
  /** Headers to send with API requests (e.g. x-scan-pin for standalone) */
  extraHeaders?: Record<string, string>;
  /** API base paths — defaults to /api/scan/* for standalone, override for dashboard */
  folderEndpoint?: string;
  uploadEndpoint?: string;
}

export default function InvoiceScanner({
  extraHeaders = {},
  folderEndpoint = "/api/scan/folder",
  uploadEndpoint = "/api/scan/upload",
}: InvoiceScannerProps) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [uploading, setUploading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderIdCache = useRef<Record<string, string>>({});

  const getFolderId = useCallback(async (m: number, y: number) => {
    const key = `${y}-${m}`;
    if (folderIdCache.current[key]) return folderIdCache.current[key];

    const res = await fetch(folderEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extraHeaders },
      body: JSON.stringify({ month: m, year: y }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Error al obtener carpeta");
    }

    const data = await res.json();
    folderIdCache.current[key] = data.folderId;
    return data.folderId;
  }, [folderEndpoint, extraHeaders]);

  const detectInvoiceData = async (file: File): Promise<{ company: string | null; total: string | null }> => {
    try {
      setOcrStatus("Detectando empresa...");
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/scan/ocr", {
        method: "POST",
        headers: extraHeaders,
        body: formData,
      });

      if (!res.ok) return { company: null, total: null };
      const data = await res.json();
      return { company: data.company || null, total: data.total || null };
    } catch {
      return { company: null, total: null };
    } finally {
      setOcrStatus(null);
    }
  };

  const handleCapture = () => {
    setError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const folderId = await getFolderId(month, year);

      for (const file of Array.from(files)) {
        // OCR: detect company name + total from image
        const { company, total } = await detectInvoiceData(file);

        const timestamp = Date.now();
        const ext = file.name.split(".").pop() || "jpg";
        const companySlug = company ? slugifyCompany(company) : null;
        const totalSlug = total ? `_${total}eur` : "";
        const fileName = companySlug
          ? `${companySlug}${totalSlug}_${year}-${String(month).padStart(2, "0")}_${timestamp}.${ext}`
          : `factura${totalSlug}_${year}-${String(month).padStart(2, "0")}_${timestamp}.${ext}`;

        const formData = new FormData();
        formData.append("file", file, fileName);
        formData.append("folderId", folderId);

        const res = await fetch(uploadEndpoint, {
          method: "POST",
          headers: extraHeaders,
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Error al subir");
        }

        const driveFile = await res.json();
        setUploads((prev) => [
          {
            id: driveFile.id,
            name: fileName,
            company,
            total,
            webViewLink: driveFile.webViewLink,
            timestamp,
          },
          ...prev,
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir la factura");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const changeMonth = (delta: number) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 1) { newMonth = 12; newYear--; }
    else if (newMonth > 12) { newMonth = 1; newYear++; }
    setMonth(newMonth);
    setYear(newYear);
  };

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      {/* Month selector */}
      <div className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <p className="text-lg font-semibold text-zinc-900 dark:text-white">
            {MONTH_NAMES[month - 1]} {year}
          </p>
          {isCurrentMonth && (
            <p className="text-xs text-green-600 dark:text-green-400">Mes actual</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Scan button */}
      <button
        type="button"
        onClick={handleCapture}
        disabled={uploading}
        className="flex h-36 w-36 flex-col items-center justify-center rounded-full border-4 border-dashed border-brand/40 bg-brand/5 text-brand transition-all hover:border-brand/60 hover:bg-brand/10 active:scale-95 disabled:opacity-50 dark:border-brand/30 dark:bg-brand/5 dark:hover:border-brand/50"
      >
        {uploading ? (
          <>
            <svg className="h-10 w-10 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="mt-2 text-xs font-medium">
              {ocrStatus || "Subiendo..."}
            </span>
          </>
        ) : (
          <>
            <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="mt-2 text-sm font-medium">Escanear</span>
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="w-full rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Upload count */}
      {uploads.length > 0 && (
        <p className="text-sm font-medium text-green-600 dark:text-green-400">
          {uploads.length} factura{uploads.length !== 1 ? "s" : ""} subida{uploads.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Recent uploads */}
      {uploads.length > 0 && (
        <div className="w-full space-y-2">
          {uploads.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <svg className="h-5 w-5 shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                    {u.company || "Factura"}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {u.total ? `${u.total} €` : "Sin importe"}
                  </p>
                </div>
              </div>
              {u.webViewLink && (
                <a
                  href={u.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs font-medium text-brand hover:underline"
                >
                  Ver
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
