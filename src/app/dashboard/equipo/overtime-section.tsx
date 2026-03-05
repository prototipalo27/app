"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getOvertimeBalance,
  getOvertimeEntries,
  addOvertimeEntry,
  deleteOvertimeEntry,
  getAllOvertimeEntries,
} from "./overtime-actions";

interface OvertimeEntry {
  id: string;
  user_id: string;
  date: string;
  minutes: number;
  reason: string;
  type: string;
  created_at: string | null;
}

interface GlobalOvertimeEntry extends OvertimeEntry {
  user_profiles: { full_name: string | null; nickname: string | null; email: string } | null;
}

interface User {
  id: string;
  full_name: string | null;
  nickname: string | null;
  email: string;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? "-" : "";
  if (h === 0) return `${sign}${m}min`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}min`;
}

function canDelete(createdAt: string | null): boolean {
  if (!createdAt) return false;
  const diff = Date.now() - new Date(createdAt).getTime();
  return diff < 24 * 60 * 60 * 1000;
}

export default function OvertimeSection({
  isManager,
  isImpersonating,
  currentUserId,
  users,
}: {
  isManager: boolean;
  isImpersonating: boolean;
  currentUserId: string;
  users: User[];
}) {
  const [balance, setBalance] = useState(0);
  const [entries, setEntries] = useState<OvertimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [globalView, setGlobalView] = useState(false);
  const [globalEntries, setGlobalEntries] = useState<GlobalOvertimeEntry[]>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formMinutes, setFormMinutes] = useState(60);
  const [formReason, setFormReason] = useState("");
  const [formType, setFormType] = useState<"earned" | "used">("earned");

  const isViewingOther = isManager && selectedUserId !== null && selectedUserId !== currentUserId;
  const canEdit = !isImpersonating && !isViewingOther;
  const targetUserId = isManager && selectedUserId ? selectedUserId : undefined;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [b, e] = await Promise.all([
        getOvertimeBalance(targetUserId),
        getOvertimeEntries(targetUserId),
      ]);
      setBalance(b);
      setEntries(e);
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (globalView && globalEntries.length === 0) {
      setLoading(true);
      getAllOvertimeEntries().then((data) => {
        setGlobalEntries(data as GlobalOvertimeEntry[]);
        setLoading(false);
      });
    }
  }, [globalView, globalEntries.length]);

  async function handleSubmit() {
    if (!formReason.trim()) {
      setError("El motivo es obligatorio");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await addOvertimeEntry({
      date: formDate,
      minutes: formMinutes,
      reason: formReason,
      type: formType,
    });
    if (result.success) {
      setFormReason("");
      setFormMinutes(60);
      setFormType("earned");
      await loadData();
    } else {
      setError(result.error);
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    setLoading(true);
    setError(null);
    const result = await deleteOvertimeEntry(id);
    if (result.success) {
      await loadData();
    } else {
      setError(result.error);
    }
    setLoading(false);
  }

  // Running balance for history
  const entriesAsc = [...entries].reverse();
  const runningBalances = new Map<string, number>();
  let runningTotal = 0;
  for (const entry of entriesAsc) {
    runningTotal += entry.type === "earned" ? entry.minutes : -entry.minutes;
    runningBalances.set(entry.id, runningTotal);
  }

  const balancePercent = Math.min(balance / (8 * 60), 1) * 100;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Horas extra
        </h2>
        {isManager && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGlobalView(!globalView)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                globalView
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              Vista global
            </button>
            {!globalView && (
              <select
                value={selectedUserId ?? ""}
                onChange={(e) => setSelectedUserId(e.target.value || null)}
                className="rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="">Mis horas</option>
                {users
                  .filter((u) => u.id !== currentUserId)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nickname || u.full_name || u.email.split("@")[0]}
                    </option>
                  ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Global view for managers */}
      {isManager && globalView ? (
        <div>
          {/* Search */}
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Buscar por persona o motivo..."
            className="mb-3 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />

          {/* Summary per user */}
          {(() => {
            const byUser = new Map<string, { name: string; earned: number; used: number }>();
            for (const e of globalEntries) {
              const name = e.user_profiles?.nickname || e.user_profiles?.full_name || e.user_profiles?.email.split("@")[0] || "?";
              const prev = byUser.get(e.user_id) || { name, earned: 0, used: 0 };
              if (e.type === "earned") prev.earned += e.minutes;
              else prev.used += e.minutes;
              byUser.set(e.user_id, prev);
            }
            const summaries = [...byUser.entries()].sort((a, b) => (b[1].earned - b[1].used) - (a[1].earned - a[1].used));

            return summaries.length > 0 ? (
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {summaries.map(([uid, s]) => (
                  <div key={uid} className="rounded-lg border border-zinc-100 p-2 dark:border-zinc-800">
                    <p className="truncate text-xs font-medium text-zinc-900 dark:text-white">{s.name}</p>
                    <p className={`text-sm font-bold ${s.earned - s.used > 0 ? "text-green-600 dark:text-green-400" : "text-zinc-500"}`}>
                      {formatMinutes(s.earned - s.used)}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      +{formatMinutes(s.earned)} / -{formatMinutes(s.used)}
                    </p>
                  </div>
                ))}
              </div>
            ) : null;
          })()}

          {/* All entries */}
          {loading ? (
            <p className="py-4 text-center text-xs text-zinc-400 animate-pulse">Cargando...</p>
          ) : (
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {globalEntries
                .filter((e) => {
                  if (!globalFilter) return true;
                  const q = globalFilter.toLowerCase();
                  const name = (e.user_profiles?.nickname || e.user_profiles?.full_name || e.user_profiles?.email || "").toLowerCase();
                  return name.includes(q) || e.reason.toLowerCase().includes(q);
                })
                .map((entry) => {
                  const name = entry.user_profiles?.nickname || entry.user_profiles?.full_name || entry.user_profiles?.email.split("@")[0] || "?";
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                            {name}
                          </span>
                          <span
                            className={`shrink-0 text-xs font-semibold ${
                              entry.type === "earned"
                                ? "text-green-600 dark:text-green-400"
                                : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {entry.type === "earned" ? "+" : "-"}{formatMinutes(entry.minutes)}
                          </span>
                          <span className="truncate text-xs text-zinc-700 dark:text-zinc-300">
                            {entry.reason}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-zinc-400">
                          {new Date(entry.date).toLocaleDateString("es-ES", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      ) : (
      <>

      {/* Balance */}
      <div className="mb-4 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Saldo disponible</p>
        <p className={`mt-0.5 text-lg font-bold ${loading ? "animate-pulse text-zinc-400" : "text-zinc-900 dark:text-white"}`}>
          {formatMinutes(balance)}
        </p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div
            className={`h-full rounded-full transition-all ${balance > 0 ? "bg-green-500" : "bg-zinc-400"}`}
            style={{ width: `${Math.max(balancePercent, 0)}%` }}
          />
        </div>
      </div>

      {/* Error — visible from any action */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Form — only for own entries */}
      {canEdit && (
        <div className="mb-4 space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[120px]">
              <label className="mb-1 block text-xs text-zinc-500">Fecha</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div className="flex-1 min-w-[100px]">
              <label className="mb-1 block text-xs text-zinc-500">Tiempo (min)</label>
              <input
                type="number"
                min={1}
                value={formMinutes}
                onChange={(e) => setFormMinutes(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="mb-1 block text-xs text-zinc-500">Tipo</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as "earned" | "used")}
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="earned">Horas extra</option>
                <option value="used">Canjear tiempo</option>
              </select>
            </div>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {[30, 60, 120, 180].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setFormMinutes(m)}
                className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
                  formMinutes === m
                    ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {formatMinutes(m)}
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-500">Motivo</label>
            <input
              type="text"
              value={formReason}
              onChange={(e) => {
                setFormReason(e.target.value);
                if (error) setError(null);
              }}
              placeholder="ej: llaveros interfarmacia"
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !formReason.trim() || formMinutes <= 0}
            className="w-full rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {formType === "earned" ? "Registrar horas extra" : "Canjear tiempo"}
          </button>
        </div>
      )}

      {/* History */}
      <div>
        <h3 className="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
          Historial
        </h3>
        {!loading && entries.length === 0 ? (
          <p className="text-xs text-zinc-400">Sin registros</p>
        ) : (
          <div className="space-y-1.5">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`shrink-0 text-xs font-semibold ${
                        entry.type === "earned"
                          ? "text-green-600 dark:text-green-400"
                          : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {entry.type === "earned" ? "+" : "-"}{formatMinutes(entry.minutes)}
                    </span>
                    <span className="truncate text-xs text-zinc-700 dark:text-zinc-300">
                      {entry.reason}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-400">
                    <span>
                      {new Date(entry.date).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span>Saldo: {formatMinutes(runningBalances.get(entry.id) ?? 0)}</span>
                  </div>
                </div>
                {!isViewingOther && canDelete(entry.created_at) && (
                  <button
                    onClick={() => handleDelete(entry.id)}
                    disabled={loading}
                    className="ml-2 shrink-0 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                    title="Borrar"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
