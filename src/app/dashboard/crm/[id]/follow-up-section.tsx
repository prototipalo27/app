"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFollowUp, completeFollowUp, deleteFollowUp } from "../actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { es } from "react-day-picker/locale";

const ACTION_TYPES = [
  { value: "call", label: "Llamada", icon: "phone" },
  { value: "meeting", label: "Reunion", icon: "users" },
  { value: "email", label: "Email", icon: "mail" },
  { value: "other", label: "Otro", icon: "calendar" },
] as const;

const ACTION_ICONS: Record<string, React.ReactNode> = {
  call: (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  meeting: (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  email: (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  other: (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
};

interface FollowUp {
  id: string;
  scheduled_date: string;
  note: string;
  action_type: string;
  completed_at: string | null;
  created_at: string;
}

export function FollowUpSection({
  leadId,
  followUps,
}: {
  leadId: string;
  followUps: FollowUp[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [note, setNote] = useState("");
  const [actionType, setActionType] = useState("call");

  const pending = followUps
    .filter((f) => !f.completed_at)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

  const completed = followUps
    .filter((f) => f.completed_at)
    .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));

  const handleCreate = () => {
    if (!date) return;
    startTransition(async () => {
      await createFollowUp(leadId, date, note, actionType);
      setShowForm(false);
      setDate("");
      setNote("");
      setActionType("call");
      router.refresh();
    });
  };

  const handleComplete = (id: string) => {
    startTransition(async () => {
      await completeFollowUp(id);
      router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteFollowUp(id);
      router.refresh();
    });
  };

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const addDays = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const QUICK_DATES = [
    { label: "+1 dia", value: addDays(1) },
    { label: "+3 dias", value: addDays(3) },
    { label: "+1 sem", value: addDays(7) },
    { label: "+1 mes", value: addDays(30) },
  ];

  const selectedDateLabel = date
    ? QUICK_DATES.find((q) => q.value === date)?.label ||
      new Date(date + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" })
    : null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-card-foreground">
          Agenda
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setShowForm((v) => !v); if (!date) setDate(addDays(1)); }}
          className="h-7 px-2 text-xs"
        >
          {showForm ? "Cancelar" : "+ Programar"}
        </Button>
      </div>

      {showForm && (
        <div className="mb-3 space-y-2 rounded-lg border bg-muted/50 p-3">
          {/* Quick date buttons */}
          <div className="grid grid-cols-4 gap-1">
            {QUICK_DATES.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => setDate(q.value)}
                className={`rounded-md px-1 py-1.5 text-xs font-medium transition-colors ${
                  date === q.value
                    ? "bg-foreground text-background"
                    : "bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Date display + calendar picker */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {date
                ? new Date(date + "T12:00:00").toLocaleDateString("es-ES", {
                    weekday: "short",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "Sin fecha"}
            </span>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger
                className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Cambiar
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  locale={es}
                  selected={date ? new Date(date + "T12:00:00") : undefined}
                  onSelect={(day) => {
                    if (day) {
                      const y = day.getFullYear();
                      const m = String(day.getMonth() + 1).padStart(2, "0");
                      const d = String(day.getDate()).padStart(2, "0");
                      setDate(`${y}-${m}-${d}`);
                    }
                    setCalendarOpen(false);
                  }}
                  disabled={{ before: new Date() }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Action type */}
          <div className="grid grid-cols-4 gap-1">
            {ACTION_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setActionType(t.value)}
                className={`flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[10px] transition-colors ${
                  actionType === t.value
                    ? "bg-brand text-white"
                    : "bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                {ACTION_ICONS[t.value]}
                {t.label}
              </button>
            ))}
          </div>

          {/* Note */}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota (ej: reunirnos para ver muestras)"
            rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!date || isPending}
            className="w-full"
          >
            {isPending ? "Guardando..." : "Programar"}
          </Button>
        </div>
      )}

      {pending.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground">Sin acciones programadas</p>
      )}

      {pending.length > 0 && (
        <div className="space-y-1.5">
          {pending.map((f) => {
            const isOverdue = f.scheduled_date < todayStr;
            const isToday = f.scheduled_date === todayStr;
            return (
              <div
                key={f.id}
                className={`group flex items-start gap-2 rounded-lg border p-2 text-xs ${
                  isOverdue
                    ? "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20"
                    : isToday
                      ? "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20"
                      : "border-border bg-background"
                }`}
              >
                <button
                  onClick={() => handleComplete(f.id)}
                  disabled={isPending}
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-muted-foreground/30 transition-colors hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/30"
                  title="Marcar como hecho"
                >
                  <span className="hidden group-hover:block text-green-600 text-[10px]">&#10003;</span>
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">{ACTION_ICONS[f.action_type] || ACTION_ICONS.other}</span>
                    <span className="font-medium">
                      {new Date(f.scheduled_date + "T12:00:00").toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    {isOverdue && (
                      <Badge variant="secondary" className="bg-red-100 text-red-700 text-[9px] dark:bg-red-900/30 dark:text-red-400">
                        Vencido
                      </Badge>
                    )}
                    {isToday && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[9px] dark:bg-amber-900/30 dark:text-amber-400">
                        Hoy
                      </Badge>
                    )}
                  </div>
                  {f.note && (
                    <p className="mt-0.5 text-muted-foreground">{f.note}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(f.id)}
                  disabled={isPending}
                  className="shrink-0 text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  title="Eliminar"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {completed.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
            {completed.length} completado{completed.length > 1 ? "s" : ""}
          </summary>
          <div className="mt-1 space-y-1">
            {completed.map((f) => (
              <div key={f.id} className="flex items-center gap-2 rounded px-2 py-1 text-xs text-muted-foreground line-through">
                {ACTION_ICONS[f.action_type] || ACTION_ICONS.other}
                <span>
                  {new Date(f.scheduled_date + "T12:00:00").toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                {f.note && <span className="truncate">— {f.note}</span>}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
