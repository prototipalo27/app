"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDraggable, useDroppable } from "@dnd-kit/react";
import type { Tables } from "@/lib/supabase/database.types";
import { tagClasses } from "@/lib/tag-colors";
import { Badge } from "@/components/ui/badge";
import { ShippingAddressModal } from "./shipping-address-modal";
import { DeliveryDateModal } from "./delivery-date-modal";

export { tagClasses };

export type LeadWithAssignee = Tables<"leads"> & {
  assignee_email?: string | null;
  owner_email?: string | null;
  last_activity_at?: string | null;
  shipping_address?: string | null;
  pickup_in_person?: boolean;
  pending_second_half?: boolean;
};

/**
 * Once a lead is paid (any tranche), production starts and we need to know
 * where + when to ship. If either is missing, raise a visible alert.
 * Recogida en persona silencia el check de dirección — el cliente viene a por él.
 */
export function deliveryRisk(lead: LeadWithAssignee): { missingShipping: boolean; missingDeliveryDate: boolean; isAtRisk: boolean } {
  const isPaidPhase = lead.status === "paid";
  const missingShipping =
    !lead.pickup_in_person &&
    (!lead.shipping_address || lead.shipping_address.trim().length === 0);
  const missingDeliveryDate = !lead.desired_delivery_date;
  return {
    missingShipping,
    missingDeliveryDate,
    isAtRisk: isPaidPhase && (missingShipping || missingDeliveryDate),
  };
}

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
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);

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
  const risk = deliveryRisk(lead);
  const cardTitle = risk.isAtRisk
    ? risk.missingShipping && risk.missingDeliveryDate
      ? "Falta dirección de envío y fecha de entrega"
      : risk.missingShipping
        ? "Falta dirección de envío"
        : "Falta fecha de entrega"
    : null;

  const AlertIcon = () => (
    <svg className="h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  );

  return (
    <div
      ref={setRef}
      onClick={() => {
        if (!isDragging) router.push(`/dashboard/crm/${lead.id}`);
      }}
      title={cardTitle ?? undefined}
      className={`relative cursor-grab rounded-lg border bg-card p-3 shadow-sm transition select-none ${
        isDragging ? "z-50 cursor-grabbing scale-[1.02] opacity-75 shadow-lg" : ""
      } ${isDropTarget && !isDragging ? "ring-2 ring-brand ring-offset-1" : ""} ${
        risk.isAtRisk
          ? "border-red-500 ring-2 ring-red-500/30 bg-red-50/40 dark:bg-red-950/20 dark:border-red-500"
          : lead.is_pre_won
            ? "border-amber-400 dark:border-amber-500/70"
            : ""
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

      {risk.isAtRisk && (
        <div className="mt-1.5 space-y-1">
          {risk.missingShipping && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAddressModal(true);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="flex w-full items-center gap-1 rounded-sm text-left text-[11px] font-medium text-red-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 dark:text-red-400"
            >
              <AlertIcon />
              Falta dirección de envío
            </button>
          )}
          {risk.missingDeliveryDate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowDateModal(true);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="flex w-full items-center gap-1 rounded-sm text-left text-[11px] font-medium text-red-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 dark:text-red-400"
            >
              <AlertIcon />
              Falta fecha de entrega
            </button>
          )}
        </div>
      )}

      {showAddressModal && (
        <ShippingAddressModal
          leadId={lead.id}
          open={showAddressModal}
          onOpenChange={setShowAddressModal}
          initialPickup={Boolean(lead.pickup_in_person)}
          defaultRecipientEmail={lead.email}
          defaultRecipientPhone={lead.phone}
        />
      )}

      {showDateModal && (
        <DeliveryDateModal
          leadId={lead.id}
          open={showDateModal}
          onOpenChange={setShowDateModal}
          initialDate={lead.desired_delivery_date}
        />
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
        {lead.pending_second_half && (
          <Badge
            variant="secondary"
            className={`${hint ? "" : "ml-auto"} bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400`}
            title="50% pagado — pendiente el segundo 50% antes del envío"
          >
            50%
          </Badge>
        )}
        {lead.estimated_value != null && (
          <Badge variant="secondary" className={`${hint || lead.pending_second_half ? "" : "ml-auto"} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400`}>
            {lead.estimated_value.toLocaleString("es-ES")} €
          </Badge>
        )}
      </div>

    </div>
  );
}
