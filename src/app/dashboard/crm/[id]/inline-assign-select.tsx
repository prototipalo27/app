"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignLead } from "../actions";

export default function InlineAssignSelect({
  leadId,
  currentAssignedTo,
  managers,
  displayName,
}: {
  leadId: string;
  currentAssignedTo: string | null;
  managers: { id: string; email: string }[];
  displayName: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (editing) {
    return (
      <select
        autoFocus
        value={currentAssignedTo || ""}
        onChange={(e) => {
          startTransition(async () => {
            await assignLead(leadId, e.target.value || null);
            setEditing(false);
            router.refresh();
          });
        }}
        onBlur={() => setEditing(false)}
        disabled={isPending}
        className="h-6 rounded border border-border bg-background px-1 text-xs text-foreground focus:outline-none"
      >
        <option value="">Sin asignar</option>
        {managers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.email.split("@")[0]}
          </option>
        ))}
      </select>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group inline-flex items-center gap-1 text-foreground hover:text-foreground/80"
    >
      {displayName || "Sin asignar"}
      <svg
        className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
        />
      </svg>
    </button>
  );
}
