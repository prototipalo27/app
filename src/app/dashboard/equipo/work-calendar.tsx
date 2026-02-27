"use client";

import { useState } from "react";
import { requestTimeOff, approveTimeOff, rejectTimeOff, ensureHolidays } from "./calendar-actions";

interface Holiday {
  id: string;
  date: string;
  name: string;
  scope: string | null;
}

interface TimeOffRequest {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  type: string | null;
  status: string | null;
  notes: string | null;
  user: { id: string; full_name: string | null; email: string } | null;
  approver: { full_name: string | null } | null;
}

const EMPLOYEE_COLORS = [
  "bg-blue-200 dark:bg-blue-800",
  "bg-green-200 dark:bg-green-800",
  "bg-amber-200 dark:bg-amber-800",
  "bg-pink-200 dark:bg-pink-800",
  "bg-cyan-200 dark:bg-cyan-800",
  "bg-violet-200 dark:bg-violet-800",
  "bg-orange-200 dark:bg-orange-800",
  "bg-teal-200 dark:bg-teal-800",
  "bg-rose-200 dark:bg-rose-800",
];

const TYPE_LABELS: Record<string, string> = {
  vacation: "Vacaciones",
  sick: "Baja médica",
  personal: "Asuntos propios",
  other: "Otro",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
}

function formatDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isDateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export default function WorkCalendar({
  holidays: initialHolidays,
  timeOffRequests: initialRequests,
  isManager,
  currentUserId,
  year: initialYear,
}: {
  holidays: Holiday[];
  timeOffRequests: TimeOffRequest[];
  isManager: boolean;
  currentUserId: string;
  year: number;
}) {
  const [holidays, setHolidays] = useState(initialHolidays);
  const [requests, setRequests] = useState(initialRequests);
  const [currentDate, setCurrentDate] = useState(new Date(initialYear, new Date().getMonth(), 1));
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    type: "vacation",
    notes: "",
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const holidayMap = new Map(holidays.map((h) => [h.date, h]));

  // Get unique employees from requests
  const employeeMap = new Map<string, { name: string; color: string }>();
  let colorIdx = 0;
  for (const req of requests) {
    if (req.status === "rejected") continue;
    if (!employeeMap.has(req.user_id)) {
      const name = req.user?.full_name || req.user?.email?.split("@")[0] || "?";
      employeeMap.set(req.user_id, {
        name,
        color: EMPLOYEE_COLORS[colorIdx % EMPLOYEE_COLORS.length],
      });
      colorIdx++;
    }
  }

  // Requests active in this month
  const monthStart = formatDateStr(year, month, 1);
  const monthEnd = formatDateStr(year, month, daysInMonth);
  const activeRequests = requests.filter(
    (r) => r.status !== "rejected" && r.start_date <= monthEnd && r.end_date >= monthStart
  );

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

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
    }
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    setLoading(true);
    await approveTimeOff(id);
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "approved" } : r)));
    setLoading(false);
  };

  const handleReject = async (id: string) => {
    setLoading(true);
    await rejectTimeOff(id);
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "rejected" } : r)));
    setLoading(false);
  };

  const handleEnsureHolidays = async () => {
    setLoading(true);
    const result = await ensureHolidays(year);
    if (result.success) {
      // Reload would be handled by revalidation, but update local state
      window.location.reload();
    }
    setLoading(false);
  };

  // Build calendar grid
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Calendario laboral</h2>
          {isManager && pendingCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {pendingCount} pendiente{pendingCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isManager && holidays.length === 0 && (
            <button
              onClick={handleEnsureHolidays}
              disabled={loading}
              className="rounded-lg border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cargar festivos {year}
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-brand px-3 py-1 text-xs font-medium text-white hover:bg-brand-dark"
          >
            Solicitar vacaciones
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="mb-3 flex items-center justify-between">
        <button onClick={prevMonth} className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-sm font-medium capitalize text-zinc-700 dark:text-zinc-300">
          {currentDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
        </span>
        <button onClick={nextMonth} className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px rounded-lg border border-zinc-200 bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-700">
        {DAY_NAMES.map((d) => (
          <div key={d} className="bg-zinc-50 px-1 py-1.5 text-center text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="min-h-[60px] bg-zinc-50 dark:bg-zinc-900/50" />;
          }

          const dateStr = formatDateStr(year, month, day);
          const holiday = holidayMap.get(dateStr);
          const isWeekend = i % 7 >= 5;
          const isToday = dateStr === formatDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

          // Find time off for this day
          const dayRequests = activeRequests.filter(
            (r) => isDateInRange(dateStr, r.start_date, r.end_date)
          );

          return (
            <div
              key={day}
              className={`min-h-[60px] p-1 ${
                holiday
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
              {holiday && (
                <p className="mt-0.5 truncate text-[8px] font-medium text-red-500 dark:text-red-400" title={holiday.name}>
                  {holiday.name}
                </p>
              )}
              {dayRequests.map((r) => {
                const emp = employeeMap.get(r.user_id);
                return (
                  <div
                    key={r.id}
                    className={`mt-0.5 truncate rounded px-1 text-[8px] font-medium ${emp?.color ?? "bg-zinc-200"} ${r.status === "pending" ? "opacity-60" : ""}`}
                    title={`${emp?.name} - ${TYPE_LABELS[r.type ?? "other"] ?? r.type}${r.status === "pending" ? " (pendiente)" : ""}`}
                  >
                    {emp?.name}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 text-[10px]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
          <span className="text-zinc-500 dark:text-zinc-400">Festivo</span>
        </span>
        {Array.from(employeeMap.entries()).map(([userId, emp]) => (
          <span key={userId} className="flex items-center gap-1">
            <span className={`inline-block h-2 w-2 rounded-full ${emp.color}`} />
            <span className="text-zinc-500 dark:text-zinc-400">{emp.name}</span>
          </span>
        ))}
      </div>

      {/* Pending requests (manager view) */}
      {isManager && requests.some((r) => r.status === "pending") && (
        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <h3 className="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">Solicitudes pendientes</h3>
          <div className="space-y-2">
            {requests
              .filter((r) => r.status === "pending")
              .map((r) => {
                const name = r.user?.full_name || r.user?.email?.split("@")[0] || "?";
                return (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border border-zinc-100 p-2 dark:border-zinc-800">
                    <div>
                      <p className="text-xs font-medium text-zinc-900 dark:text-white">{name}</p>
                      <p className="text-[10px] text-zinc-500">
                        {TYPE_LABELS[r.type ?? "other"] ?? r.type}: {new Date(r.start_date).toLocaleDateString("es-ES")} — {new Date(r.end_date).toLocaleDateString("es-ES")}
                      </p>
                      {r.notes && <p className="text-[10px] text-zinc-400">{r.notes}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleApprove(r.id)}
                        disabled={loading}
                        className="rounded bg-green-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-green-700"
                      >
                        Aprobar
                      </button>
                      <button
                        onClick={() => handleReject(r.id)}
                        disabled={loading}
                        className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-red-700"
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Request modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">Solicitar vacaciones/ausencia</h3>
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
