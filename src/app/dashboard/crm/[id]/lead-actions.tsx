"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateLeadStatus,
  assignLead,
  addNote,
  deleteLead,
  blockEmailAndDeleteLead,
  createQuoteRequest,
} from "../actions";
import type { Tables } from "@/lib/supabase/database.types";
import {
  LEAD_COLUMNS,
  STATUS_LABELS,
  type LeadStatus,
} from "@/lib/crm-config";

interface LeadActionsProps {
  leadId: string;
  leadEmail: string | null;
  currentStatus: LeadStatus;
  managers: { id: string; email: string }[];
  assignedTo: string | null;
  quoteRequest: Tables<"quote_requests"> | null;
}

export default function LeadActions({
  leadId,
  leadEmail,
  currentStatus,
  managers,
  assignedTo,
  quoteRequest,
}: LeadActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Note form
  const [note, setNote] = useState("");

  // Lost reason
  const [showLostReason, setShowLostReason] = useState(false);
  const [lostReason, setLostReason] = useState("");

  // Quote request
  const [quoteSending, setQuoteSending] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Delete confirmation
  const [showDelete, setShowDelete] = useState(false);

  // Block confirmation
  const [showBlock, setShowBlock] = useState(false);

  const handleStatusChange = (newStatus: LeadStatus) => {
    if (newStatus === "lost") {
      setShowLostReason(true);
      return;
    }
    startTransition(async () => {
      await updateLeadStatus(leadId, newStatus);
      router.refresh();
    });
  };

  const handleLostConfirm = () => {
    startTransition(async () => {
      await updateLeadStatus(leadId, "lost", lostReason || undefined);
      setShowLostReason(false);
      setLostReason("");
      router.refresh();
    });
  };

  const handleAssign = (userId: string) => {
    startTransition(async () => {
      await assignLead(leadId, userId || null);
      router.refresh();
    });
  };

  const handleAddNote = () => {
    if (!note.trim()) return;
    startTransition(async () => {
      await addNote(leadId, note);
      setNote("");
      router.refresh();
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteLead(leadId);
    });
  };

  // Available status transitions
  const nextStatuses = LEAD_COLUMNS.filter(
    (col) => col.id !== currentStatus
  );

  return (
    <div className="space-y-6">
      {/* Status buttons */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">
          Cambiar estado
        </h3>
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
          Actual: {STATUS_LABELS[currentStatus]}
        </p>
        <div className="flex flex-wrap gap-2">
          {nextStatuses.map((col) => (
            <button
              key={col.id}
              onClick={() => handleStatusChange(col.id)}
              disabled={isPending}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${col.badge} hover:opacity-80`}
            >
              {col.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lost reason modal inline */}
      {showLostReason && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/10">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            Motivo de perdida (opcional)
          </p>
          <textarea
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            placeholder="Ej: Presupuesto demasiado alto..."
            className="mt-2 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none dark:border-red-700 dark:bg-zinc-900 dark:text-white"
            rows={2}
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleLostConfirm}
              disabled={isPending}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Confirmar
            </button>
            <button
              onClick={() => {
                setShowLostReason(false);
                setLostReason("");
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Assign */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">
          Asignar a
        </h3>
        <select
          value={assignedTo || ""}
          onChange={(e) => handleAssign(e.target.value)}
          disabled={isPending}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
        >
          <option value="">Sin asignar</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.email.split("@")[0]}
            </option>
          ))}
        </select>
      </div>

      {/* Presupuesto */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">
          Presupuesto
        </h3>
        {!quoteRequest ? (
          leadEmail ? (
            <div>
              <button
                onClick={() => {
                  setQuoteSending(true);
                  setQuoteError(null);
                  startTransition(async () => {
                    const result = await createQuoteRequest(leadId);
                    setQuoteSending(false);
                    if (!result.success) {
                      setQuoteError(result.error || "Error");
                    }
                    router.refresh();
                  });
                }}
                disabled={isPending || quoteSending}
                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {quoteSending ? "Enviando..." : "Enviar formulario presupuesto"}
              </button>
              {quoteError && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{quoteError}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              El lead necesita un email para enviar el formulario.
            </p>
          )
        ) : quoteRequest.status === "pending" ? (
          <div className="space-y-2">
            <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
              Formulario enviado — pendiente
            </span>
            <button
              onClick={() => {
                const baseUrl = window.location.origin;
                navigator.clipboard.writeText(`${baseUrl}/quote/${quoteRequest.token}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="block text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              {copied ? "Copiado!" : "Copiar enlace del formulario"}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Datos recibidos
            </span>
            <div className="text-xs text-zinc-600 dark:text-zinc-400">
              <p><strong>Razón social:</strong> {quoteRequest.billing_name}</p>
              <p><strong>NIF:</strong> {quoteRequest.tax_id}</p>
            </div>
            {quoteRequest.holded_proforma_id && (
              <a
                href={`https://app.holded.com/invoicing/proform/${quoteRequest.holded_proforma_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                Ver proforma en Holded
              </a>
            )}
          </div>
        )}
      </div>

      {/* Add note */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">
          Nota rapida
        </h3>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Escribe una nota..."
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
          rows={3}
        />
        <button
          onClick={handleAddNote}
          disabled={isPending || !note.trim()}
          className="mt-2 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Guardar nota
        </button>
      </div>

      {/* Block + Delete */}
      <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
        {/* Block sender */}
        {leadEmail && (
          <>
            {!showBlock ? (
              <button
                onClick={() => setShowBlock(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Bloquear remitente
              </button>
            ) : (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-900/10">
                <p className="text-sm text-orange-700 dark:text-orange-400">
                  Bloquear <strong>{leadEmail}</strong> y eliminar este lead. Los futuros emails de esta direccion no crearan leads.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => {
                      startTransition(async () => {
                        await blockEmailAndDeleteLead(leadId, leadEmail, "Bloqueado manualmente");
                      });
                    }}
                    disabled={isPending}
                    className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                  >
                    Bloquear y eliminar
                  </button>
                  <button
                    onClick={() => setShowBlock(false)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Delete */}
        {!showDelete ? (
          <button
            onClick={() => setShowDelete(true)}
            className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            Eliminar lead
          </button>
        ) : (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/10">
            <p className="text-sm text-red-700 dark:text-red-400">
              Esto eliminara el lead y todo su historial.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Confirmar eliminacion
              </button>
              <button
                onClick={() => setShowDelete(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
