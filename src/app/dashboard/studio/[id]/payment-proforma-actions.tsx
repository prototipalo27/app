"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createStudioPaymentProforma,
  sendStudioPaymentProforma,
} from "../proforma-actions";

export default function PaymentProformaActions({
  paymentId,
  hasProforma,
  docNumber,
  proformaSentAt,
  paymentStatus,
  trackingUrl,
  paymentLabel,
}: {
  paymentId: string;
  hasProforma: boolean;
  docNumber: string | null;
  proformaSentAt: string | null;
  paymentStatus: string | null;
  trackingUrl: string;
  paymentLabel: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    setError(null);
    startTransition(async () => {
      const result = await createStudioPaymentProforma(paymentId);
      if (!result.success) {
        setError(result.error || "Error al crear la proforma");
        return;
      }
      router.refresh();
    });
  };

  const handleSend = () => {
    setError(null);
    if (!confirm(`Enviar proforma "${paymentLabel}" al cliente por email?`)) return;
    startTransition(async () => {
      const result = await sendStudioPaymentProforma(paymentId);
      if (!result.success) {
        setError(result.error || "Error al enviar la proforma");
        return;
      }
      router.refresh();
    });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const isPaid = paymentStatus === "paid";

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      {!hasProforma ? (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending}
          className="rounded-lg border border-zinc-300 bg-white px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          {isPending ? "Generando…" : "Generar proforma"}
        </button>
      ) : (
        <>
          {docNumber && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {docNumber}
            </span>
          )}
          {!proformaSentAt && !isPaid && (
            <button
              type="button"
              onClick={handleSend}
              disabled={isPending}
              className="rounded-lg bg-brand-blue px-2 py-1 font-medium text-white hover:bg-brand-blue/90 disabled:opacity-50"
            >
              {isPending ? "Enviando…" : "Enviar al cliente"}
            </button>
          )}
          {proformaSentAt && !isPaid && (
            <span className="text-zinc-500 dark:text-zinc-400">
              Enviada {new Date(proformaSentAt).toLocaleDateString("es-ES")}
            </span>
          )}
          {isPaid && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
              Pagada
            </span>
          )}
          <button
            type="button"
            onClick={copyLink}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            title={trackingUrl}
          >
            {copied ? "Copiado" : "Copiar link"}
          </button>
        </>
      )}
      {error && (
        <span className="text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}
