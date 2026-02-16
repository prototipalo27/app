"use client";

import { useState, useMemo, useCallback } from "react";
import {
  parseBBVAStatement,
  groupByVendor,
  type BankTransaction,
  type VendorGroup,
} from "@/lib/bbva-parser";
import {
  saveVendorMappingsBatch,
  sendClaimEmail,
  saveStatement,
  getStatement,
  deleteStatement,
  getOrCreateMonthFolder,
} from "./actions";

interface Supplier {
  id: string;
  name: string;
  email: string | null;
}

interface VendorMapping {
  id: string;
  bank_vendor_name: string;
  supplier_id: string | null;
}

interface ClaimHistoryItem {
  id: string;
  supplier_id: string | null;
  claim_date: string | null;
  email_sent_to: string;
  total_amount: number;
  status: string | null;
  created_at: string | null;
  suppliers: { name: string } | null;
}

export interface StatementSummary {
  id: string;
  month: number;
  year: number;
  file_name: string | null;
  total_count: number;
  pending_count: number;
  drive_folder_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface Props {
  suppliers: Supplier[];
  vendorMappings: VendorMapping[];
  claimHistory: ClaimHistoryItem[];
  statements: StatementSummary[];
}

type View = "index" | "review" | "claims";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function StatementProcessor({
  suppliers,
  vendorMappings,
  claimHistory,
  statements: initialStatements,
}: Props) {
  const [view, setView] = useState<View>("index");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeMonth, setActiveMonth] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [filterPending, setFilterPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statements, setStatements] = useState<StatementSummary[]>(initialStatements);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);

  // Vendor mapping state
  const [mappings, setMappings] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    vendorMappings.forEach((vm) => {
      if (vm.supplier_id) m[vm.bank_vendor_name] = vm.supplier_id;
    });
    return m;
  });

  // Claims state
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
  const [sendingClaim, setSendingClaim] = useState<string | null>(null);
  const [sentClaims, setSentClaims] = useState<Set<string>>(new Set());
  const [claimErrors, setClaimErrors] = useState<Record<string, string>>({});

  // Filtered and grouped
  const displayedTransactions = useMemo(() => {
    if (!filterPending) return transactions;
    return transactions.filter(
      (t) => t.status.toLowerCase().includes("pendiente") || t.status === ""
    );
  }, [transactions, filterPending]);

  const vendorGroups = useMemo(
    () => groupByVendor(displayedTransactions),
    [displayedTransactions]
  );

  const totalTransactions = transactions.length;
  const pendingCount = transactions.filter(
    (t) => t.status.toLowerCase().includes("pendiente") || t.status === ""
  ).length;

  // Get statement summary for a given month in the selected year
  const getMonthStatement = useCallback(
    (month: number) => statements.find((s) => s.month === month && s.year === selectedYear),
    [statements, selectedYear]
  );

  // Auto-detect month/year from parsed transactions
  const detectMonthYear = useCallback((txs: BankTransaction[]): { month: number; year: number } => {
    const now = new Date();
    if (txs.length === 0) return { month: now.getMonth() + 1, year: now.getFullYear() };

    // Parse dates (dd/mm/yyyy format)
    const dates = txs
      .map((t) => {
        const parts = t.date.split("/");
        if (parts.length >= 2) {
          const m = parseInt(parts[1], 10);
          const y = parts.length === 3 ? parseInt(parts[2], 10) : now.getFullYear();
          return { month: m, year: y < 100 ? 2000 + y : y };
        }
        return null;
      })
      .filter(Boolean) as { month: number; year: number }[];

    if (dates.length === 0) return { month: now.getMonth() + 1, year: now.getFullYear() };

    // Most common month
    const counts = new Map<string, number>();
    for (const d of dates) {
      const key = `${d.year}-${d.month}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    let bestKey = "";
    let bestCount = 0;
    for (const [key, count] of counts) {
      if (count > bestCount) {
        bestKey = key;
        bestCount = count;
      }
    }
    const [yearStr, monthStr] = bestKey.split("-");
    return { month: parseInt(monthStr, 10), year: parseInt(yearStr, 10) };
  }, []);

  // Handle file upload and save to DB
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>, targetMonth?: number) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);
      setLoading(true);

      try {
        const buffer = await file.arrayBuffer();
        const parsed = parseBBVAStatement(buffer);

        const detected = targetMonth != null
          ? { month: targetMonth, year: selectedYear }
          : detectMonthYear(parsed);

        const total = parsed.length;
        const pending = parsed.filter(
          (t) => t.status.toLowerCase().includes("pendiente") || t.status === ""
        ).length;

        // Save to DB
        await saveStatement(detected.month, detected.year, file.name, parsed, total, pending);

        // Update local state
        setTransactions(parsed);
        setActiveMonth(detected.month);
        setSelectedYear(detected.year);
        setActiveFileName(file.name);

        // Update statements list
        setStatements((prev) => {
          const filtered = prev.filter(
            (s) => !(s.month === detected.month && s.year === detected.year)
          );
          return [
            ...filtered,
            {
              id: crypto.randomUUID(),
              month: detected.month,
              year: detected.year,
              file_name: file.name,
              total_count: total,
              pending_count: pending,
              drive_folder_id: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ];
        });

        setView("review");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al procesar el archivo");
      } finally {
        setLoading(false);
      }
    },
    [selectedYear, detectMonthYear]
  );

  // Load a month from DB
  const handleLoadMonth = useCallback(
    async (month: number) => {
      setError(null);
      setLoading(true);
      try {
        const stmt = await getStatement(month, selectedYear);
        if (!stmt) {
          setError("No se encontro el extracto");
          return;
        }
        setTransactions(stmt.transactions as unknown as BankTransaction[]);
        setActiveMonth(month);
        setActiveFileName(stmt.file_name);
        setView("review");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar extracto");
      } finally {
        setLoading(false);
      }
    },
    [selectedYear]
  );

  // Delete a month
  const handleDeleteMonth = useCallback(
    async (month: number) => {
      if (!confirm(`Eliminar el extracto de ${MONTH_NAMES[month - 1]} ${selectedYear}?`)) return;
      setError(null);
      try {
        await deleteStatement(month, selectedYear);
        setStatements((prev) =>
          prev.filter((s) => !(s.month === month && s.year === selectedYear))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al eliminar");
      }
    },
    [selectedYear]
  );

  // Open Drive folder for a month (create if needed)
  const handleOpenDriveFolder = useCallback(
    async (month: number) => {
      setError(null);
      try {
        const folderId = await getOrCreateMonthFolder(month, selectedYear);
        // Update local cache
        setStatements((prev) =>
          prev.map((s) =>
            s.month === month && s.year === selectedYear
              ? { ...s, drive_folder_id: folderId }
              : s
          )
        );
        window.open(`https://drive.google.com/drive/folders/${folderId}`, "_blank");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al abrir carpeta Drive");
      }
    },
    [selectedYear]
  );

  const handleMappingChange = useCallback(
    (vendorName: string, supplierId: string) => {
      setMappings((prev) => ({ ...prev, [vendorName]: supplierId }));
    },
    []
  );

  const handleSaveMappings = useCallback(async () => {
    setLoading(true);
    try {
      const batch = Object.entries(mappings)
        .filter(([, sid]) => sid)
        .map(([bankVendorName, supplierId]) => ({ bankVendorName, supplierId }));
      if (batch.length > 0) await saveVendorMappingsBatch(batch);
      setStep("claims");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar mapeos");
    } finally {
      setLoading(false);
    }
  }, [mappings]);

  const setStep = useCallback((s: View) => {
    setView(s);
    setSelectedVendors(new Set());
    setSentClaims(new Set());
    setClaimErrors({});
  }, []);

  const goBackToIndex = useCallback(() => {
    setView("index");
    setActiveMonth(null);
    setTransactions([]);
    setActiveFileName(null);
  }, []);

  const toggleVendorSelection = useCallback((vendorName: string) => {
    setSelectedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(vendorName)) next.delete(vendorName);
      else next.add(vendorName);
      return next;
    });
  }, []);

  const handleSendClaim = useCallback(
    async (group: VendorGroup) => {
      const supplierId = mappings[group.vendorName];
      if (!supplierId) return;

      const supplier = suppliers.find((s) => s.id === supplierId);
      if (!supplier?.email) {
        setClaimErrors((prev) => ({
          ...prev,
          [group.vendorName]: "El proveedor no tiene email configurado",
        }));
        return;
      }

      setSendingClaim(group.vendorName);
      setClaimErrors((prev) => {
        const next = { ...prev };
        delete next[group.vendorName];
        return next;
      });

      try {
        await sendClaimEmail(
          supplierId,
          supplier.email,
          supplier.name,
          group.transactions.map((t) => ({
            date: t.date,
            description: t.description,
            amount: t.amount,
          })),
          group.totalAmount
        );
        setSentClaims((prev) => new Set([...prev, group.vendorName]));
      } catch (err) {
        setClaimErrors((prev) => ({
          ...prev,
          [group.vendorName]: err instanceof Error ? err.message : "Error al enviar",
        }));
      } finally {
        setSendingClaim(null);
      }
    },
    [mappings, suppliers]
  );

  const getSupplierForVendor = useCallback(
    (vendorName: string) => {
      const sid = mappings[vendorName];
      if (!sid) return null;
      return suppliers.find((s) => s.id === sid) || null;
    },
    [mappings, suppliers]
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Cerrar
          </button>
        </div>
      )}

      {/* === INDEX VIEW === */}
      {view === "index" && (
        <>
          {/* Year selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedYear((y) => y - 1)}
                className="rounded-lg border border-zinc-300 p-2 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{selectedYear}</h2>
              <button
                onClick={() => setSelectedYear((y) => y + 1)}
                className="rounded-lg border border-zinc-300 p-2 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Upload for auto-detect */}
            <label className="cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
              {loading ? "Procesando..." : "Subir extracto"}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleFileUpload(e)}
                className="hidden"
                disabled={loading}
              />
            </label>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {MONTH_NAMES.map((name, i) => {
              const month = i + 1;
              const stmt = getMonthStatement(month);

              return (
                <div
                  key={month}
                  className={`group relative rounded-xl border p-4 transition-colors ${
                    stmt
                      ? "border-green-200 bg-green-50/50 dark:border-green-800/50 dark:bg-green-900/10"
                      : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                  }`}
                >
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">{name}</p>

                  {stmt ? (
                    <>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {stmt.total_count} mov.
                      </p>
                      {stmt.pending_count > 0 && (
                        <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          {stmt.pending_count} pend.
                        </span>
                      )}
                      <div className="mt-3 flex flex-col gap-1.5">
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleLoadMonth(month)}
                            disabled={loading}
                            className="flex-1 rounded-lg bg-brand px-2 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
                          >
                            Abrir
                          </button>
                          <button
                            onClick={() => handleOpenDriveFolder(month)}
                            title="Abrir carpeta en Drive"
                            className="rounded-lg bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex gap-1">
                          <label className="flex-1 cursor-pointer rounded-lg border border-zinc-300 px-2 py-1 text-center text-[10px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
                            Reemplazar
                            <input
                              type="file"
                              accept=".xlsx,.xls"
                              onChange={(e) => handleFileUpload(e, month)}
                              className="hidden"
                              disabled={loading}
                            />
                          </label>
                          <button
                            onClick={() => handleDeleteMonth(month)}
                            className="rounded-lg border border-red-200 px-2 py-1 text-[10px] font-medium text-red-500 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="mt-3">
                      <label className="block cursor-pointer rounded-lg border border-dashed border-zinc-300 px-2 py-3 text-center text-xs text-zinc-400 hover:border-green-400 hover:text-green-600 dark:border-zinc-700 dark:hover:border-green-600 dark:hover:text-green-400">
                        Subir
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={(e) => handleFileUpload(e, month)}
                          className="hidden"
                          disabled={loading}
                        />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* === REVIEW VIEW === */}
      {view === "review" && (
        <>
          {/* Header with back button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={goBackToIndex}
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {activeMonth ? MONTH_NAMES[activeMonth - 1] : ""} {selectedYear}
                </h2>
                {activeFileName && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{activeFileName}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeMonth && (
                <button
                  onClick={() => handleOpenDriveFolder(activeMonth)}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  Facturas en Drive
                </button>
              )}
              <label className="cursor-pointer rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
                Reemplazar extracto
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleFileUpload(e, activeMonth ?? undefined)}
                  className="hidden"
                  disabled={loading}
                />
              </label>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Movimientos totales" value={totalTransactions} />
            <StatCard label="Pendientes" value={pendingCount} accent />
            <StatCard label="Proveedores" value={vendorGroups.length} />
          </div>

          {/* Filter toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={filterPending}
                onChange={(e) => setFilterPending(e.target.checked)}
                className="rounded border-zinc-300 text-brand focus:ring-brand-blue dark:border-zinc-600"
              />
              Solo movimientos pendientes
            </label>
          </div>

          {/* Vendor groups */}
          <div className="space-y-4">
            {vendorGroups.map((group) => (
              <VendorGroupCard
                key={group.vendorName}
                group={group}
                suppliers={suppliers}
                currentMapping={mappings[group.vendorName] || ""}
                onMappingChange={(sid) => handleMappingChange(group.vendorName, sid)}
              />
            ))}
          </div>

          {/* Save & continue */}
          <div className="flex justify-end gap-3">
            <button
              onClick={handleSaveMappings}
              disabled={loading}
              className="rounded-lg bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar mapeos y continuar"}
            </button>
          </div>
        </>
      )}

      {/* === CLAIMS VIEW === */}
      {view === "claims" && (
        <>
          {/* Header with back */}
          <div className="flex items-center gap-3">
            <button
              onClick={goBackToIndex}
              className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Reclamaciones — {activeMonth ? MONTH_NAMES[activeMonth - 1] : ""} {selectedYear}
            </h2>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              Selecciona los proveedores a los que quieres enviar una reclamacion de facturas pendientes.
              Solo se muestran proveedores mapeados con email.
            </p>

            <div className="space-y-3">
              {vendorGroups
                .filter((g) => getSupplierForVendor(g.vendorName)?.email)
                .map((group) => {
                  const supplier = getSupplierForVendor(group.vendorName)!;
                  const isSent = sentClaims.has(group.vendorName);
                  const isSending = sendingClaim === group.vendorName;
                  const claimError = claimErrors[group.vendorName];

                  return (
                    <div
                      key={group.vendorName}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedVendors.has(group.vendorName)}
                          onChange={() => toggleVendorSelection(group.vendorName)}
                          disabled={isSent}
                          className="rounded border-zinc-300 text-brand focus:ring-brand-blue dark:border-zinc-600"
                        />
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-white">
                            {supplier.name}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {group.vendorName} — {group.transactions.length} movimiento(s) — {Math.abs(group.totalAmount).toFixed(2)}€
                          </p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500">
                            {supplier.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSent ? (
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            Enviado
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSendClaim(group)}
                            disabled={isSending}
                            className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                          >
                            {isSending ? "Enviando..." : "Enviar"}
                          </button>
                        )}
                        {claimError && (
                          <span className="text-xs text-red-500">{claimError}</span>
                        )}
                      </div>
                    </div>
                  );
                })}

              {vendorGroups.filter((g) => getSupplierForVendor(g.vendorName)?.email).length === 0 && (
                <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  No hay proveedores mapeados con email. Vuelve al paso anterior para mapear proveedores.
                </p>
              )}
            </div>
          </div>

          {/* Unmapped vendors notice */}
          {vendorGroups.filter((g) => !getSupplierForVendor(g.vendorName)).length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Proveedores sin mapear ({vendorGroups.filter((g) => !getSupplierForVendor(g.vendorName)).length}):
              </p>
              <ul className="mt-2 space-y-1 text-xs text-amber-600 dark:text-amber-500">
                {vendorGroups
                  .filter((g) => !getSupplierForVendor(g.vendorName))
                  .map((g) => (
                    <li key={g.vendorName}>
                      {g.vendorName} — {Math.abs(g.totalAmount).toFixed(2)}€
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={() => setView("review")}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Volver a revisar
            </button>
          </div>

          {/* Claim history */}
          {claimHistory.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="mb-3 font-semibold text-zinc-900 dark:text-white">
                Historial de reclamaciones
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                    <tr>
                      <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">Fecha</th>
                      <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">Proveedor</th>
                      <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">Email</th>
                      <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">Importe</th>
                      <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {claimHistory.map((claim) => (
                      <tr key={claim.id}>
                        <td className="px-3 py-2 text-zinc-900 dark:text-white">
                          {claim.created_at ? new Date(claim.created_at).toLocaleDateString("es-ES") : "—"}
                        </td>
                        <td className="px-3 py-2 text-zinc-900 dark:text-white">
                          {claim.suppliers?.name || "—"}
                        </td>
                        <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                          {claim.email_sent_to}
                        </td>
                        <td className="px-3 py-2 font-medium text-zinc-900 dark:text-white">
                          {Number(claim.total_amount).toFixed(2)}€
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge status={claim.status || "sent"} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="rounded-xl bg-white px-6 py-4 shadow-lg dark:bg-zinc-800">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Cargando...</p>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${
          accent
            ? "text-amber-600 dark:text-amber-400"
            : "text-zinc-900 dark:text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function VendorGroupCard({
  group,
  suppliers,
  currentMapping,
  onMappingChange,
}: {
  group: VendorGroup;
  suppliers: { id: string; name: string; email: string | null }[];
  currentMapping: string;
  onMappingChange: (supplierId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            <svg
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div>
            <p className="font-medium text-zinc-900 dark:text-white">{group.vendorName}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {group.transactions.length} movimiento(s)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-zinc-900 dark:text-white">
            {group.totalAmount.toFixed(2)}€
          </span>
          <select
            value={currentMapping}
            onChange={(e) => onMappingChange(e.target.value)}
            className="w-48 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            <option value="">— Sin mapear —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zinc-100 dark:border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">Fecha</th>
                <th className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">Descripcion</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">Importe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {group.transactions.map((t, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">{t.date}</td>
                  <td className="max-w-xs truncate px-4 py-2 text-zinc-500 dark:text-zinc-400">
                    {t.description}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-zinc-900 dark:text-white">
                    {t.amount.toFixed(2)}€
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    responded: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    resolved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };
  const labels: Record<string, string> = {
    sent: "Enviado",
    responded: "Respondido",
    resolved: "Resuelto",
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || styles.sent}`}>
      {labels[status] || status}
    </span>
  );
}
