"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { subtractBusinessHours, leadHoursToDays } from "@/lib/business-days";
import { updateDeliveryLeadHours, resyncAllDeliveries } from "./actions";

interface DeliveryProject {
  id: string;
  name: string;
  client_name: string | null;
  deadline: string | null;
  status: string;
}

interface Holiday {
  date: string;
  name: string;
}

interface Props {
  projects: DeliveryProject[];
  holidays: Holiday[];
  leadHours: number;
  isManager: boolean;
}

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function formatDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function DeliveryCalendar({ projects, holidays, leadHours: initialLeadHours, isManager }: Props) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [leadHours, setLeadHours] = useState(initialLeadHours);
  const [editingHours, setEditingHours] = useState(false);
  const [draftHours, setDraftHours] = useState(String(initialLeadHours));
  const [pending, startTransition] = useTransition();
  const [resyncMessage, setResyncMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const lastJumpedQuery = useRef<string>("");

  const holidaySet = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays]);
  const holidayMap = useMemo(() => new Map(holidays.map((h) => [h.date, h.name])), [holidays]);

  const normalizedQuery = query.trim().toLowerCase();
  const matchIds = useMemo(() => {
    if (!normalizedQuery) return null;
    const ids = new Set<string>();
    for (const p of projects) {
      const haystack = `${p.name ?? ""} ${p.client_name ?? ""}`.toLowerCase();
      if (haystack.includes(normalizedQuery)) ids.add(p.id);
    }
    return ids;
  }, [normalizedQuery, projects]);

  // Para cada proyecto: día de entrega + día de inicio de preparación.
  const eventsByDate = useMemo(() => {
    const map = new Map<string, { deliveries: DeliveryProject[]; preps: DeliveryProject[] }>();
    const ensure = (date: string) => {
      if (!map.has(date)) map.set(date, { deliveries: [], preps: [] });
      return map.get(date)!;
    };
    for (const p of projects) {
      if (!p.deadline) continue;
      ensure(p.deadline).deliveries.push(p);
      if (leadHours > 0) {
        const prep = subtractBusinessHours(p.deadline, leadHours, holidaySet);
        ensure(prep).preps.push(p);
      }
    }
    return map;
  }, [projects, leadHours, holidaySet]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  // Si el usuario busca un proyecto que no está en el mes visible, saltar
  // al mes de la primera coincidencia (entrega o preparación, la más temprana).
  useEffect(() => {
    if (!matchIds || matchIds.size === 0) {
      lastJumpedQuery.current = normalizedQuery;
      return;
    }
    if (lastJumpedQuery.current === normalizedQuery) return;

    const monthStart = new Date(year, month, 1).getTime();
    const monthEnd = new Date(year, month + 1, 1).getTime();

    let earliest: { date: string; time: number } | null = null;
    let hasInCurrentMonth = false;
    for (const [dateStr, ev] of eventsByDate.entries()) {
      const anyMatch =
        ev.deliveries.some((p) => matchIds.has(p.id)) ||
        ev.preps.some((p) => matchIds.has(p.id));
      if (!anyMatch) continue;
      const t = new Date(dateStr).getTime();
      if (t >= monthStart && t < monthEnd) {
        hasInCurrentMonth = true;
        break;
      }
      if (!earliest || t < earliest.time) earliest = { date: dateStr, time: t };
    }

    if (!hasInCurrentMonth && earliest) {
      const d = new Date(earliest.date);
      setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
    }
    lastJumpedQuery.current = normalizedQuery;
  }, [normalizedQuery, matchIds, eventsByDate, year, month]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = formatDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  const handleSaveHours = () => {
    const value = Number(draftHours);
    if (!Number.isFinite(value) || value < 0 || value > 1000) return;
    startTransition(async () => {
      const result = await updateDeliveryLeadHours(value);
      if (result.success) {
        setLeadHours(value);
        setEditingHours(false);
      }
    });
  };

  const handleResync = () => {
    setResyncMessage(null);
    startTransition(async () => {
      const result = await resyncAllDeliveries();
      if (result.success) {
        setResyncMessage(`✓ ${result.synced} proyecto(s) sincronizado(s)`);
      } else {
        setResyncMessage(`Error: ${result.error}`);
      }
    });
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header con threshold ajustable */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Mes anterior"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-sm font-medium capitalize text-zinc-700 dark:text-zinc-300">
            {currentDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
          </span>
          <button
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Mes siguiente"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Hoy
          </button>
          <div className="relative">
            <svg
              className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar proyecto o cliente..."
              className="w-48 rounded-lg border border-zinc-300 bg-white py-1 pr-2 pl-7 text-xs text-zinc-900 placeholder-zinc-400 focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
            />
            {normalizedQuery && matchIds && matchIds.size === 0 && (
              <span className="absolute top-full left-0 mt-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                Sin resultados
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>Margen de preparación:</span>
          {editingHours ? (
            <>
              <input
                type="number"
                min={0}
                max={1000}
                step={1}
                value={draftHours}
                onChange={(e) => setDraftHours(e.target.value)}
                className="w-16 rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <span>h</span>
              <button
                onClick={handleSaveHours}
                disabled={pending}
                className="rounded-lg bg-brand px-2 py-1 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
              >
                Guardar
              </button>
              <button
                onClick={() => {
                  setEditingHours(false);
                  setDraftHours(String(leadHours));
                }}
                className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {leadHours}h ({leadHoursToDays(leadHours)} días lab.)
              </span>
              {isManager && (
                <>
                  <button
                    onClick={() => setEditingHours(true)}
                    className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    Ajustar
                  </button>
                  <button
                    onClick={handleResync}
                    disabled={pending}
                    className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    title="Re-sincronizar con Google Calendar"
                  >
                    {pending ? "Sincronizando..." : "Resync Google"}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
      {resyncMessage && (
        <div className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">{resyncMessage}</div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px rounded-lg border border-zinc-200 bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-700">
        {DAY_NAMES.map((d) => (
          <div key={d} className="bg-zinc-50 px-1 py-1.5 text-center text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="min-h-[80px] bg-zinc-50 dark:bg-zinc-900/50" />;
          }

          const dateStr = formatDateStr(year, month, day);
          const holidayName = holidayMap.get(dateStr);
          const isWeekend = i % 7 >= 5;
          const isToday = dateStr === todayStr;
          const events = eventsByDate.get(dateStr);

          return (
            <div
              key={day}
              className={`min-h-[80px] p-1 ${
                holidayName
                  ? "bg-red-50 dark:bg-red-900/20"
                  : isWeekend
                    ? "bg-zinc-100 dark:bg-zinc-800/50"
                    : "bg-white dark:bg-zinc-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-medium ${
                    isToday
                      ? "flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white"
                      : holidayName
                        ? "text-red-600 dark:text-red-400"
                        : isWeekend
                          ? "text-zinc-400"
                          : "text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {day}
                </span>
              </div>
              {holidayName && (
                <p className="mt-0.5 truncate text-[8px] font-medium text-red-500 dark:text-red-400" title={holidayName}>
                  {holidayName}
                </p>
              )}
              {events?.preps.map((p) => {
                const dimmed = matchIds !== null && !matchIds.has(p.id);
                return (
                  <button
                    key={`prep-${p.id}`}
                    onClick={() => router.push(`/dashboard/projects/${p.id}`)}
                    className={`mt-0.5 block w-full truncate rounded border border-amber-300 bg-amber-50 px-1 py-0.5 text-left text-[9px] font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 ${
                      dimmed ? "opacity-20 grayscale" : ""
                    }`}
                    title={`Empezar: ${p.client_name || p.name}`}
                  >
                    ▶ {p.client_name || p.name}
                  </button>
                );
              })}
              {events?.deliveries.map((p) => {
                const dimmed = matchIds !== null && !matchIds.has(p.id);
                return (
                  <button
                    key={`del-${p.id}`}
                    onClick={() => router.push(`/dashboard/projects/${p.id}`)}
                    className={`mt-0.5 block w-full truncate rounded bg-emerald-100 px-1 py-0.5 text-left text-[9px] font-semibold text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60 ${
                      dimmed ? "opacity-20 grayscale" : ""
                    }`}
                    title={`Entrega: ${p.client_name || p.name}`}
                  >
                    ✓ {p.client_name || p.name}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="mt-3 flex flex-wrap gap-3 text-[10px]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded bg-emerald-500" />
          <span className="text-zinc-500 dark:text-zinc-400">Entrega</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded bg-amber-400" />
          <span className="text-zinc-500 dark:text-zinc-400">Inicio preparación ({leadHours}h antes)</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
          <span className="text-zinc-500 dark:text-zinc-400">Festivo</span>
        </span>
      </div>
    </div>
  );
}
