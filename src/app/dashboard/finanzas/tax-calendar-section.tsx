"use client";

import { useState } from "react";
import {
  updateTaxPayment,
  ensureTaxCalendar,
  createTaxInstallment,
  updateTaxInstallment,
  deleteTaxInstallment,
  splitTaxIntoInstallments,
} from "./actions";
import { getModelName, isTaxDeferrable } from "@/lib/finance/tax-calendar";

interface TaxInstallment {
  id: string;
  tax_payment_id: string;
  numero_plazo: number;
  fecha_vencimiento: string;
  importe: number;
  pagado: boolean;
  fecha_pago: string | null;
  referencia: string | null;
  notes: string | null;
}

interface TaxPayment {
  id: string;
  model: string;
  period: string;
  amount: number | null;
  status: string;
  situacion: string;
  clave_liquidacion: string | null;
  concepto: string | null;
  due_date: string;
  paid_date: string | null;
  notes: string | null;
  installments?: TaxInstallment[] | null;
}

const MODEL_COLORS: Record<string, string> = {
  "303": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "130": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "200": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  "111": "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  "115": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "349": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
};

const SITUACION_COLORS: Record<string, string> = {
  pendiente: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  presentado: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  voluntario: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  aplazada: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  fraccionada: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  pagado: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const SITUACION_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  presentado: "Presentado",
  voluntario: "Voluntario",
  aplazada: "Aplazada",
  fraccionada: "Fraccionada",
  pagado: "Pagado",
};

