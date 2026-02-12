"use client";

import { useFormStatus } from "react-dom";

export default function DeleteButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
      onClick={(e) => {
        if (!confirm("Eliminar proveedor y todos sus pagos?")) {
          e.preventDefault();
        }
      }}
    >
      {pending ? "Eliminando..." : "Eliminar"}
    </button>
  );
}
