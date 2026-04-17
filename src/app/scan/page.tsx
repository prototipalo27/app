"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const PIN_STORAGE_KEY = "scan-pin";

interface UploadedFile {
  id: string;
  name: string;
  webViewLink: string | null;
  timestamp: number;
}

export default function ScanPage() {
  const [pin, setPin] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [checking, setChecking] = useState(true);

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [uploading, setUploading] = useState(false);
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderIdCache = useRef<Record<string, string>>({});

  // Check URL token or saved PIN on mount
  useEffect(() => {
    const urlPin = new URLSearchParams(window.location.search).get("pin");
    const saved = urlPin || localStorage.getItem(PIN_STORAGE_KEY);
    if (saved) {
      setPin(saved);
      verifyPin(saved).then((ok) => {
        if (ok) {
          localStorage.setItem(PIN_STORAGE_KEY, saved);
          setAuthenticated(true);
        } else {
          localStorage.removeItem(PIN_STORAGE_KEY);
        }
        setChecking(false);
      });
    } else {
      setChecking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verifyPin(testPin: string): Promise<boolean> {
    try {
      const res = await fetch("/api/scan/folder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-scan-pin": testPin,
        },
        body: JSON.stringify({ month: now.getMonth() + 1, year: now.getFullYear() }),
      });
      if (res.status === 401) return false;
      if (!res.ok) return false;
      const data = await res.json();
      // Cache the folder ID we got back
      const key = `${now.getFullYear()}-${now.getMonth() + 1}`;
      folderIdCache.current[key] = data.folderId;
      return true;
    } catch {
      return false;
    }
  }

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(false);
    setChecking(true);
    const ok = await verifyPin(pin);
    if (ok) {
      localStorage.setItem(PIN_STORAGE_KEY, pin);
      setAuthenticated(true);
    } else {
      setPinError(true);
    }
    setChecking(false);
  };

  const getPin = () => localStorage.getItem(PIN_STORAGE_KEY) || pin;

  const getFolderId = useCallback(async (m: number, y: number) => {
    const key = `${y}-${m}`;
    if (folderIdCache.current[key]) return folderIdCache.current[key];

    const res = await fetch("/api/scan/folder", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-scan-pin": getPin(),
      },
      body: JSON.stringify({ month: m, year: y }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Error al obtener carpeta");
    }

    const data = await res.json();
    folderIdCache.current[key] = data.folderId;
    return data.folderId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        const timestamp = Date.now();
        const ext = file.name.split(".").pop() || "jpg";
        const fileName = `factura_${year}-${String(month).padStart(2, "0")}_${timestamp}.${ext}`;

        const formData = new FormData();
        formData.append("file", file, fileName);
        formData.append("folderId", folderId);

        const res = await fetch("/api/scan/upload", {
          method: "POST",
          headers: { "x-scan-pin": getPin() },
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Error al subir");
        }

        const driveFile = await res.json();
        setUploads((prev) => [
          { id: driveFile.id, name: fileName, webViewLink: driveFile.webViewLink, timestamp },
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

  // --- Loading state ---
  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-white" />
      </div>
    );
  }

  // --- PIN screen ---
  if (!authenticated) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-zinc-950 px-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800">
            <svg className="h-8 w-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white">Scan Facturas</h1>
          <p className="text-sm text-zinc-500">Introduce el PIN para continuar</p>
        </div>

        <form onSubmit={handlePinSubmit} className="flex w-full max-w-xs flex-col gap-3">
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setPinError(false); }}
            placeholder="PIN"
            className={`w-full rounded-xl border bg-zinc-900 px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] text-white placeholder:text-zinc-600 placeholder:tracking-normal placeholder:text-base focus:outline-none focus:ring-2 ${
              pinError
                ? "border-red-500 focus:ring-red-500"
                : "border-zinc-800 focus:ring-green-500"
            }`}
            autoFocus
          />
          {pinError && (
            <p className="text-center text-sm text-red-400">PIN incorrecto</p>
          )}
          <button
            type="submit"
            disabled={!pin}
            className="rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-500 active:bg-green-700 disabled:opacity-40"
          >
            Entrar
          </button>
        </form>
      </div>
    );
  }

  // --- Scanner ---
  return (
    <div className="flex min-h-dvh flex-col items-center bg-zinc-950 px-4 pb-8 pt-safe-top">
      {/* Header */}
      <div className="flex w-full max-w-md items-center justify-between pb-4 pt-6">
        <h1 className="text-lg font-semibold text-white">Scan Facturas</h1>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem(PIN_STORAGE_KEY);
            setAuthenticated(false);
            setPin("");
            setUploads([]);
          }}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Salir
        </button>
      </div>

      <div className="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6">
        {/* Month selector */}
        <div className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-3">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 active:bg-zinc-700"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <p className="text-lg font-semibold text-white">
              {MONTH_NAMES[month - 1]} {year}
            </p>
            {isCurrentMonth && (
              <p className="text-xs text-green-400">Mes actual</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => changeMonth(1)}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 active:bg-zinc-700"
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
          className="flex h-36 w-36 flex-col items-center justify-center rounded-full border-4 border-dashed border-green-500/30 bg-green-500/5 text-green-400 transition-all hover:border-green-500/50 hover:bg-green-500/10 active:scale-95 disabled:opacity-50"
        >
          {uploading ? (
            <>
              <svg className="h-10 w-10 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="mt-2 text-sm font-medium">Subiendo...</span>
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
          <div className="w-full rounded-lg border border-red-800 bg-red-900/20 p-3 text-center text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Upload count */}
        {uploads.length > 0 && (
          <p className="text-sm font-medium text-green-400">
            {uploads.length} factura{uploads.length !== 1 ? "s" : ""} subida{uploads.length !== 1 ? "s" : ""}
          </p>
        )}

        {/* Recent uploads */}
        {uploads.length > 0 && (
          <div className="w-full space-y-2">
            {uploads.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <svg className="h-5 w-5 shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="truncate text-sm text-zinc-300">{u.name}</span>
                </div>
                {u.webViewLink && (
                  <a
                    href={u.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs font-medium text-green-400 hover:underline"
                  >
                    Ver
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
