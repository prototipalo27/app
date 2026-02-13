"use client";

import { useState, useCallback } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useDroppable } from "@dnd-kit/react";
import { LEAD_COLUMNS, type LeadStatus } from "@/lib/crm-config";
import { CrmCard, type LeadWithAssignee } from "./crm-card";
import { updateLeadStatus } from "./actions";

interface CrmKanbanProps {
  initialLeads: LeadWithAssignee[];
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

export function CrmKanban({ initialLeads }: CrmKanbanProps) {
  const [leads, setLeads] = useState(initialLeads);
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

  return (
    <>
      <DragDropProvider onDragEnd={handleDragEnd}>
        <div className="grid min-h-0 flex-1 auto-cols-[240px] grid-flow-col gap-4 overflow-x-auto pb-4 md:grid-cols-5 md:auto-cols-auto">
          {LEAD_COLUMNS.map((column) => (
            <CrmColumn
              key={column.id}
              column={column}
              leads={leads.filter((l) => l.status === column.id)}
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