function formatEur(n: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatShortDate(d: string) {
  return new Date(d).toLocaleDateString("es-ES");
}

export default function TaxCalendarSection({
  taxPayments: initialPayments,
}: {
  taxPayments: TaxPayment[];
}) {
  const [payments, setPayments] = useState(initialPayments);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const now = new Date();
  const currentYear = now.getFullYear();

  const years = [...new Set(payments.map((p) => {
    const match = p.period.match(/^(\d{4})/);
    return match ? parseInt(match[1]) : currentYear;
  }))].sort((a, b) => b - a);

  const selected = payments.find((p) => p.id === selectedId) ?? null;

  const handleEnsureYear = async (year: number) => {
    setLoading(true);
    await ensureTaxCalendar(year);
    setLoading(false);
  };

  const updateLocal = (id: string, patch: Partial<TaxPayment>) => {
    setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const updateInstallmentLocal = (
    taxId: string,
    installmentId: string,
    patch: Partial<TaxInstallment>
  ) => {
    setPayments((prev) =>
      prev.map((p) =>
        p.id === taxId
          ? {
              ...p,
              installments: (p.installments ?? []).map((i) =>
                i.id === installmentId ? { ...i, ...patch } : i
              ),
            }
          : p
      )
    );
  };

  const removeInstallmentLocal = (taxId: string, installmentId: string) => {
    setPayments((prev) =>
      prev.map((p) =>
        p.id === taxId
          ? {
              ...p,
              installments: (p.installments ?? []).filter((i) => i.id !== installmentId),
            }
          : p
      )
    );
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Calendario fiscal</h2>
        <button
          onClick={() => handleEnsureYear(currentYear + 1)}
          disabled={loading}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Generar {currentYear + 1}
        </button>
      </div>

      {years.map((year) => {
        const yearPayments = payments
          .filter((p) => p.period.startsWith(String(year)))
          .sort((a, b) => a.due_date.localeCompare(b.due_date));

        if (yearPayments.length === 0) return null;

        const quarters = ["Q1", "Q2", "Q3", "Q4"];

        return (
          <div key={year} className="mb-6 last:mb-0">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">{year}</h3>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {quarters.map((q) => {
                const qPayments = yearPayments.filter((p) => p.period.includes(q));
                const annualPayment = yearPayments.find((p) => p.period === String(year) && p.model === "200");
                const allInQ = q === "Q3" && annualPayment ? [...qPayments, annualPayment] : qPayments;

                if (allInQ.length === 0) return <div key={q} />;

                return (
                  <div key={q} className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                    <p className="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">{q}</p>
                    <div className="space-y-2">
                      {allInQ.map((p) => {
                        const dueDate = new Date(p.due_date);
                        const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                        const isPast = daysLeft < 0;
                        const situacion = p.situacion ?? "pendiente";
                        const isSelected = selectedId === p.id;
                        const pendingImporte =
                          (p.installments ?? []).filter((i) => !i.pagado).reduce((s, i) => s + Number(i.importe), 0);

                        return (
                          <button
                            key={p.id}
                            onClick={() => setSelectedId(isSelected ? null : p.id)}
                            className={`flex w-full items-center justify-between rounded-md p-1.5 text-left transition ${
                              isSelected
                                ? "bg-zinc-100 dark:bg-zinc-800"
                                : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${MODEL_COLORS[p.model] ?? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                                {p.model}
                              </span>
                              <div>
                                <p className="text-xs font-medium text-zinc-900 dark:text-white">
                                  {getModelName(p.model).split(" ")[0]}
                                </p>
                                <p className="text-[10px] text-zinc-400">
                                  {dueDate.toLocaleDateString("es-ES")}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-0.5">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  SITUACION_COLORS[situacion]
                                } ${isPast && situacion === "pendiente" ? "ring-1 ring-red-400" : ""}`}
                              >
                                {SITUACION_LABELS[situacion] ?? situacion}
                              </span>
                              {(situacion === "aplazada" || situacion === "fraccionada") && pendingImporte > 0 && (
                                <span className="text-[10px] text-zinc-400">
                                  {formatEur(pendingImporte)}
                                </span>
                              )}
                              {situacion === "pagado" && p.amount != null && (
                                <span className="text-[10px] text-zinc-400">{formatEur(p.amount)}</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {selected && (
        <TaxDetailPanel
          tax={selected}
          onClose={() => setSelectedId(null)}
          onUpdate={(patch) => updateLocal(selected.id, patch)}
          onUpdateInstallment={(instId, patch) => updateInstallmentLocal(selected.id, instId, patch)}
          onRemoveInstallment={(instId) => removeInstallmentLocal(selected.id, instId)}
          onAddInstallment={(inst) =>
            setPayments((prev) =>
              prev.map((p) =>
                p.id === selected.id
                  ? { ...p, installments: [...(p.installments ?? []), inst] }
                  : p
              )
            )
          }
          onReplaceInstallments={(installments) =>
            updateLocal(selected.id, { installments })
          }
        />
      )}
    </div>
  );
}

function TaxDetailPanel({
  tax,
  onClose,
  onUpdate,
  onUpdateInstallment,
  onRemoveInstallment,
  onAddInstallment,
  onReplaceInstallments,
}: {
  tax: TaxPayment;
  onClose: () => void;
  onUpdate: (patch: Partial<TaxPayment>) => void;
  onUpdateInstallment: (id: string, patch: Partial<TaxInstallment>) => void;
  onRemoveInstallment: (id: string) => void;
  onAddInstallment: (inst: TaxInstallment) => void;
  onReplaceInstallments: (installments: TaxInstallment[]) => void;
}) {
  const [clave, setClave] = useState(tax.clave_liquidacion ?? "");
  const [concepto, setConcepto] = useState(tax.concepto ?? "");
  const [importe, setImporte] = useState(tax.amount != null ? String(tax.amount) : "");
  const [situacion, setSituacion] = useState(tax.situacion ?? "pendiente");
  const [notes, setNotes] = useState(tax.notes ?? "");
  const [paidDate, setPaidDate] = useState(tax.paid_date ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const installments = (tax.installments ?? []).slice().sort((a, b) => a.numero_plazo - b.numero_plazo);
  const deferrable = isTaxDeferrable(tax.model);
  const showInstallments =
    deferrable && (situacion === "aplazada" || situacion === "fraccionada" || installments.length > 0);

  const [splitOpen, setSplitOpen] = useState(false);
  const [splitNum, setSplitNum] = useState("6");
  const [splitFirstDate, setSplitFirstDate] = useState(tax.due_date);
  const [splitMode, setSplitMode] = useState<"aplazada" | "fraccionada">(
    situacion === "aplazada" ? "aplazada" : "fraccionada"
  );

  const handleSaveMeta = async () => {
    setSaving(true);
    setError(null);
    const result = await updateTaxPayment(tax.id, {
      clave_liquidacion: clave || null,
      concepto: concepto || null,
      amount: importe ? parseFloat(importe) : null,
      situacion,
      notes: notes || null,
      paid_date: situacion === "pagado" ? paidDate || new Date().toISOString().split("T")[0] : null,
      status: situacion === "pagado" ? "paid" : "pending",
    });
    if (!result.success) {
      setError(result.error);
    } else {
      onUpdate({
        clave_liquidacion: clave || null,
        concepto: concepto || null,
        amount: importe ? parseFloat(importe) : null,
        situacion,
        notes: notes || null,
        paid_date: situacion === "pagado" ? paidDate || new Date().toISOString().split("T")[0] : null,
        status: situacion === "pagado" ? "paid" : "pending",
      });
    }
    setSaving(false);
  };

  const handleSplit = async () => {
    if (!importe) {
      setError("Introduce primero el importe total");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await splitTaxIntoInstallments(tax.id, {
      total_amount: parseFloat(importe),
      num_installments: parseInt(splitNum),
      first_due_date: splitFirstDate,
      situacion: splitMode,
    });
    if (!result.success) {
      setError(result.error);
      setSaving(false);
      return;
    }
    onReplaceInstallments((result.data as TaxInstallment[]) ?? []);
    onUpdate({ situacion: splitMode, amount: parseFloat(importe) });
    setSituacion(splitMode);
    setSplitOpen(false);
    setSaving(false);
  };

  const handleToggleInstallmentPaid = async (inst: TaxInstallment) => {
    const pagado = !inst.pagado;
    const patch = {
      pagado,
      fecha_pago: pagado ? new Date().toISOString().split("T")[0] : null,
    };
    const result = await updateTaxInstallment(inst.id, patch);
    if (result.success) onUpdateInstallment(inst.id, patch);
  };

  const handleDeleteInstallment = async (inst: TaxInstallment) => {
    if (!confirm(`Eliminar plazo ${inst.numero_plazo}?`)) return;
    const result = await deleteTaxInstallment(inst.id);
    if (result.success) onRemoveInstallment(inst.id);
  };

  const handleAddInstallment = async () => {
    const nextNum =
      installments.length > 0 ? Math.max(...installments.map((i) => i.numero_plazo)) + 1 : 1;
    const result = await createTaxInstallment({
      tax_payment_id: tax.id,
      numero_plazo: nextNum,
      fecha_vencimiento: new Date().toISOString().split("T")[0],
      importe: 0,
    });
    if (result.success && result.data) {
      onAddInstallment(result.data as TaxInstallment);
    }
  };

  const totalInstallments = installments.reduce((s, i) => s + Number(i.importe), 0);
  const pagadoInstallments = installments
    .filter((i) => i.pagado)
    .reduce((s, i) => s + Number(i.importe), 0);

  return (
    <div className="mt-6 rounded-xl border border-zinc-300 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-950">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
            {getModelName(tax.model)} — {tax.period}
          </h3>
          <p className="text-xs text-zinc-400">
            Vence {formatShortDate(tax.due_date)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          Cerrar
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Metadata */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Clave de liquidacion</label>
          <input
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            placeholder="A28612..."
            className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-mono dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Concepto</label>
          <input
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder="303-I.V.A. EJER:2025 PER:4T"
            className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Importe total</label>
          <input
            type="number"
            step="0.01"
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">
            Situacion
            {!deferrable && (
              <span className="ml-1 text-[10px] text-zinc-400">(no aplazable)</span>
            )}
          </label>
          <select
            value={situacion}
            onChange={(e) => setSituacion(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            {Object.entries(SITUACION_LABELS)
              .filter(([k]) => deferrable || (k !== "aplazada" && k !== "fraccionada"))
              .map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
          </select>
        </div>
        {situacion === "pagado" && (
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Fecha pago</label>
            <input
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
        )}
        <div className="md:col-span-2 lg:col-span-3">
          <label className="mb-1 block text-xs text-zinc-500">Notas</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={handleSaveMeta}
          disabled={saving}
          className="rounded-lg bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>

      {/* Installments */}
      {showInstallments && (
        <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">Plazos</h4>
              {installments.length > 0 && (
                <p className="text-xs text-zinc-400">
                  Pagado {formatEur(pagadoInstallments)} / {formatEur(totalInstallments)}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSplitOpen(!splitOpen)}
                className="rounded-lg border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Generar plazos
              </button>
              <button
                onClick={handleAddInstallment}
                className="rounded-lg border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Anadir plazo
              </button>
            </div>
          </div>

          {splitOpen && (
            <div className="mb-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="mb-2 text-xs text-zinc-500">
                Divide el importe total en N plazos mensuales desde una fecha. Borra los plazos existentes.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Numero de plazos</label>
                  <input
                    type="number"
                    value={splitNum}
                    onChange={(e) => setSplitNum(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Fecha primer plazo</label>
                  <input
                    type="date"
                    value={splitFirstDate}
                    onChange={(e) => setSplitFirstDate(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Modo</label>
                  <select
                    value={splitMode}
                    onChange={(e) => setSplitMode(e.target.value as "aplazada" | "fraccionada")}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  >
                    <option value="aplazada">Aplazada</option>
                    <option value="fraccionada">Fraccionada</option>
                  </select>
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleSplit}
                  disabled={saving}
                  className="rounded-lg bg-brand px-3 py-1 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
                >
                  Generar
                </button>
                <button
                  onClick={() => setSplitOpen(false)}
                  className="rounded-lg border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {installments.length === 0 ? (
            <p className="text-sm text-zinc-400">Sin plazos configurados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="px-2 py-2 text-left text-xs font-medium text-zinc-500">#</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-zinc-500">Vencimiento</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-zinc-500">Importe</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-zinc-500">Referencia</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-zinc-500">Estado</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-zinc-500">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {installments.map((inst) => (
                    <InstallmentRow
                      key={inst.id}
                      installment={inst}
                      onChange={(patch) => onUpdateInstallment(inst.id, patch)}
                      onTogglePaid={() => handleToggleInstallmentPaid(inst)}
                      onDelete={() => handleDeleteInstallment(inst)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InstallmentRow({
  installment,
  onChange,
  onTogglePaid,
  onDelete,
}: {
  installment: TaxInstallment;
  onChange: (patch: Partial<TaxInstallment>) => void;
  onTogglePaid: () => void;
  onDelete: () => void;
}) {
  const [localImporte, setLocalImporte] = useState(String(installment.importe));
  const [localFecha, setLocalFecha] = useState(installment.fecha_vencimiento);
  const [localRef, setLocalRef] = useState(installment.referencia ?? "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSaveRow = async () => {
    setSaving(true);
    const patch = {
      importe: parseFloat(localImporte),
      fecha_vencimiento: localFecha,
      referencia: localRef || null,
    };
    const result = await updateTaxInstallment(installment.id, patch);
    if (result.success) {
      onChange(patch);
      setDirty(false);
    }
    setSaving(false);
  };

  return (
    <tr>
      <td className="px-2 py-2 text-zinc-500">{installment.numero_plazo}</td>
      <td className="px-2 py-2">
        <input
          type="date"
          value={localFecha}
          onChange={(e) => {
            setLocalFecha(e.target.value);
            setDirty(true);
          }}
          className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
        />
      </td>
      <td className="px-2 py-2 text-right">
        <input
          type="number"
          step="0.01"
          value={localImporte}
          onChange={(e) => {
            setLocalImporte(e.target.value);
            setDirty(true);
          }}
          className="w-24 rounded border border-zinc-300 px-2 py-0.5 text-right text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={localRef}
          onChange={(e) => {
            setLocalRef(e.target.value);
            setDirty(true);
          }}
          placeholder="—"
          className="w-full rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
        />
      </td>
      <td className="px-2 py-2 text-center">
        <button
          onClick={onTogglePaid}
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            installment.pagado
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
          title={installment.fecha_pago ?? ""}
        >
          {installment.pagado ? "Pagado" : "Pendiente"}
        </button>
      </td>
      <td className="px-2 py-2 text-right">
        {dirty && (
          <button
            onClick={handleSaveRow}
            disabled={saving}
            className="mr-2 text-xs text-brand hover:underline disabled:opacity-50"
          >
            {saving ? "..." : "Guardar"}
          </button>
        )}
        <button
          onClick={onDelete}
          className="text-xs text-red-500 hover:text-red-700"
        >
          Eliminar
        </button>
      </td>
    </tr>
  );
}
