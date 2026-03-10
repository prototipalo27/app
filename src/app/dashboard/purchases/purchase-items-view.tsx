"use client";

import { useState } from "react";
import Link from "next/link";
import {
  addPurchaseItem,
  markAsPurchased,
  rejectItem,
  markAsReceived,
  deletePurchaseItem,
  editPurchaseItem,
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
  provider: string | null;
  creator_name: string;
  project_name: string | null;
}

interface Project {
  id: string;
  name: string;
}

interface Supplier {
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
  | { type: "edit"; itemId: string }
  | null;

export default function PurchaseItemsView({
  items,
  projects,
  suppliers,
  isManager,
  userId,
}: {
  items: PurchaseItem[];
  projects: Project[];
  suppliers: Supplier[];
  isManager: boolean;
  userId: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [activePrompt, setActivePrompt] = useState<ActivePrompt>(null);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDelivery, setPurchaseDelivery] = useState("");
  const [purchaseSupplier, setPurchaseSupplier] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editQty, setEditQty] = useState("1");
  const [editPrice, setEditPrice] = useState("");
  const [editProject, setEditProject] = useState("");

  const [showHistory, setShowHistory] = useState(false);

  // Split active vs finished
  const active = items.filter(
    (i) => i.status === "pending" || i.status === "purchased"
  );
  const history = items.filter(
    (i) => i.status === "received" || i.status === "rejected"
  );

  // Sort active: pending first, then purchased
  const sorted = [...active].sort((a, b) =>
    a.status === "pending" && b.status !== "pending" ? -1 :
    a.status !== "pending" && b.status === "pending" ? 1 : 0
  );

  // Sort history: most recent first
  const sortedHistory = [...history].sort((a, b) =>
    new Date(b.received_at || b.created_at || "").getTime() -
    new Date(a.received_at || a.created_at || "").getTime()
  );

  const pending = active.filter((i) => i.status === "pending").length;
  const purchased = active.filter((i) => i.status === "purchased").length;
  const received = history.filter((i) => i.status === "received").length;
  const rejected = history.filter((i) => i.status === "rejected").length;

  async function handleConfirmPurchase(itemId: string) {
    const price = purchasePrice ? parseFloat(purchasePrice) : null;
    const delivery = purchaseDelivery || null;
    const supplier = purchaseSupplier || null;
    await markAsPurchased(itemId, price, delivery, supplier);
    setActivePrompt(null);
    setPurchasePrice("");
    setPurchaseDelivery("");
    setPurchaseSupplier("");
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

  function startEdit(item: PurchaseItem) {
    setActivePrompt({ type: "edit", itemId: item.id });
    setEditDesc(item.description);
    setEditLink(item.link || "");
    setEditQty(String(item.quantity || 1));
    setEditPrice(item.estimated_price != null ? String(item.estimated_price) : "");
    setEditProject(item.project_id || "");
  }

  async function handleConfirmEdit(itemId: string) {
    await editPurchaseItem(itemId, {
      description: editDesc,
      link: editLink || null,
      quantity: parseInt(editQty, 10) || 1,
      estimated_price: editPrice ? parseFloat(editPrice) : null,
      project_id: editProject || null,
    });
    setActivePrompt(null);
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
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/suppliers/products"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Ver catálogo
          </Link>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            {showForm ? "Cancelar" : "+ Añadir item"}
          </button>
        </div>
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
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            STATUS_COLORS[status]
                          }`}
                        >
                          {STATUS_LABELS[status]}
                        </span>
                        {status === "purchased" && item.estimated_delivery && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400">
                            Entrega:{" "}
                            {new Date(
                              item.estimated_delivery
                            ).toLocaleDateString("es-ES")}
                          </span>
                        )}
                        {status === "received" && item.provider && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Añadido al catálogo
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {/* Purchase prompt */}
                        {activePrompt?.type === "purchase" &&
                        activePrompt.itemId === item.id ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-col gap-0.5">
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
                                  title="Fecha estimada de entrega"
                                  className="w-32 rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                                />
                              </div>
                              <span className="text-[9px] text-zinc-400 dark:text-zinc-500">Fecha = entrega estimada</span>
                            </div>
                            <select
                              value={purchaseSupplier}
                              onChange={(e) =>
                                setPurchaseSupplier(e.target.value)
                              }
                              className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                            >
                              <option value="">Proveedor (opcional)</option>
                              {suppliers.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
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
                        ) : activePrompt?.type === "edit" &&
                          activePrompt.itemId === item.id ? (
                          /* Edit prompt */
                          <div className="flex flex-col gap-1">
                            <input
                              type="text"
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              placeholder="Descripcion"
                              className="w-40 rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                            />
                            <input
                              type="url"
                              value={editLink}
                              onChange={(e) => setEditLink(e.target.value)}
                              placeholder="Link (opcional)"
                              className="w-40 rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                            />
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={editQty}
                                onChange={(e) => setEditQty(e.target.value)}
                                min={1}
                                placeholder="Cant."
                                className="w-14 rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                              />
                              <input
                                type="number"
                                step="0.01"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                placeholder="Precio est."
                                className="w-20 rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                              />
                            </div>
                            <select
                              value={editProject}
                              onChange={(e) => setEditProject(e.target.value)}
                              className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                            >
                              <option value="">Sin proyecto</option>
                              {projects.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleConfirmEdit(item.id)}
                                className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                              >
                                Guardar
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
                                    setPurchaseSupplier("");
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
                                <>
                                  <button
                                    type="button"
                                    onClick={() => startEdit(item)}
                                    className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(item.id)}
                                    className="text-xs text-red-500 hover:text-red-700 dark:text-red-400"
                                  >
                                    Eliminar
                                  </button>
                                </>
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
                  No hay solicitudes activas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* History toggle */}
      {(received > 0 || rejected > 0) && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <svg
              className={`h-4 w-4 transition-transform ${showHistory ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Historial ({received} recibido{received !== 1 ? "s" : ""}{rejected > 0 ? `, ${rejected} rechazado${rejected !== 1 ? "s" : ""}` : ""})
          </button>

          {showHistory && (
            <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {sortedHistory.map((item) => {
                    const status = item.status || "received";
                    return (
                      <tr key={item.id} className="opacity-60">
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
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
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
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 text-zinc-500 md:table-cell dark:text-zinc-400">
                          {item.quantity || 1}
                        </td>
                        <td className="hidden px-4 py-3 text-zinc-500 md:table-cell dark:text-zinc-400">
                          {item.actual_price != null ? (
                            <span>{item.actual_price.toFixed(2)}&euro;</span>
                          ) : item.estimated_price != null ? (
                            <span>~{item.estimated_price.toFixed(2)}&euro;</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="hidden px-4 py-3 text-zinc-500 md:table-cell dark:text-zinc-400">
                          {item.creator_name}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
                          >
                            {STATUS_LABELS[status]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
