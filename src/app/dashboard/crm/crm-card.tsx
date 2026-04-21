"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDraggable, useDroppable } from "@dnd-kit/react";
import type { Tables } from "@/lib/supabase/database.types";
import { tagClasses } from "@/lib/tag-colors";
import { Badge } from "@/components/ui/badge";

export { tagClasses };

export type LeadWithAssignee = Tables<"leads"> & {
  assignee_email?: string | null;
  owner_email?: string | null;
  last_activity_at?: string | null;
};

interface CrmCardProps {
  lead: LeadWithAssignee;
  commissionRate?: number;
  onTogglePreWon?: (leadId: string) => Promise<{ success: boolean; error?: string }>;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/** Returns Tailwind classes for lead aging badge based on time since last interaction */
export function agingClasses(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = diff / 3_600_000;
  if (hours < 24) {
    return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400";
  }
  if (hours < 72) {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400";
  }
  return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
}

/** Maturation hint based on status + days since last interaction */
function maturationHint(status: string, lastInteractionDate: string): { text: string; className: string } | null {
  if (status === "new" || status === "won" || status === "paid" || status === "lost") return null;
  const days = (Date.now() - new Date(lastInteractionDate).getTime()) / 86_400_000;
  if (days >= 7) {
    return { text: "Buscar el no", className: "text-red-600 dark:text-red-400" };
  }
  if (days >= 3) {
    return { text: "Enviar reminder", className: "text-amber-600 dark:text-amber-400" };
  }
  return null;
}

export function CrmCard({ lead, commissionRate, onTogglePreWon }: CrmCardProps) {
  const router = useRouter();
  const { ref: dragRef, isDragging } = useDraggable({
    id: lead.id,
    data: { status: lead.status },
  });
  const { ref: dropRef, isDropTarget } = useDroppable({
    id: `lead-${lead.id}`,
  });
  const setRef = (el: HTMLDivElement | null) => {
    dragRef(el);
    dropRef(el);
  };
  const [pinning, setPinning] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const canPin = lead.status === "quoted" || lead.is_pre_won;

  const handleTogglePreWon = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onTogglePreWon || pinning) return;
    setPinError(null);
    setPinning(true);
    onTogglePreWon(lead.id)
      .then((result) => {
        if (!result.success) {
          setPinError(result.error ?? "Error");
          setTimeout(() => setPinError(null), 3000);
        }
      })
      .finally(() => setPinning(false));
  };

  // Use last interaction date if available, otherwise fall back to created_at
  const interactionDate = lead.last_activity_at || lead.created_at;
  const age = timeAgo(interactionDate);
  const hint = maturationHint(lead.status, interactionDate);

  return (
    <div
      ref={setRef}
      onClick={() => {
        if (!isDragging) router.push(`/dashboard/crm/${lead.id}`);
      }}
      className={`relative cursor-grab rounded-lg border bg-card p-3 shadow-sm transition select-none ${
        isDragging ? "z-50 cursor-grabbing scale-[1.02] opacity-75 shadow-lg" : ""
      } ${isDropTarget && !isDragging ? "ring-2 ring-brand ring-offset-1" : ""} ${
        lead.is_pre_won ? "border-amber-400 dark:border-amber-500/70" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {canPin && (
            <button
              type="button"
              onClick={handleTogglePreWon}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={pinning}
              className={`shrink-0 rounded p-0.5 transition ${
                lead.is_pre_won
                  ? "text-amber-500 hover:text-amber-600"
                  : "text-muted-foreground/40 hover:text-amber-500"
              }`}
              title={
                pinError
                  ? pinError
                  : lead.is_pre_won
                    ? "Quitar de preganados"
                    : "Marcar como preganado"
              }
            >
              <svg
                className="h-4 w-4"
                fill={lead.is_pre_won ? "currentColor" : "none"}
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.1 10.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.673z" />
              </svg>
            </button>
          )}
          <h4 className="truncate text-sm font-semibold text-card-foreground">
            {lead.full_name}
          </h4>
          {lead.project_type_tag && (
            <Badge variant="secondary" className={tagClasses(lead.project_type_tag)}>
              {lead.project_type_tag}
            </Badge>
          )}
        </div>
        <Badge variant="secondary" className={agingClasses(interactionDate)} title={lead.last_activity_at ? "Última interacción" : "Creado"}>
          {age}
        </Badge>
      </div>

      {lead.company && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {lead.company}
        </p>
      )}

      {lead.email && (
        <p className="mt-1 truncate text-[11px] text-muted-foreground/70">
          {lead.email}
        </p>
      )}

      <div className="mt-2 flex items-center gap-2">
        {lead.assignee_email && (
          <div className="flex items-center gap-1">
            <span className="h-4 w-4 rounded-full bg-muted text-center text-[10px] font-medium leading-4 text-muted-foreground">
              {lead.assignee_email[0].toUpperCase()}
            </span>
            <span className="text-[11px] text-muted-foreground/70">
              {lead.assignee_email.split("@")[0]}
            </span>
          </div>
        )}
        {lead.owner_email && (
          <div className="flex items-center gap-1" title={`Captado por ${lead.owner_email.split("@")[0]}`}>
            <span className="h-4 w-4 rounded-full bg-amber-200 text-center text-[10px] font-medium leading-4 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              {lead.owner_email[0].toUpperCase()}
            </span>
          </div>
        )}
        {hint && (
          <span className={`ml-auto text-[10px] font-semibold ${hint.className}`}>
            {hint.text}
          </span>
        )}
        {lead.estimated_value != null && (
          <Badge variant="secondary" className={`${hint ? "" : "ml-auto"} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400`}>
            {lead.estimated_value.toLocaleString("es-ES")} €
          </Badge>
        )}
      </div>

    </div>
  );
}
