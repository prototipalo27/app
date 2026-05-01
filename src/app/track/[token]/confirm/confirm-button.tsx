"use client";

import { useState, useTransition } from "react";
import { confirmForShipping } from "../names/actions";

export default function ConfirmShippingButton({
  token,
  blocking = 0,
}: {
  token: string;
  blocking?: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    const baseMsg =
      "¿Confirmar envío con los nombres y fotos mostrados? Esta acción no se puede deshacer.";
    const msg =
      blocking > 0
        ? `Quedan ${blocking} foto${blocking === 1 ? "" : "s"} sin aprobar. ${baseMsg}`
        : baseMsg;
    if (!window.confirm(msg)) return;

    setError(null);
    startTransition(async () => {
      const result = await confirmForShipping(token);
      if (!result.success) {
        setError(result.error ?? "Error al confirmar");
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {pending
          ? "Confirmando…"
          : blocking > 0
            ? "Confirmar de todos modos"
            : "Confirmar para envío"}
      </button>
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
