"use client";

import { useState, useEffect, useMemo } from "react";
import InvoiceScanner from "@/components/InvoiceScanner";

const PIN_STORAGE_KEY = "scan-pin";

export default function ScanPage() {
  const [pin, setPin] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [checking, setChecking] = useState(true);

  const extraHeaders = useMemo(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(PIN_STORAGE_KEY) : null;
    return { "x-scan-pin": stored || pin };
  }, [pin, authenticated]);

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
      const now = new Date();
      const res = await fetch("/api/scan/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-scan-pin": testPin },
        body: JSON.stringify({ month: now.getMonth() + 1, year: now.getFullYear() }),
      });
      return res.ok;
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

  // Loading
  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-white" />
      </div>
    );
  }

  // PIN screen
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
              pinError ? "border-red-500 focus:ring-red-500" : "border-zinc-800 focus:ring-green-500"
            }`}
            autoFocus
          />
          {pinError && <p className="text-center text-sm text-red-400">PIN incorrecto</p>}
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

  // Scanner
  return (
    <div className="flex min-h-dvh flex-col items-center bg-zinc-950 px-4 pb-8 pt-safe-top">
      <div className="flex w-full max-w-md items-center justify-between pb-4 pt-6">
        <h1 className="text-lg font-semibold text-white">Scan Facturas</h1>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem(PIN_STORAGE_KEY);
            setAuthenticated(false);
            setPin("");
          }}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Salir
        </button>
      </div>

      <div className="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6">
        <InvoiceScanner extraHeaders={extraHeaders} />
      </div>
    </div>
  );
}
