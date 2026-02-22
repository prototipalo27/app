"use client";

import { useState } from "react";
import {
  addPurchaseItem,
  markAsPurchased,
  rejectItem,
  markAsReceived,
  deletePurchaseItem,
} from "./actions";

interface PurchaseItem {
  id: string;
  description: string;
  link: string | null;
  quantity: number | null;
  estimated_price: number | null;
  actual_price: number | null;
  status: string | null;
  created_by: string | null;
  created_at: string | null;
  purchased_at: string | null;
  received_at: string | null;
  estimated_delivery: string | null;
  rejection_reason: string | null;
  project_id: string | null;
  creator_name: string;
  project_name: string | null;
}

interface Project {
  id: string;
  name: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  purchased: "Comprado",
  received: "Recibido",
  rejected: "Rechazado",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  purchased:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  received:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

type ActivePrompt =
  | { type: "purchase"; itemId: string }
  | { type: "reject"; itemId: string }
  | null;

export default function PurchaseItemsView({
  items,
  projects,
  isManager,
  userId,
}: {
  items: PurchaseItem[];
  projects: Project[];
  isManager: boolean;
  userId: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [activePrompt, setActivePrompt] = useState<ActivePrompt>(null);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDelivery, setPurchaseDelivery] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  // Sort: pending first, then purchased, then received/rejected
  const statusOrder: Record<string, number> = {
    pending: 0,
    purchased: 1,
    received: 2,
    rejected: 2,
  };
  const sorted = [...items].sort(
    (a, b) =>
      (statusOrder[a.status || "pending"] ?? 9) -
      (statusOrder[b.status || "pending"] ?? 9)
  );

  const pending = items.filter((i) => i.status === "pending").length;
  const purchased = items.filter((i) => i.status === "purchased").length;
  const received = items.filter((i) => i.status === "received").length;
  const rejected = items.filter((i) => i.status === "rejected").length;

  async function handleConfirmPurchase(itemId: string) {
    const price = purchasePrice ? parseFloat(purchasePrice) : null;
    const delivery = purchaseDelivery || null;
    await markAsPurchased(itemId, price, delivery);
    setActivePrompt(null);
    setPurchasePrice("");
    setPurchaseDelivery("");
  }

  async function handleConfirmReject(itemId: string) {
    await rejectItem(itemId, rejectReason);
    setActivePrompt(null);
    setRejectReason("");
  }

  async function handleDelete(itemId: string) {
    if (!confirm("Eliminar este item?")) return;
    await deletePurchaseItem(itemId);
  }

  return (
    <div>
      {/* Stats + add button */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {pending} pendiente(s) &middot; {purchased} comprado(s) &middot;{" "}
          {received} recibido(s)
          {rejected > 0 && <> &middot; {rejected} rechazado(s)</>}
        </p>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          {showForm ? "Cancelar" : "+ Añadir item"}
        </button>
      </div>

      {/* Add item form */}
      {showForm && (
        <form
          action={async (formData) => {
            await addPurchaseItem(formData);
            setShowForm(false);
          }}
          className="mb-4 space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Que comprar *
              </label>
              <input
                type="text"
                name="description"
                required
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
                placeholder="Descripcion del item..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Link (opcional)
              </label>
              <input
                type="url"
                name="link"
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Cant.
                </label>
                <input
                  type="number"
                  name="quantity"
                  defaultValue={1}
                  min={1}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Precio est.
                </label>
                <input
                  type="number"
                  name="estimated_price"
                  step="0.01"
                  min="0"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Proyecto
                </label>
                <select
                  name="project_id"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="">—</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
            >
              Añadir
            </button>
          </div>
        </form>
      )}

      {/* Items table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
            <tr>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                Descripcion
              </th>
              <th className="hidden px-4 py-3 font-medium text-zinc-700 md:table-cell dark:text-zinc-300">
                Cant.
              </th>
              <th className="hidden px-4 py-3 font-medium text-zinc-700 md:table-cell dark:text-zinc-300">
                Precio
              </th>
              <th className="hidden px-4 py-3 font-medium text-zinc-700 md:table-cell dark:text-zinc-300">
                Pedido por
              </th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                Estado
              </th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {sorted.length > 0 ? (
              sorted.map((item) => {
                const status = item.status || "pending";
                const isDone = status === "received" || status === "rejected";

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                      isDone ? "opacity-50" : ""
                    }`}
                  >
                    {/* Description */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-zinc-900 dark:text-white">
                          {item.description}
                        </span>
                        {item.link && (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <svg
                              className="h-3 w-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                            Link
                          </a>
                        )}
                        {item.project_name && (
                          <span className="mt-0.5 inline-flex w-fit items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            {item.project_name}
                          </span>
                        )}
                        {status === "rejected" && item.rejection_reason && (
                          <span className="mt-1 text-xs text-red-500 dark:text-red-400">
                            Motivo: {item.rejection_reason}
                          </span>
                        )}
                        {status === "purchased" && item.estimated_delivery && (
                          <span className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                            Entrega est.:{" "}
                            {new Date(
                              item.estimated_delivery
                            ).toLocaleDateString("es-ES")}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="hidden px-4 py-3 text-zinc-500 md:table-cell dark:text-zinc-400">
                      {item.quantity || 1}
                    </td>

                    {/* Price */}
                    <td className="hidden px-4 py-3 text-zinc-500 md:table-cell dark:text-zinc-400">
                      {item.actual_price != null ? (
                        <span className="font-medium text-zinc-900 dark:text-white">
                          {item.actual_price.toFixed(2)}&euro;
                        </span>
                      ) : item.estimated_price != null ? (
                        <span>~{item.estimated_price.toFixed(2)}&euro;</span>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Creator */}
                    <td className="hidden px-4 py-3 text-zinc-500 md:table-cell dark:text-zinc-400">
                      {item.creator_name}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_COLORS[status]
                        }`}
                      >
                        {STATUS_LABELS[status]}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {/* Purchase prompt */}
                        {activePrompt?.type === "purchase" &&
                        activePrompt.itemId === item.id ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                value={purchasePrice}
                                onChange={(e) =>
                                  setPurchasePrice(e.target.value)
                                }
                                placeholder="Precio"
                                className="w-20 rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                              />
                              <input
                                type="date"
                                value={purchaseDelivery}
                                onChange={(e) =>
                                  setPurchaseDelivery(e.target.value)
                                }
                                className="w-32 rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleConfirmPurchase(item.id)
                                }
                                className="rounded bg-amber-600 px-2 py-1 text-xs text-white hover:bg-amber-700"
                              >
                                OK
                              </button>
                              <button
                                type="button"
                                onClick={() => setActivePrompt(null)}
                                className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                              >
                                X
                              </button>
                            </div>
                          </div>
                        ) : activePrompt?.type === "reject" &&
                          activePrompt.itemId === item.id ? (
                          /* Reject prompt */
                          <div className="flex flex-col gap-1">
                            <input
                              type="text"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Motivo de rechazo"
                              className="w-40 rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                            />
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleConfirmReject(item.id)}
                                className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                              >
                                Rechazar
                              </button>
                              <button
                                type="button"
                                onClick={() => setActivePrompt(null)}
                                className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                              >
                                X
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Normal actions */
                          <div className="flex items-center gap-2">
                            {isManager && status === "pending" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActivePrompt({
                                      type: "purchase",
                                      itemId: item.id,
                                    });
                                    setPurchasePrice("");
                                    setPurchaseDelivery("");
                                  }}
                                  className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700"
                                >
                                  Comprado
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActivePrompt({
                                      type: "reject",
                                      itemId: item.id,
                                    });
                                    setRejectReason("");
                                  }}
                                  className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                                >
                                  Rechazar
                                </button>
                              </>
                            )}
                            {isManager && status === "purchased" && (
                              <button
                                type="button"
                                onClick={() => markAsReceived(item.id)}
                                className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                              >
                                Recibido
                              </button>
                            )}
                            {(isManager ||
                              item.created_by === userId) &&
                              status === "pending" && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(item.id)}
                                  className="text-xs text-red-500 hover:text-red-700 dark:text-red-400"
                                >
                                  Eliminar
                                </button>
                              )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400"
                >
                  No hay items. Añade el primero.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
