"use client";

import { useState, useTransition } from "react";
import { suggestStudioNdaDescription } from "../nda-actions";

export function NdaDescriptionField({
  projectId,
  initialValue,
}: {
  projectId: string;
  initialValue: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSuggest = () => {
    setError(null);
    startTransition(async () => {
      const result = await suggestStudioNdaDescription(projectId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setValue(result.suggestion);
    });
  };

  return (
    <div>
      <div className="flex items-end justify-between gap-2">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Descripción del proyecto para el NDA
        </label>
        <button
          type="button"
          onClick={handleSuggest}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          {pending ? (
            <>
              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Pensando…
            </>
          ) : (
            <>
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
              Sugerir con IA
            </>
          )}
        </button>
      </div>
      <textarea
        name="nda_project_description"
        rows={2}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder='Por defecto: "the products, services and intellectual property developed under this collaboration". Personalízalo si quieres que el Recital I mencione algo concreto (ej. "a wearable monitoring device for horses").'
        className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
      />
      {error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Aparece en el contrato del cliente. Cámbialo antes de enviar el NDA.
        </p>
      )}
    </div>
  );
}
