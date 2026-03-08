"use client";

import { useRouter } from "next/navigation";
import { useDraggable } from "@dnd-kit/react";
import type { Tables } from "@/lib/supabase/database.types";
import { tagClasses } from "@/lib/tag-colors";
import { Badge } from "@/components/ui/badge";

export { tagClasses };

export type LeadWithAssignee = Tables<"leads"> & {
  assignee_email?: string | null;
  owner_email?: string | null;
};

interface CrmCardProps {
  lead: LeadWithAssignee;
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

/** Returns Tailwind classes for lead aging badge based on time since last update */
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

export function CrmCard({ lead }: CrmCardProps) {
  const router = useRouter();
  const { ref, isDragging } = useDraggable({
    id: lead.id,
    data: { status: lead.status },
  });

  const age = timeAgo(lead.created_at);

  return (
    <div
      ref={ref}
      onClick={() => {
        if (!isDragging) router.push(`/dashboard/crm/${lead.id}`);
      }}
      className={`relative cursor-grab rounded-lg border bg-card p-3 shadow-sm transition select-none ${
        isDragging ? "z-50 cursor-grabbing scale-[1.02] opacity-75 shadow-lg" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <h4 className="truncate text-sm font-semibold text-card-foreground">
            {lead.full_name}
          </h4>
          {lead.project_type_tag && (
            <Badge variant="secondary" className={tagClasses(lead.project_type_tag)}>
              {lead.project_type_tag}
            </Badge>
          )}
        </div>
        <Badge variant="secondary" className={agingClasses(lead.created_at)}>
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
        {lead.estimated_value != null && (
          <Badge variant="secondary" className="ml-auto bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            {lead.estimated_value.toLocaleString("es-ES")} €
          </Badge>
        )}
      </div>
    </div>
  );
}
