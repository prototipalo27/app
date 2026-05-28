"use client";

import { useState, useTransition } from "react";
import { confirmKickoffSlot } from "./actions";

interface SlotButtonsProps {
  token: string;
  slots: string[];
}

function formatSlot(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
  const time = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return { day, time };
}

export function SlotButtons({ token, slots }: SlotButtonsProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClick(slot: string) {
    setError(null);
    setSelectedSlot(slot);
    startTransition(async () => {
      const result = await confirmKickoffSlot(token, slot);
      if (result && "error" in result) {
        setError(result.error);
        setSelectedSlot(null);
      }
    });
  }

  return (
    <div className="space-y-3">
      {slots.map((slot) => {
        const { day, time } = formatSlot(slot);
        const isThis = selectedSlot === slot;
        const isDisabled = isPending;
        return (
          <button
            key={slot}
            type="button"
            onClick={() => handleClick(slot)}
            disabled={isDisabled}
            className={`w-full rounded-xl border px-5 py-4 text-left transition ${
              isThis
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400 hover:shadow-sm"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <div className="text-xs font-medium uppercase tracking-wide opacity-70">
              {day}
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {time}
              {isThis && isPending && (
                <span className="ml-3 align-middle text-sm font-normal opacity-80">
                  Reservando…
                </span>
              )}
            </div>
          </button>
        );
      })}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
