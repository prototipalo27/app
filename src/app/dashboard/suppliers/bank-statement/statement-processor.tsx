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

interface Props {
  suppliers: Supplier[];
  vendorMappings: VendorMapping[];
  claimHistory: ClaimHistoryItem[];
}

type Step = "upload" | "review" | "claims";

export default function StatementProcessor({
  suppliers,
  vendorMappings,
  claimHistory,
}: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [filterPending, setFilterPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Vendor mapping state: vendorName → supplierId
  const [mappings, setMappings] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    vendorMappings.forEach((vm) => {
      if (vm.supplier_id) m[vm.bank_vendor_name] = vm.supplier_id;
    });
    return m;
  });

  // Selected vendors for claims
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
  const [sendingClaim, setSendingClaim] = useState<string | null>(null);
  const [sentClaims, setSentClaims] = useState<Set<string>>(new Set());
  const [claimErrors, setClaimErrors] = useState<Record<string, string>>({});

  // Filter and group transactions
  const displayedTransactions = useMemo(() => {
    if (!filterPending) return transactions;
    return transactions.filter(
      (t) =>
        t.status.toLowerCase().includes("pendiente") ||
        t.status === ""
    );
  }, [transactions, filterPending]);

  const vendorGroups = useMemo(
    () => groupByVendor(displayedTransactions),
    [displayedTransactions]
  );

  // Stats
  const totalTransactions = transactions.length;
  const pendingCount = transactions.filter(
    (t) => t.status.toLowerCase().includes("pendiente") || t.status === ""
  ).length;

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);
      setLoading(true);

      try {
        const buffer = await file.arrayBuffer();
        const parsed = parseBBVAStatement(buffer);
        setTransactions(parsed);
        setStep("review");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error al procesar el archivo"
        );
      } finally {
        setLoading(false);
      }
    },
    []
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
        .map(([bankVendorName, supplierId]) => ({
          bankVendorName,
          supplierId,
        }));
      if (batch.length > 0) {
        await saveVendorMappingsBatch(batch);
      }
      setStep("claims");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar mapeos");
    } finally {
      setLoading(false);
    }
  }, [mappings]);

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
          [group.vendorName]:
            err instanceof Error ? err.message : "Error al enviar",
        }));
      } finally {
        setSendingClaim(null);
      }
    },
    [mappings, suppliers]
  );

  // Supplier lookup helper
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
      {/* Step indicators */}
      <div className="flex items-center gap-2 text-sm">
        <StepBadge
          n={1}
          label="Subir extracto"
          active={step === "upload"}
          done={step !== "upload"}
        />
        <ChevronRight />
        <StepBadge
          n={2}
          label="Revisar y mapear"
          active={step === "review"}
          done={step === "claims"}
        />
        <ChevronRight />
        <StepBadge n={3} label="Reclamaciones" active={step === "claims"} done={false} />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* STEP 1: Upload */}
      {step === "upload" && (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-full bg-zinc-100 p-4 dark:bg-zinc-800">
              <svg className="h-8 w-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Sube el extracto BBVA
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Formato .xlsx descargado desde BBVA Net
              </p>
            </div>
            <label className="cursor-pointer rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700">
              {loading ? "Procesando..." : "Seleccionar archivo"}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                disabled={loading}
              />
            </label>
          </div>
        </div>
      )}

      {/* STEP 2: Review & Map */}
      {step === "review" && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              label="Movimientos totales"
              value={totalTransactions}
            />
            <StatCard
              label="Pendientes"
              value={pendingCount}
              accent
            />
            <StatCard
              label="Proveedores"
              value={vendorGroups.length}
            />
          </div>

          {/* Filter toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={filterPending}
                onChange={(e) => setFilterPending(e.target.checked)}
                className="rounded border-zinc-300 text-green-600 focus:ring-green-500 dark:border-zinc-600"
              />
              Solo movimientos pendientes
            </label>
            <button
              onClick={() => {
                setTransactions([]);
                setStep("upload");
              }}
              className="ml-auto text-sm text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Subir otro extracto
            </button>
          </div>

          {/* Vendor groups */}
          <div className="space-y-4">
            {vendorGroups.map((group) => (
              <VendorGroupCard
                key={group.vendorName}
                group={group}
                suppliers={suppliers}
                currentMapping={mappings[group.vendorName] || ""}
                onMappingChange={(sid) =>
                  handleMappingChange(group.vendorName, sid)
                }
              />
            ))}
          </div>

          {/* Save & continue */}
          <div className="flex justify-end gap-3">
            <button
              onClick={handleSaveMappings}
              disabled={loading}
              className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar mapeos y continuar"}
            </button>
          </div>
        </>
      )}

      {/* STEP 3: Claims */}
      {step === "claims" && (
        <>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
              Enviar reclamaciones por email
            </h2>
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              Selecciona los proveedores a los que quieres enviar una reclamacion de facturas pendientes.
              Solo se muestran proveedores mapeados con email.
            </p>

            <div className="space-y-3">
              {vendorGroups
                .filter((g) => {
                  const supplier = getSupplierForVendor(g.vendorName);
                  return supplier?.email;
                })
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
                          onChange={() =>
                            toggleVendorSelection(group.vendorName)
                          }
                          disabled={isSent}
                          className="rounded border-zinc-300 text-green-600 focus:ring-green-500 dark:border-zinc-600"
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
                          <span className="text-xs text-red-500">
                            {claimError}
                          </span>
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
              onClick={() => setStep("review")}
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
                          {new Date(claim.created_at).toLocaleDateString("es-ES")}
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
                          <StatusBadge status={claim.status} />
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
    </div>
  );
}

// --- Sub-components ---

function StepBadge({
  n,
  label,
  active,
  done,
}: {
  n: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
        active
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : done
            ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            : "text-zinc-400 dark:text-zinc-600"
      }`}
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
          active
            ? "bg-green-600 text-white"
            : done
              ? "bg-zinc-400 text-white dark:bg-zinc-600"
              : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-500"
        }`}
      >
        {done ? "✓" : n}
      </span>
      {label}
    </div>
  );
}

function ChevronRight() {
  return (
    <svg className="h-4 w-4 text-zinc-300 dark:text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

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
  suppliers: Supplier[];
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
            <p className="font-medium text-zinc-900 dark:text-white">
              {group.vendorName}
            </p>
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
            className="w-48 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
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
