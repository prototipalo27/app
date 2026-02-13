"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateLeadStatus,
  assignLead,
  addNote,
  sendLeadEmail,
  deleteLead,
} from "../actions";
import {
  LEAD_COLUMNS,
  STATUS_LABELS,
  type LeadStatus,
} from "@/lib/crm-config";

interface LeadActionsProps {
  leadId: string;
  currentStatus: LeadStatus;
  leadEmail: string | null;
  managers: { id: string; email: string }[];
  assignedTo: string | null;
}

export default function LeadActions({
  leadId,
  currentStatus,
  leadEmail,
  managers,
  assignedTo,
}: LeadActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Note form
  const [note, setNote] = useState("");

  // Email form
  const [showEmail, setShowEmail] = useState(false);
  const [emailTo, setEmailTo] = useState(leadEmail || "");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  // Lost reason
  const [showLostReason, setShowLostReason] = useState(false);
  const [lostReason, setLostReason] = useState("");

  // Delete confirmation
  const [showDelete, setShowDelete] = useState(false);

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

  const handleSendEmail = () => {
    if (!emailTo.trim() || !emailSubject.trim() || !emailBody.trim()) return;
    startTransition(async () => {
      await sendLeadEmail(leadId, emailTo, emailSubject, emailBody);
      setShowEmail(false);
      setEmailSubject("");
      setEmailBody("");
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
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
        >
          <option value="">Sin asignar</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.email.split("@")[0]}
            </option>
          ))}
        </select>
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
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
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

      {/* Email composer */}
      <div>
        <button
          onClick={() => setShowEmail(!showEmail)}
          className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          {showEmail ? "Cerrar email" : "Enviar email"}
        </button>

        {showEmail && (
          <div className="mt-3 space-y-2">
            <input
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="Para"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
            />
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Asunto"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
            />
            <textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder="Cuerpo del email..."
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
              rows={4}
            />
            <button
              onClick={handleSendEmail}
              disabled={
                isPending ||
                !emailTo.trim() ||
                !emailSubject.trim() ||
                !emailBody.trim()
              }
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
        )}
      </div>

      {/* Delete */}
      <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
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
