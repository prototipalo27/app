"use client";

import { useActionState } from "react";
import { saveSmtpSettings, testSmtpConnection, deleteSmtpSettings } from "./actions";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500";

interface Props {
  defaultValues?: {
    smtp_email: string;
    display_name: string;
    signature_html: string;
  };
}

export default function EmailSettingsForm({ defaultValues }: Props) {
  const [saveState, saveAction, savePending] = useActionState(
    async (_prev: { success?: boolean; error?: string } | null, formData: FormData) => {
      return await saveSmtpSettings(formData);
    },
    null,
  );

  const [testState, testAction, testPending] = useActionState(
    async (_prev: { success?: boolean; error?: string } | null, formData: FormData) => {
      return await testSmtpConnection(formData);
    },
    null,
  );

  const [deleteState, deleteAction, deletePending] = useActionState(
    async (_prev: { success?: boolean; error?: string } | null) => {
      return await deleteSmtpSettings();
    },
    null,
  );

  return (
    <div className="space-y-4">
      <form
        action={saveAction}
        className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email de Gmail
          </label>
          <input
            type="email"
            name="smtp_email"
            required
            defaultValue={defaultValues?.smtp_email}
            placeholder="tu@gmail.com"
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Contraseña de aplicación
          </label>
          <input
            type="password"
            name="smtp_password"
            required
            placeholder="xxxx xxxx xxxx xxxx"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Genera una en{" "}
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-blue underline"
            >
              myaccount.google.com/apppasswords
            </a>
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Nombre para mostrar
          </label>
          <input
            type="text"
            name="display_name"
            required
            defaultValue={defaultValues?.display_name}
            placeholder="Manuel de la Viña"
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Firma HTML (opcional)
          </label>
          <textarea
            name="signature_html"
            rows={6}
            defaultValue={defaultValues?.signature_html}
            placeholder="<br><strong>Tu nombre</strong><br>Prototipalo.com"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            HTML que se añade al final de cada email. Deja vacío para usar la firma por defecto.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={savePending}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {savePending ? "Guardando..." : "Guardar configuración"}
          </button>

          <button
            type="submit"
            formAction={testAction}
            disabled={testPending}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {testPending ? "Probando..." : "Probar conexión"}
          </button>
        </div>

        {/* Feedback messages */}
        {saveState?.success && (
          <p className="text-sm text-green-600 dark:text-green-400">
            Configuración guardada correctamente.
          </p>
        )}
        {saveState?.error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            Error al guardar: {saveState.error}
          </p>
        )}
        {testState?.success && (
          <p className="text-sm text-green-600 dark:text-green-400">
            Conexión exitosa — tu cuenta funciona correctamente.
          </p>
        )}
        {testState?.error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            Error de conexión: {testState.error}
          </p>
        )}
      </form>

      {/* Delete config */}
      {defaultValues && (
        <form action={deleteAction}>
          <button
            type="submit"
            disabled={deletePending}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            {deletePending ? "Eliminando..." : "Eliminar configuración SMTP"}
          </button>
          {deleteState?.success && (
            <p className="mt-2 text-sm text-green-600 dark:text-green-400">
              Configuración eliminada. Se usará la cuenta global.
            </p>
          )}
          {deleteState?.error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              Error: {deleteState.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
