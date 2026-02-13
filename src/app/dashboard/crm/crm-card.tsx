"use client";

import { useRouter } from "next/navigation";
import { useDraggable } from "@dnd-kit/react";
import type { Tables } from "@/lib/supabase/database.types";

export type LeadWithAssignee = Tables<"leads"> & {
  assignee_email?: string | null;
};

interface CrmCardProps {
  lead: LeadWithAssignee;
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
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
          {lead.full_name}
        </h4>
        <span className="shrink-0 text-[11px] text-zinc-400 dark:text-zinc-500">
          {createdDate}
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
