"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Step = "email" | "code";

export default function InlineVerify({
  token,
  title = "Verifica tu email para continuar",
  subtitle = "Esta sección es privada. Te enviaremos un código de 6 dígitos al email asociado al proyecto.",
}: {
  token: string;
  title?: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const sendCode = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/track/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", token, email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Error al enviar el código");
        return;
      }
      setStep("code");
      setResendCooldown(60);
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
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
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Código incorrecto");
        return;
      }
      router.refresh();
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [token, code, router]);

  return (
    <div className="mx-auto max-w-md rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-white">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>

      {step === "email" && (
        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Email del proyecto
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
              onKeyDown={(e) => e.key === "Enter" && !loading && email && sendCode()}
            />
            <button
              onClick={sendCode}
              disabled={loading || !email}
              className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
            >
              {loading ? "Enviando…" : "Enviar código"}
            </button>
          </div>
        </div>
      )}

      {step === "code" && (
        <div className="mt-4">
          <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
            Hemos enviado un código de 6 dígitos a{" "}
            <strong className="text-zinc-700 dark:text-zinc-300">{email}</strong>
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="w-36 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center font-mono text-lg tracking-widest text-zinc-900 placeholder:text-zinc-300 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-600"
              onKeyDown={(e) =>
                e.key === "Enter" && !loading && code.length === 6 && checkCode()
              }
            />
            <button
              onClick={checkCode}
              disabled={loading || code.length !== 6}
              className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
            >
              {loading ? "Verificando…" : "Verificar"}
            </button>
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs">
            <button
              onClick={() => {
                setStep("email");
                setCode("");
                setError("");
              }}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              Usar otro email
            </button>
            <button
              onClick={sendCode}
              disabled={loading || resendCooldown > 0}
              className="text-brand hover:text-brand-dark disabled:cursor-not-allowed disabled:text-zinc-400"
            >
              {resendCooldown > 0
                ? `Reenviar (${resendCooldown}s)`
                : "Reenviar código"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
