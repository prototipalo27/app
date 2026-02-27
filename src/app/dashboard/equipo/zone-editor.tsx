"use client";

import { useTransition, useState } from "react";
import { assignZone, removeZone } from "./actions";
import { ZONES } from "@/lib/zones";

export default function ZoneEditor({
  userId,
  userZones,
}: {
  userId: string;
  userZones: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleToggle(zone: string, checked: boolean) {
    startTransition(async () => {
      if (checked) {
        await assignZone(userId, zone);
      } else {
        await removeZone(userId, zone);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-1 text-xs text-zinc-400 hover:text-zinc-200"
      >
        Editar zonas
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-300">Responsable de zona</span>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Cerrar
        </button>
      </div>

      <div className="space-y-1">
        {ZONES.map((zone) => (
          <label
            key={zone.id}
            className="flex items-center gap-2 rounded px-1 py-0.5 text-xs text-zinc-300 hover:bg-zinc-700/50"
          >
            <input
              type="checkbox"
              checked={userZones.includes(zone.id)}
              onChange={(e) => handleToggle(zone.id, e.target.checked)}
              disabled={isPending}
              className="rounded border-zinc-600 bg-zinc-700 text-brand focus:ring-brand-blue/30"
            />
            <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${zone.color}`}>
              {zone.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
