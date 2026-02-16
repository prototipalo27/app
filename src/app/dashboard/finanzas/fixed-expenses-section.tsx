"use client";

import { useState } from "react";
import { createFixedExpense, updateFixedExpense, deactivateFixedExpense } from "./actions";

interface FixedExpense {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  day_of_month: number | null;
  bank_vendor_name: string | null;
  notes: string | null;
}

const CATEGORIES: Record<string, string> = {
  rent: "Alquiler",
  utilities: "Suministros",
  insurance: "Seguros",
  software: "Software",
  telecom: "Telecomunicaciones",
  taxes: "Impuestos",
  other: "Otros",
};

const FREQUENCIES: Record<string, string> = {
  monthly: "Mensual",
  quarterly: "Trimestral",
  annual: "Anual",
};

function formatEur(n: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

export default function FixedExpensesSection({
  expenses: initialExpenses,
  matchMap,
}: {
  expenses: FixedExpense[];
  matchMap: Record<string, boolean>;
}) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    category: "other",
    amount: "",
    frequency: "monthly",
    day_of_month: "",
    bank_vendor_name: "",
    notes: "",
  });

  const resetForm = () => {
    setForm({ name: "", category: "other", amount: "", frequency: "monthly", day_of_month: "", bank_vendor_name: "", notes: "" });
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (e: FixedExpense) => {
    setForm({
      name: e.name,
      category: e.category,
      amount: String(e.amount),
      frequency: e.frequency,
      day_of_month: e.day_of_month ? String(e.day_of_month) : "",
      bank_vendor_name: e.bank_vendor_name ?? "",
      notes: e.notes ?? "",
    });
    setEditingId(e.id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    const actionData = {
      name: form.name,
      category: form.category,
      amount: parseFloat(form.amount),
      frequency: form.frequency,
      day_of_month: form.day_of_month ? parseInt(form.day_of_month) : undefined,
      bank_vendor_name: form.bank_vendor_name || undefined,
      notes: form.notes || undefined,
    };

    const result = editingId
      ? await updateFixedExpense(editingId, actionData)
      : await createFixedExpense(actionData);

    if (!result.success) {
      setError(result.error);
    } else {
      const localData: FixedExpense = {
        id: editingId ?? crypto.randomUUID(),
        name: actionData.name,
        category: actionData.category,
        amount: actionData.amount,
        frequency: actionData.frequency,
        day_of_month: actionData.day_of_month ?? null,
        bank_vendor_name: actionData.bank_vendor_name ?? null,
        notes: actionData.notes ?? null,
      };
      if (editingId) {
        setExpenses((prev) => prev.map((e) => (e.id === editingId ? localData : e)));
      } else {
        setExpenses((prev) => [...prev, localData]);
      }
      resetForm();
    }
    setLoading(false);
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("Desactivar este gasto fijo?")) return;
    const result = await deactivateFixedExpense(id);
    if (result.success) {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    }
  };

  const monthlyTotal = expenses.reduce((sum, e) => {
    if (e.frequency === "monthly") return sum + e.amount;
    if (e.frequency === "quarterly") return sum + e.amount / 3;
    if (e.frequency === "annual") return sum + e.amount / 12;
    return sum + e.amount;
  }, 0);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Gastos fijos</h2>
          <p className="text-xs text-zinc-400">Total mensual prorrateado: {formatEur(monthlyTotal)}</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark"
        >
          Anadir gasto
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="mb-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Nombre</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Categoria</label>
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
              <label className="mb-1 block text-xs text-zinc-500">Importe</label>
              <input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Frecuencia</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                {Object.entries(FREQUENCIES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
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
            <div className="col-span-2 lg:col-span-3">
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
              disabled={loading || !form.name || !form.amount}
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

      {/* Table */}
      {expenses.length === 0 ? (
        <p className="text-sm text-zinc-400">No hay gastos fijos configurados</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Estado</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Nombre</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Categoria</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">Importe</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Frecuencia</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2">
                    {e.bank_vendor_name ? (
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${
                          matchMap[e.id] ? "bg-green-500" : "bg-amber-400"
                        }`}
                        title={matchMap[e.id] ? "Encontrado en extracto" : "No encontrado en extracto"}
                      />
                    ) : (
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600" title="Sin nombre BBVA configurado" />
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium text-zinc-900 dark:text-white">{e.name}</td>
                  <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">{CATEGORIES[e.category] ?? e.category}</td>
                  <td className="px-3 py-2 text-right font-medium text-zinc-900 dark:text-white">{formatEur(e.amount)}</td>
                  <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">{FREQUENCIES[e.frequency] ?? e.frequency}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => startEdit(e)}
                      className="mr-2 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeactivate(e.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Desactivar
                    </button>
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
