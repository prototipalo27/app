"use client";

import { useState } from "react";
import {
  acceptRequest,
  rejectRequest,
  resolveRequest,
  confirmRequest,
  reopenRequest,
  deleteRequest,
  updatePriority,
} from "../actions";

interface RequestActionsProps {
  requestId: string;
  status: string;
  priority: string | null;
  requestedBy: string;
  currentUserId: string;
  isManager: boolean;
}

export default function RequestActions({
  requestId,
  status,
  priority,
  requestedBy,
  currentUserId,
  isManager,
}: RequestActionsProps) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [showAcceptForm, setShowAcceptForm] = useState(false);
  const [notes, setNotes] = useState("");
  const [selectedPriority, setSelectedPriority] = useState(priority || "medium");
  const [loading, setLoading] = useState(false);

  const isRequester = requestedBy === currentUserId;

  async function handleAccept() {
    setLoading(true);
    try {
      await acceptRequest(requestId, selectedPriority);
    } finally {
      setLoading(false);
      setShowAcceptForm(false);
    }
  }

  async function handleReject() {
    setLoading(true);
    try {
      await rejectRequest(requestId, notes);
    } finally {
      setLoading(false);
      setShowRejectForm(false);
      setNotes("");
    }
  }

  async function handleResolve() {
    setLoading(true);
    try {
      await resolveRequest(requestId, notes);
    } finally {
      setLoading(false);
      setShowResolveForm(false);
      setNotes("");
    }
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      await confirmRequest(requestId);
    } finally {
      setLoading(false);
    }
  }

  async function handleReopen() {
    setLoading(true);
    try {
      await reopenRequest(requestId);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Eliminar esta solicitud?")) return;
    setLoading(true);
    try {
      await deleteRequest(requestId);
    } finally {
      setLoading(false);
    }
  }

  async function handlePriorityChange(newPriority: string) {
    await updatePriority(requestId, newPriority);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
        Acciones
      </h3>

      {/* Manager actions on pending requests */}
      {isManager && status === "pending" && (
        <div className="space-y-3">
          {!showAcceptForm && !showRejectForm && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAcceptForm(true)}
                disabled={loading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Aceptar
              </button>
              <button
                type="button"
                onClick={() => setShowRejectForm(true)}
                disabled={loading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Rechazar
              </button>
            </div>
          )}

          {showAcceptForm && (
            <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Prioridad
              </label>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={loading}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setShowAcceptForm(false)}
                  className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {showRejectForm && (
            <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Motivo del rechazo
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
                placeholder="Explica el motivo..."
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={loading}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Rechazar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectForm(false);
                    setNotes("");
                  }}
                  className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manager actions on accepted requests */}
      {isManager && status === "accepted" && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Prioridad
            </label>
            <select
              value={priority || "medium"}
              onChange={(e) => handlePriorityChange(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>

          {!showResolveForm ? (
            <button
              type="button"
              onClick={() => setShowResolveForm(true)}
              disabled={loading}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              Marcar como resuelta
            </button>
          ) : (
            <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Notas de resolucion
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
                placeholder="Describe que se ha hecho..."
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleResolve}
                  disabled={loading}
                  className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  Resolver
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowResolveForm(false);
                    setNotes("");
                  }}
                  className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Requester actions on resolved requests */}
      {isRequester && status === "resolved" && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Esta solicitud ha sido resuelta. Estas conforme?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={handleReopen}
              disabled={loading}
              className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20 disabled:opacity-50"
            >
              Reabrir
            </button>
          </div>
        </div>
      )}

      {/* Manager delete (always available) */}
      {isManager && (
        <div className="border-t border-zinc-200 pt-3 dark:border-zinc-700">
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-50"
          >
            Eliminar solicitud
          </button>
        </div>
      )}
    </div>
  );
}
