"use client";

import { useState, useCallback } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useDroppable } from "@dnd-kit/react";
import { LEAD_COLUMNS, type LeadStatus } from "@/lib/crm-config";
import { CrmCard, type LeadWithAssignee } from "./crm-card";
import { updateLeadStatus, dismissLead } from "./actions";
import Link from "next/link";

interface CrmKanbanProps {
  initialLeads: LeadWithAssignee[];
  managers: { id: string; name: string }[];
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "…";
}

function CrmColumn({
  column,
  leads,
}: {
  column: (typeof LEAD_COLUMNS)[number];
  leads: LeadWithAssignee[];
}) {
  const { ref, isDropTarget } = useDroppable({ id: column.id });

  return (
    <div className="flex min-w-0 flex-col rounded-xl bg-zinc-100 dark:bg-zinc-900">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className={`h-2.5 w-2.5 rounded-full ${column.accent}`} />
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          {column.label}
        </h3>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${column.badge}`}
        >
          {leads.length}
        </span>
      </div>

      <div
        ref={ref}
        className={`flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2 transition-colors ${
          isDropTarget
            ? "rounded-b-xl ring-2 ring-green-500/50 ring-inset"
            : ""
        }`}
      >
        {leads.map((lead) => (
          <CrmCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  );
}

export function CrmKanban({ initialLeads, managers }: CrmKanbanProps) {
  const [leads, setLeads] = useState(initialLeads);
  const [filterManager, setFilterManager] = useState<string>("all");
  const [lostModal, setLostModal] = useState<{
    leadId: string;
    previousStatus: string;
  } | null>(null);
  const [lostReason, setLostReason] = useState("");

  const handleDragEnd = useCallback(
    (event: {
      operation: {
        source: { id: string | number } | null;
        target: { id: string | number } | null;
      };
    }) => {
      const { source, target } = event.operation;
      if (!source || !target) return;

      const leadId = String(source.id);
      const newStatus = String(target.id) as LeadStatus;

      const lead = leads.find((l) => l.id === leadId);
      if (!lead || lead.status === newStatus) return;
      if (!LEAD_COLUMNS.some((col) => col.id === newStatus)) return;

      const previousStatus = lead.status;

      // If moving to "lost", show modal for reason
      if (newStatus === "lost") {
        setLostModal({ leadId, previousStatus });
        // Optimistic update
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId ? { ...l, status: newStatus } : l
          )
        );
        return;
      }

      // Optimistic update
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, status: newStatus } : l
        )
      );

      updateLeadStatus(leadId, newStatus).catch(() => {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId ? { ...l, status: previousStatus } : l
          )
        );
      });
    },
    [leads]
  );

  const handleLostConfirm = () => {
    if (!lostModal) return;
    updateLeadStatus(lostModal.leadId, "lost", lostReason || undefined).catch(
      () => {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === lostModal.leadId
              ? { ...l, status: lostModal.previousStatus }
              : l
          )
        );
      }
    );
    setLostModal(null);
    setLostReason("");
  };

  const handleLostCancel = () => {
    if (!lostModal) {
      return;
    }
    // Revert optimistic update
    setLeads((prev) =>
      prev.map((l) =>
        l.id === lostModal.leadId
          ? { ...l, status: lostModal.previousStatus }
          : l
      )
    );
    setLostModal(null);
    setLostReason("");
  };

  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const handleDismiss = async (lead: LeadWithAssignee) => {
    if (!confirm(lead.email ? `Bloquear ${lead.email} y eliminar este lead?` : "Eliminar este lead?")) return;
    setDismissingId(lead.id);
    const result = await dismissLead(lead.id, lead.email);
    if (result.success) {
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    }
    setDismissingId(null);
  };

  const filteredLeads = filterManager === "all"
    ? leads
    : filterManager === "unassigned"
      ? leads.filter((l) => !l.assigned_to)
      : leads.filter((l) => l.assigned_to === filterManager);

  const newLeads = filteredLeads.filter((l) => l.status === "new");
  const kanbanColumns = LEAD_COLUMNS.filter((col) => col.id !== "new");

  return (
    <>
      {/* ── Commercial filter ── */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Comercial:</span>
        {[
          { id: "all", label: "Todos" },
          ...managers.map((m) => ({ id: m.id, label: m.name })),
          { id: "unassigned", label: "Sin asignar" },
        ].map((opt) => (
          <button
            key={opt.id}
            onClick={() => setFilterManager(opt.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filterManager === opt.id
                ? "bg-green-600 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── New leads strip ── */}
      {newLeads.length > 0 && (
        <div className="mb-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Nuevos
            </h3>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {newLeads.length}
            </span>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {newLeads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center gap-4 px-4 py-3"
              >
                {/* Name + company */}
                <Link
                  href={`/dashboard/crm/${lead.id}`}
                  className="min-w-0 shrink-0 basis-44"
                >
                  <p className="truncate text-sm font-semibold text-zinc-900 hover:underline dark:text-white">
                    {lead.full_name}
                  </p>
                  {lead.company && (
                    <p className="truncate text-xs text-zinc-400">
                      {lead.company}
                    </p>
                  )}
                </Link>

                {/* Message (~30 words max) + attachment icon */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                    {lead.message ? truncateWords(lead.message, 30) : "—"}
                  </p>
                  {lead.attachments && (
                    <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      Archivos adjuntos
                    </span>
                  )}
                </div>

                {/* Phone */}
                {lead.phone ? (
                  <a
                    href={`tel:${lead.phone}`}
                    className="shrink-0 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {lead.phone}
                  </a>
                ) : (
                  <span className="shrink-0 text-sm text-zinc-300 dark:text-zinc-600">
                    Sin tel.
                  </span>
                )}

                {/* Descartar */}
                <button
                  onClick={() => handleDismiss(lead)}
                  disabled={dismissingId === lead.id}
                  className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                  title={lead.email ? `Bloquear ${lead.email} y eliminar` : "Eliminar lead"}
                >
                  {dismissingId === lead.id ? "..." : "Descartar"}
                </button>

                {/* Contactar button */}
                {lead.email ? (
                  <a
                    href={`mailto:${lead.email}`}
                    className="shrink-0 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Contactar
                  </a>
                ) : (
                  <Link
                    href={`/dashboard/crm/${lead.id}`}
                    className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    Ver lead
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Kanban ── */}
      <DragDropProvider onDragEnd={handleDragEnd}>
        <div className="grid min-h-0 flex-1 auto-cols-[240px] grid-flow-col gap-4 overflow-x-auto pb-4 md:grid-cols-4 md:auto-cols-auto">
          {kanbanColumns.map((column) => (
            <CrmColumn
              key={column.id}
              column={column}
              leads={filteredLeads.filter((l) => l.status === column.id)}
            />
          ))}
        </div>
      </DragDropProvider>

      {/* Lost reason modal */}
      {lostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Motivo de perdida
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Opcional: indica por que se perdio este lead.
            </p>
            <textarea
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="Ej: Presupuesto demasiado alto, eligio competidor..."
              className="mt-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
              rows={3}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={handleLostCancel}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleLostConfirm}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Marcar como perdido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
