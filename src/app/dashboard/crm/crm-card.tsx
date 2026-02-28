"use client";

import { useRouter } from "next/navigation";
import { useDraggable } from "@dnd-kit/react";
import type { Tables } from "@/lib/supabase/database.types";
import { tagClasses } from "@/lib/tag-colors";

export { tagClasses };

export type LeadWithAssignee = Tables<"leads"> & {
  assignee_email?: string | null;
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
    // Green — less than 1 day
    return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400";
  }
  if (hours < 72) {
    // Orange — 1-2 days
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400";
  }
  // Red — 3+ days
  return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
}

export function CrmCard({ lead }: CrmCardProps) {
  const router = useRouter();
  const { ref, isDragging } = useDraggable({
    id: lead.id,
    data: { status: lead.status },
  });

  const createdDate = new Date(lead.created_at).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
  const age = timeAgo(lead.updated_at);

  return (
    <div
      ref={ref}
      onClick={() => {
        if (!isDragging) router.push(`/dashboard/crm/${lead.id}`);
      }}
      className={`relative cursor-grab rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition select-none dark:border-zinc-700 dark:bg-zinc-800 ${
        isDragging ? "z-50 cursor-grabbing scale-[1.02] opacity-75 shadow-lg" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <h4 className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
            {lead.full_name}
          </h4>
          {lead.project_type_tag && (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${tagClasses(lead.project_type_tag)}`}>
              {lead.project_type_tag}
            </span>
          )}
        </div>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${agingClasses(lead.updated_at)}`}>
          {age}
        </span>
      </div>

      {lead.company && (
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {lead.company}
        </p>
      )}

      {lead.email && (
        <p className="mt-1 truncate text-[11px] text-zinc-400 dark:text-zinc-500">
          {lead.email}
        </p>
      )}

      {lead.assignee_email && (
        <div className="mt-2 flex items-center gap-1">
          <span className="h-4 w-4 rounded-full bg-zinc-200 text-center text-[10px] font-medium leading-4 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
            {lead.assignee_email[0].toUpperCase()}
          </span>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
            {lead.assignee_email.split("@")[0]}
          </span>
        </div>
      )}
    </div>
  );
}
