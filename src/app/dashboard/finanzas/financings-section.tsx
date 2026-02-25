"use client";

import { useState } from "react";
import { createFinancing, updateFinancing, deactivateFinancing } from "./actions";

interface Financing {
  id: string;
  name: string;
  category: string;
  total_amount: number;
  monthly_payment: number;
  total_installments: number;
  paid_installments: number;
  interest_rate: number | null;
  start_date: string;
  end_date: string;
  bank_vendor_name: string | null;
  notes: string | null;
}

const CATEGORIES: Record<string, string> = {
  leasing: "Leasing",
  loan: "Prestamo",
  renting: "Renting",
  credit_line: "Linea de credito",
  other: "Otros",
};

function formatEur(n: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

export default function FinancingsSection({
  financings: initial,
}: {
  financings: Financing[];
}) {
  const [financings, setFinancings] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    category: "leasing",
    total_amount: "",
    monthly_payment: "",
    total_installments: "",
    paid_installments: "0",
    interest_rate: "",
    start_date: "",
    end_date: "",
    bank_vendor_name: "",
    notes: "",
  });

  const resetForm = () => {
    setForm({ name: "", category: "leasing", total_amount: "", monthly_payment: "", total_installments: "", paid_installments: "0", interest_rate: "", start_date: "", end_date: "", bank_vendor_name: "", notes: "" });
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (f: Financing) => {
    setForm({
      name: f.name,
      category: f.category,
      total_amount: String(f.total_amount),
      monthly_payment: String(f.monthly_payment),
      total_installments: String(f.total_installments),
      paid_installments: String(f.paid_installments),
      interest_rate: f.interest_rate ? String(f.interest_rate) : "",
      start_date: f.start_date,
      end_date: f.end_date,
      bank_vendor_name: f.bank_vendor_name ?? "",
      notes: f.notes ?? "",
    });
    setEditingId(f.id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    const data = {
      name: form.name,
      category: form.category,
      total_amount: parseFloat(form.total_amount),
      monthly_payment: parseFloat(form.monthly_payment),
      total_installments: parseInt(form.total_installments),
      paid_installments: parseInt(form.paid_installments) || 0,
      interest_rate: form.interest_rate ? parseFloat(form.interest_rate) : undefined,
      start_date: form.start_date,
      end_date: form.end_date,
      bank_vendor_name: form.bank_vendor_name || undefined,
      notes: form.notes || undefined,
    };

    const result = editingId
      ? await updateFinancing(editingId, data)
      : await createFinancing(data);

    if (!result.success) {
      setError(result.error);
    } else {
      const local: Financing = {
        id: editingId ?? crypto.randomUUID(),
        ...data,
        paid_installments: data.paid_installments,
        interest_rate: data.interest_rate ?? null,
        bank_vendor_name: data.bank_vendor_name ?? null,
        notes: data.notes ?? null,
      };
      if (editingId) {
        setFinancings((prev) => prev.map((f) => (f.id === editingId ? local : f)));
      } else {
        setFinancings((prev) => [...prev, local]);
      }
      resetForm();
    }
    setLoading(false);
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("Desactivar esta financiacion?")) return;
    const result = await deactivateFinancing(id);
    if (result.success) {
      setFinancings((prev) => prev.filter((f) => f.id !== id));
    }
  };

  const totalMonthlyPayments = financings.reduce((sum, f) => sum + f.monthly_payment, 0);
  const totalPendingCapital = financings.reduce((sum, f) => {
    const remaining = f.total_installments - f.paid_installments;
    return sum + remaining * f.monthly_payment;
  }, 0);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Financiaciones</h2>
          <p className="text-xs text-zinc-400">
            Cuota mensual total: {formatEur(totalMonthlyPayments)} · Pendiente: {formatEur(totalPendingCapital)}
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark"
        >
          Anadir financiacion
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Nombre</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Leasing Bambu Lab P1S"
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Tipo</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Importe total</label>
              <input
                type="number"
                step="0.01"
                value={form.total_amount}
                onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Cuota mensual</label>
              <input
                type="number"
                step="0.01"
                value={form.monthly_payment}
                onChange={(e) => setForm({ ...form, monthly_payment: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Total cuotas</label>
              <input
                type="number"
                value={form.total_installments}
                onChange={(e) => setForm({ ...form, total_installments: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Cuotas pagadas</label>
              <input
                type="number"
                value={form.paid_installments}
                onChange={(e) => setForm({ ...form, paid_installments: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Fecha inicio</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Fecha fin</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Interes (%)</label>
              <input
                type="number"
                step="0.01"
                value={form.interest_rate}
                onChange={(e) => setForm({ ...form, interest_rate: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Nombre en BBVA</label>
              <input
                value={form.bank_vendor_name}
                onChange={(e) => setForm({ ...form, bank_vendor_name: e.target.value })}
                placeholder="Para cruzar con extracto"
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs text-zinc-500">Notas</label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={loading || !form.name || !form.total_amount || !form.monthly_payment || !form.total_installments || !form.start_date || !form.end_date}
              className="rounded-lg bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {loading ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
            </button>
            <button
              onClick={resetForm}
              className="rounded-lg border border-zinc-300 px-4 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {financings.length === 0 ? (
        <p className="text-sm text-zinc-400">No hay financiaciones configuradas</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Nombre</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Tipo</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">Total</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">Cuota</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-zinc-500">Progreso</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Periodo</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {financings.map((f) => {
                const pct = Math.round((f.paid_installments / f.total_installments) * 100);
                const remaining = f.total_installments - f.paid_installments;

                return (
                  <tr key={f.id}>
                    <td className="px-3 py-2 font-medium text-zinc-900 dark:text-white">{f.name}</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">{CATEGORIES[f.category] ?? f.category}</td>
                    <td className="px-3 py-2 text-right font-medium text-zinc-900 dark:text-white">{formatEur(f.total_amount)}</td>
                    <td className="px-3 py-2 text-right text-zinc-700 dark:text-zinc-300">{formatEur(f.monthly_payment)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-zinc-200 dark:bg-zinc-700">
                          <div
                            className="h-1.5 rounded-full bg-green-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                          {f.paid_installments}/{f.total_installments} ({remaining} rest.)
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(f.start_date).toLocaleDateString("es-ES", { month: "short", year: "2-digit" })}
                      {" → "}
                      {new Date(f.end_date).toLocaleDateString("es-ES", { month: "short", year: "2-digit" })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => startEdit(f)}
                        className="mr-2 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeactivate(f.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Desactivar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
