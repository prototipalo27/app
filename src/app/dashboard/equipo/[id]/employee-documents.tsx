"use client";

import { useState, useTransition } from "react";
import { uploadEmployeeDocument, deleteEmployeeDocument } from "./actions";

type Document = {
  id: string;
  file_name: string;
  file_path: string;
  document_type: string;
  notes: string | null;
  uploaded_at: string;
};

type Props = {
  userId: string;
  employeeName: string;
  documents: Document[];
  isManager: boolean;
};

const DOC_TYPE_LABELS: Record<string, string> = {
  contract: "Contrato",
  payslip: "Nomina",
  other: "Otro",
};

const DOC_TYPE_COLORS: Record<string, string> = {
  contract: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  payslip: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  other: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export default function EmployeeDocuments({
  userId,
  employeeName,
  documents,
  isManager,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [showUpload, setShowUpload] = useState(false);
  const [docType, setDocType] = useState("contract");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("userId", userId);
    formData.set("employeeName", employeeName);

    setMessage(null);
    startTransition(async () => {
      const result = await uploadEmployeeDocument(formData);
      if (result.success) {
        setShowUpload(false);
        setNotes("");
        setDocType("contract");
      } else {
        setMessage(result.error ?? "Error al subir");
      }
    });
  }

  function handleDelete(docId: string) {
    if (!confirm("Eliminar este documento?")) return;
    startTransition(async () => {
      await deleteEmployeeDocument(docId, userId);
    });
  }

  return (
    <div>
      {documents.length === 0 && (
        <p className="mb-3 text-sm text-zinc-400">Sin documentos</p>
      )}

      {documents.length > 0 && (
        <div className="mb-4 space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700"
            >
              <div className="flex items-center gap-3 min-w-0">
                <svg className="h-4 w-4 shrink-0 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <div className="min-w-0">
                  <a
                    href={`https://drive.google.com/file/d/${doc.file_path}/view`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm font-medium text-zinc-900 hover:text-green-600 dark:text-zinc-100 dark:hover:text-green-400"
                  >
                    {doc.file_name}
                  </a>
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${DOC_TYPE_COLORS[doc.document_type] ?? DOC_TYPE_COLORS.other}`}>
                      {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                    </span>
                    <span>
                      {new Date(doc.uploaded_at).toLocaleDateString("es-ES")}
                    </span>
                    {doc.notes && <span>· {doc.notes}</span>}
                  </div>
                </div>
              </div>
              {isManager && (
                <button
                  onClick={() => handleDelete(doc.id)}
                  disabled={isPending}
                  className="ml-2 shrink-0 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  title="Eliminar"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {isManager && !showUpload && (
        <button
          onClick={() => setShowUpload(true)}
          className="text-sm font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
        >
          + Subir documento
        </button>
      )}

      {isManager && showUpload && (
        <form onSubmit={handleUpload} className="mt-2 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
          <div>
            <input
              type="file"
              name="file"
              required
              className="w-full text-sm text-zinc-600 file:mr-2 file:rounded-lg file:border-0 file:bg-green-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-green-700 dark:text-zinc-400"
            />
          </div>
          <div className="flex gap-2">
            <select
              name="documentType"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              <option value="contract">Contrato</option>
              <option value="payslip">Nomina</option>
              <option value="other">Otro</option>
            </select>
            <input
              type="text"
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas (opcional)"
              className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm placeholder-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder-zinc-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isPending ? "Subiendo..." : "Subir"}
            </button>
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Cancelar
            </button>
          </div>
          {message && <p className="text-sm text-red-500">{message}</p>}
        </form>
      )}
    </div>
  );
}
