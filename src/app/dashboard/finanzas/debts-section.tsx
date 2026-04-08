"use client";

import { useState } from "react";
import { createDebt, updateDebt, deleteDebt } from "./actions";

interface Debt {
  id: string;
  creditor: string;
  description: string | null;
  total_amount: number;
  paid_amount: number;
  is_paid: boolean;
  due_date: string | null;
  notes: string | null;
}

function formatEur(n: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

export default function DebtsSection({ debts: initial }: { debts: Debt[] }) {
  const [debts, setDebts] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    creditor: "",
    description: "",
    total_amount: "",
    paid_amount: "0",
    due_date: "",
    notes: "",
  });

  const resetForm = () => {
    setForm({ creditor: "", description: "", total_amount: "", paid_amount: "0", due_date: "", notes: "" });
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (d: Debt) => {
    setForm({
      creditor: d.creditor,
      description: d.description ?? "",
      total_amount: String(d.total_amount),
      paid_amount: String(d.paid_amount),
      due_date: d.due_date ?? "",
      notes: d.notes ?? "",
    });
    setEditingId(d.id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    const data = {
      creditor: form.creditor,
      description: form.description || undefined,
      total_amount: parseFloat(form.total_amount),
      paid_amount: parseFloat(form.paid_amount) || 0,
      due_date: form.due_date || undefined,
      notes: form.notes || undefined,
    };

    const result = editingId
      ? await updateDebt(editingId, data)
      : await createDebt(data);

    if (!result.success) {
      setError(result.error);
    } else {
      const local: Debt = {
        id: editingId ?? crypto.randomUUID(),
        creditor: data.creditor,
        description: data.description ?? null,
        total_amount: data.total_amount,
        paid_amount: data.paid_amount,
        is_paid: data.paid_amount >= data.total_amount,
        due_date: data.due_date ?? null,
        notes: data.notes ?? null,
      };
      if (editingId) {
        setDebts((prev) => prev.map((d) => (d.id === editingId ? local : d)));
      } else {
        setDebts((prev) => [...prev, local]);
      }
      resetForm();
    }
    setLoading(false);
  };

  const togglePaid = async (d: Debt) => {
    const newPaid = !d.is_paid;
    const newPaidAmount = newPaid ? d.total_amount : 0;

    setDebts((prev) =>
      prev.map((x) =>
        x.id === d.id ? { ...x, is_paid: newPaid, paid_amount: newPaidAmount } : x
      )
    );

    await updateDebt(d.id, { is_paid: newPaid, paid_amount: newPaidAmount });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminar esta deuda?")) return;
    const result = await deleteDebt(id);
    if (result.success) {
      setDebts((prev) => prev.filter((d) => d.id !== id));
    }
  };

  const pending = debts.filter((d) => !d.is_paid);
  const paid = debts.filter((d) => d.is_paid);
  const totalPending = pending.reduce((s, d) => s + (d.total_amount - d.paid_amount), 0);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Deudas</h2>
          {pending.length > 0 && (
            <p className="text-xs text-red-500">
              Pendiente total: {formatEur(totalPending)}
            </p>
          )}
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark"
        >
          Anadir deuda
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Acreedor</label>
              <input
                value={form.creditor}
                onChange={(e) => setForm({ ...form, creditor: e.target.value })}
                placeholder="Ej: BBVA, Familiar, Proveedor..."
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Descripcion</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Concepto de la deuda"
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
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
              <label className="mb-1 block text-xs text-zinc-500">Ya pagado</label>
              <input
                type="number"
                step="0.01"
                value={form.paid_amount}
                onChange={(e) => setForm({ ...form, paid_amount: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Fecha limite</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div>
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
              disabled={loading || !form.creditor || !form.total_amount}
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

      {debts.length === 0 ? (
        <p className="text-sm text-zinc-400">No hay deudas registradas</p>
      ) : (
        <div className="space-y-2">
          {/* Pending debts */}
          {pending.map((d) => {
            const remaining = d.total_amount - d.paid_amount;
            const pct = d.total_amount > 0 ? Math.round((d.paid_amount / d.total_amount) * 100) : 0;
            const isOverdue = d.due_date && new Date(d.due_date) < new Date();

            return (
              <div
                key={d.id}
                className="flex items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800"
              >
                <button
                  onClick={() => togglePaid(d)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-zinc-300 hover:border-green-500 dark:border-zinc-600 dark:hover:border-green-500"
                >
                  {/* empty checkbox */}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">{d.creditor}</span>
                    {d.description && (
                      <span className="truncate text-xs text-zinc-400">{d.description}</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-xs font-semibold text-red-500">{formatEur(remaining)} pendiente</span>
                    {d.paid_amount > 0 && (
                      <div className="flex items-center gap-1.5">
                        <div className="h-1 w-16 rounded-full bg-zinc-200 dark:bg-zinc-700">
                          <div className="h-1 rounded-full bg-green-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-zinc-400">{pct}%</span>
                      </div>
                    )}
                    {d.due_date && (
                      <span className={`text-[10px] ${isOverdue ? "font-medium text-red-500" : "text-zinc-400"}`}>
                        {isOverdue ? "Vencida: " : "Vence: "}
                        {new Date(d.due_date).toLocaleDateString("es-ES")}
                      </span>
                    )}
                  </div>
                  {d.notes && <p className="mt-0.5 text-[10px] text-zinc-400">{d.notes}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-right">
                  <span className="text-sm font-bold text-zinc-900 dark:text-white">{formatEur(d.total_amount)}</span>
                  <button
                    onClick={() => startEdit(d)}
                    className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })}

          {/* Paid debts */}
          {paid.length > 0 && (
            <>
              <div className="pt-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                  Pagadas ({paid.length})
                </p>
              </div>
              {paid.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/50"
                >
                  <button
                    onClick={() => togglePaid(d)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-green-500 bg-green-500 text-white"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-zinc-500 line-through">{d.creditor}</span>
                    {d.description && (
                      <span className="ml-2 text-xs text-zinc-400 line-through">{d.description}</span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm text-zinc-400 line-through">{formatEur(d.total_amount)}</span>
                    <button
                      onClick={() => handleDelete(d.id)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
