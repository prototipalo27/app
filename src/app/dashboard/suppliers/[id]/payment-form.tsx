"use client";

import { useState } from "react";
import { addPayment, markInvoiceReceived, deletePayment } from "../actions";

interface Payment {
  id: string;
  payment_date: string;
  amount: number;
  description: string | null;
  has_invoice: boolean | null;
  invoice_number: string | null;
  invoice_date: string | null;
  notes: string | null;
}

export default function PaymentForm({
  supplierId,
  payments,
  supplierName,
  canManage = true,
}: {
  supplierId: string;
  payments: Payment[];
  supplierName: string;
  canManage?: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [invoiceNum, setInvoiceNum] = useState("");

  async function handleMarkInvoice(paymentId: string) {
    if (!invoiceNum.trim()) return;
    await markInvoiceReceived(paymentId, invoiceNum.trim());
    setMarkingId(null);
    setInvoiceNum("");
  }

  async function handleDelete(paymentId: string) {
    if (!confirm("Eliminar este pago?")) return;
    await deletePayment(paymentId, supplierId);
  }

  const totalPending = payments
    .filter((p) => !p.has_invoice)
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="mb-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
          Pagos
          {totalPending > 0 && (
            <span className="ml-2 text-sm font-normal text-amber-600 dark:text-amber-400">
              ({totalPending.toFixed(2)}&euro; sin factura)
            </span>
          )}
        </h2>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
          >
            {showForm ? "Cancelar" : "+ Añadir pago"}
          </button>
        )}
      </div>

      {/* Add payment form */}
      {showForm && (
        <form
          action={async (formData) => {
            await addPayment(formData);
            setShowForm(false);
          }}
          className="mb-4 space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50"
        >
          <input type="hidden" name="supplier_id" value={supplierId} />

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Fecha *
              </label>
              <input
                type="date"
                name="payment_date"
                required
                defaultValue={new Date().toISOString().split("T")[0]}
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Importe *
              </label>
              <div className="relative mt-1">
                <input
                  type="number"
                  name="amount"
                  required
                  step="0.01"
                  min="0"
                  className="block w-full rounded-lg border border-zinc-300 bg-white py-2 pr-3 pl-7 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-zinc-400">
                  &euro;
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Concepto
              </label>
              <input
                type="text"
                name="description"
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
                placeholder="Descripcion del gasto"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="has_invoice"
                name="has_invoice"
                className="h-4 w-4 rounded border-zinc-300 text-green-600 focus:ring-green-500 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <label
                htmlFor="has_invoice"
                className="text-sm text-zinc-700 dark:text-zinc-300"
              >
                Tiene factura
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                N.º Factura
              </label>
              <input
                type="text"
                name="invoice_number"
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Fecha factura
              </label>
              <input
                type="date"
                name="invoice_date"
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Notas
            </label>
            <input
              type="text"
              name="notes"
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Guardar pago
            </button>
          </div>
        </form>
      )}

      {/* Payments table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
            <tr>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                Fecha
              </th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                Importe
              </th>
              <th className="hidden px-4 py-3 font-medium text-zinc-700 md:table-cell dark:text-zinc-300">
                Concepto
              </th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                Factura
              </th>
              <th className="hidden px-4 py-3 font-medium text-zinc-700 md:table-cell dark:text-zinc-300">
                N.º Factura
              </th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {payments.length > 0 ? (
              payments.map((p) => (
                <tr
                  key={p.id}
                  className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                    !p.has_invoice
                      ? "bg-amber-50/50 dark:bg-amber-900/5"
                      : ""
                  }`}
                >
                  <td className="px-4 py-3 text-zinc-900 dark:text-white">
                    {p.payment_date}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">
                    {p.amount.toFixed(2)}&euro;
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-500 md:table-cell dark:text-zinc-400">
                    {p.description || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {p.has_invoice ? (
                      <svg
                        className="h-5 w-5 text-green-600 dark:text-green-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-5 w-5 text-red-500 dark:text-red-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-500 md:table-cell dark:text-zinc-400">
                    {p.invoice_number || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <div className="flex items-center gap-2">
                        {!p.has_invoice && (
                          <>
                            {markingId === p.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={invoiceNum}
                                  onChange={(e) => setInvoiceNum(e.target.value)}
                                  placeholder="N.º factura"
                                  className="w-28 rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleMarkInvoice(p.id)}
                                  className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                                >
                                  OK
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMarkingId(null);
                                    setInvoiceNum("");
                                  }}
                                  className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                                >
                                  X
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setMarkingId(p.id)}
                                className="rounded border border-green-300 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"
                              >
                                Marcar factura
                              </button>
                            )}
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id)}
                          className="text-xs text-red-500 hover:text-red-700 dark:text-red-400"
                        >
                          Eliminar
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400"
                >
                  No hay pagos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
