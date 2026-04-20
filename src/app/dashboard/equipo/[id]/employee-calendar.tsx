"use client";

import { useMemo, useState } from "react";
import { requestTimeOff } from "../calendar-actions";
import { useRouter } from "next/navigation";

interface Holiday {
  id: string;
  date: string;
  name: string;
  scope: string | null;
}

interface TimeOffRequest {
  id: string;
  start_date: string;
  end_date: string;
  type: string | null;
  status: string | null;
  notes: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  vacation: "Vacaciones",
  sick: "Baja médica",
  personal: "Asuntos propios",
  other: "Otro",
};

const TYPE_COLORS: Record<string, string> = {
  vacation: "bg-green-200 text-green-800 dark:bg-green-800/60 dark:text-green-100",
  sick: "bg-red-200 text-red-800 dark:bg-red-800/60 dark:text-red-100",
  personal: "bg-amber-200 text-amber-800 dark:bg-amber-800/60 dark:text-amber-100",
  other: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
};

const DAY_NAMES = ["L", "M", "X", "J", "V", "S", "D"];

const TOTAL_VACATION_DAYS = 22;

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

function isDateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function countBusinessDays(start: string, end: string, yearFilter?: number): number {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  let count = 0;
  const d = new Date(s);
  while (d <= e) {
    if (yearFilter === undefined || d.getFullYear() === yearFilter) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function daysBetween(from: Date, to: Date): number {
  const ms = new Date(to).setHours(0, 0, 0, 0) - new Date(from).setHours(0, 0, 0, 0);
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function formatShort(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}

export default function EmployeeCalendar({
  isOwnProfile,
  timeOff,
  holidays,
  year,
}: {
  isOwnProfile: boolean;
  timeOff: TimeOffRequest[];
  holidays: Holiday[];
  year: number;
}) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date(year, new Date().getMonth(), 1));
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    type: "vacation",
    notes: "",
  });

  const cy = currentDate.getFullYear();
  const cm = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(cy, cm);
  const firstDay = getFirstDayOfWeek(cy, cm);

  const holidayMap = useMemo(() => new Map(holidays.map((h) => [h.date, h])), [holidays]);

  const today = new Date();
  const todayStr = formatDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  // Summary stats for the year
  const stats = useMemo(() => {
    let used = 0;
    let pending = 0;
    for (const r of timeOff) {
      if (r.type !== "vacation") continue;
      const days = countBusinessDays(r.start_date, r.end_date, year);
      if (r.status === "approved") used += days;
      else if (r.status === "pending") pending += days;
    }
    return { used, pending, remaining: Math.max(TOTAL_VACATION_DAYS - used - pending, 0) };
  }, [timeOff, year]);

  // Next / ongoing vacation
  const nextVacation = useMemo(() => {
    const relevant = timeOff
      .filter((r) => r.type === "vacation" && r.status !== "rejected" && r.end_date >= todayStr)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
    return relevant[0] ?? null;
  }, [timeOff, todayStr]);

  const nextVacationMeta = useMemo(() => {
    if (!nextVacation) return null;
    const start = new Date(nextVacation.start_date + "T00:00:00");
    const end = new Date(nextVacation.end_date + "T00:00:00");
    const startDiff = daysBetween(today, start);
    const endDiff = daysBetween(today, end);
    const businessDays = countBusinessDays(nextVacation.start_date, nextVacation.end_date);
    const ongoing = startDiff <= 0 && endDiff >= 0;
    return { ongoing, startDiff, endDiff, businessDays };
  }, [nextVacation, today]);

  const monthStart = formatDateStr(cy, cm, 1);
  const monthEnd = formatDateStr(cy, cm, daysInMonth);
  const activeRequests = timeOff.filter(
    (r) => r.status !== "rejected" && r.start_date <= monthEnd && r.end_date >= monthStart
  );

  const prevMonth = () => setCurrentDate(new Date(cy, cm - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(cy, cm + 1, 1));

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  // Upcoming + recent list (top 6 by relevance: ongoing/future first, then past)
  const requestsList = useMemo(() => {
    const sorted = [...timeOff].sort((a, b) => {
      const aUpcoming = a.end_date >= todayStr;
      const bUpcoming = b.end_date >= todayStr;
      if (aUpcoming && !bUpcoming) return -1;
      if (!aUpcoming && bUpcoming) return 1;
      if (aUpcoming) return a.start_date.localeCompare(b.start_date);
      return b.start_date.localeCompare(a.start_date);
    });
    return sorted.slice(0, 8);
  }, [timeOff, todayStr]);

  const handleSubmitRequest = async () => {
    if (!formData.startDate || !formData.endDate) return;
    setLoading(true);
    const result = await requestTimeOff({
      startDate: formData.startDate,
      endDate: formData.endDate,
      type: formData.type,
      notes: formData.notes || undefined,
    });
    if (result.success) {
      setShowModal(false);
      setFormData({ startDate: "", endDate: "", type: "vacation", notes: "" });
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* Próximas vacaciones — featured card */}
      <div className="rounded-lg border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4 dark:border-green-900/50 dark:from-green-900/20 dark:to-emerald-900/20">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-green-700 dark:text-green-400">
              Próximas vacaciones
            </p>
            {nextVacation && nextVacationMeta ? (
              <>
                <p className="mt-1 text-base font-bold text-zinc-900 dark:text-white">
                  {formatShort(nextVacation.start_date)} — {formatShort(nextVacation.end_date)}
                </p>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  {nextVacationMeta.businessDays} día{nextVacationMeta.businessDays !== 1 ? "s" : ""} laborable{nextVacationMeta.businessDays !== 1 ? "s" : ""}
                  {nextVacation.status === "pending" && (
                    <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      pendiente de aprobar
                    </span>
                  )}
                </p>
                <p className="mt-2 text-xs font-medium text-green-700 dark:text-green-400">
                  {nextVacationMeta.ongoing
                    ? `De vacaciones (faltan ${nextVacationMeta.endDiff} día${nextVacationMeta.endDiff !== 1 ? "s" : ""} para volver)`
                    : nextVacationMeta.startDiff === 0
                      ? "Empiezan hoy"
                      : nextVacationMeta.startDiff === 1
                        ? "Empiezan mañana"
                        : `Faltan ${nextVacationMeta.startDiff} días`}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Sin vacaciones programadas
              </p>
            )}
          </div>
          {isOwnProfile && (
            <button
              onClick={() => setShowModal(true)}
              className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark"
            >
              Solicitar
            </button>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Usados {year}</p>
          <p className="mt-0.5 text-base font-bold text-zinc-900 dark:text-white">{stats.used}</p>
          <p className="text-[10px] text-zinc-400">de {TOTAL_VACATION_DAYS} días</p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Pendientes</p>
          <p className="mt-0.5 text-base font-bold text-amber-600 dark:text-amber-400">{stats.pending}</p>
          <p className="text-[10px] text-zinc-400">por aprobar</p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Disponibles</p>
          <p className="mt-0.5 text-base font-bold text-green-600 dark:text-green-400">{stats.remaining}</p>
          <p className="text-[10px] text-zinc-400">restantes</p>
        </div>
      </div>

      {/* Mini calendar */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium capitalize text-zinc-700 dark:text-zinc-300">
            {currentDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
          </span>
          <button
            onClick={nextMonth}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-px rounded-lg border border-zinc-200 bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-700">
          {DAY_NAMES.map((d) => (
            <div
              key={d}
              className="bg-zinc-50 px-1 py-1 text-center text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            >
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={`empty-${i}`} className="min-h-[44px] bg-zinc-50 dark:bg-zinc-900/50" />;
            }
            const dateStr = formatDateStr(cy, cm, day);
            const holiday = holidayMap.get(dateStr);
            const isWeekend = i % 7 >= 5;
            const isToday = dateStr === todayStr;
            const dayRequests = activeRequests.filter((r) => isDateInRange(dateStr, r.start_date, r.end_date));
            const primary = dayRequests[0];
            const bg =
              primary && primary.status !== "pending"
                ? TYPE_COLORS[primary.type ?? "other"] ?? TYPE_COLORS.other
                : primary
                  ? `${TYPE_COLORS[primary.type ?? "other"] ?? TYPE_COLORS.other} opacity-60`
                  : holiday
                    ? "bg-red-50 dark:bg-red-900/20"
                    : isWeekend
                      ? "bg-zinc-100 dark:bg-zinc-800/50"
                      : "bg-white dark:bg-zinc-900";

            return (
              <div
                key={day}
                className={`min-h-[44px] p-1 ${bg}`}
                title={
                  primary
                    ? `${TYPE_LABELS[primary.type ?? "other"]}${primary.status === "pending" ? " (pendiente)" : ""}`
                    : holiday?.name
                }
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[11px] font-medium ${
                      isToday
                        ? "flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white"
                        : holiday
                          ? "text-red-600 dark:text-red-400"
                          : isWeekend
                            ? "text-zinc-400"
                            : "text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {day}
                  </span>
                </div>
                {holiday && !primary && (
                  <p className="mt-0.5 truncate text-[8px] font-medium text-red-500 dark:text-red-400">
                    {holiday.name}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-green-400" /> Vacaciones
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-amber-400" /> Asuntos propios
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-red-400" /> Baja / festivo
          </span>
        </div>
      </div>

      {/* Requests list */}
      {requestsList.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            Ausencias
          </h3>
          <div className="space-y-1.5">
            {requestsList.map((r) => {
              const isPast = r.end_date < todayStr;
              const days = countBusinessDays(r.start_date, r.end_date);
              return (
                <div
                  key={r.id}
                  className={`flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800 ${
                    isPast ? "opacity-60" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          TYPE_COLORS[r.type ?? "other"] ?? TYPE_COLORS.other
                        }`}
                      >
                        {TYPE_LABELS[r.type ?? "other"] ?? r.type}
                      </span>
                      <span className="text-xs text-zinc-700 dark:text-zinc-300">
                        {formatShort(r.start_date)} — {formatShort(r.end_date)}
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        {days} día{days !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {r.notes && (
                      <p className="mt-0.5 truncate text-[10px] text-zinc-400">{r.notes}</p>
                    )}
                  </div>
                  <span
                    className={`ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      STATUS_STYLES[r.status ?? "pending"] ?? ""
                    }`}
                  >
                    {STATUS_LABELS[r.status ?? "pending"] ?? r.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Request modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">
              Solicitar ausencia
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Desde</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Hasta</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Tipo</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="vacation">Vacaciones</option>
                  <option value="sick">Baja médica</option>
                  <option value="personal">Asuntos propios</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Notas (opcional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-zinc-300 px-4 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitRequest}
                disabled={loading || !formData.startDate || !formData.endDate}
                className="rounded-lg bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
              >
                Enviar solicitud
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
