"use client";

import { useState } from "react";
import {
  addPurchaseItem,
  updatePurchaseItemStatus,
  deletePurchaseItem,
  clearPurchasedItems,
} from "./actions";

interface Item {
  id: string;
  description: string;
  link: string | null;
  quantity: number | null;
  item_type: string | null;
  provider: string | null;
  status: string | null;
  estimated_price: number | null;
  actual_price: number | null;
  purchased_at: string | null;
  received_at: string | null;
  notes: string | null;
}

const PROVIDERS = [
  { value: "amazon", label: "Amazon" },
  { value: "imprenta", label: "Imprenta" },
  { value: "maderas", label: "Maderas" },
  { value: "general", label: "General" },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  purchased: "Comprado",
  received: "Recibido",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  purchased: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  received: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const PROVIDER_COLORS: Record<string, string> = {
  amazon: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  imprenta: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  maderas: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  general: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export default function PurchaseList({ items }: { items: Item[] }) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [pricePromptId, setPricePromptId] = useState<string | null>(null);
  const [actualPrice, setActualPrice] = useState("");

  const filteredItems =
    filter === "all"
      ? items
      : items.filter((i) => (i.provider || "general") === filter);

  const pendingItems = filteredItems.filter((i) => i.status === "pending");
  const purchasedItems = filteredItems.filter((i) => i.status === "purchased");
  const receivedItems = filteredItems.filter((i) => i.status === "received");

  async function handleStatusChange(itemId: string, currentStatus: string) {
    if (currentStatus === "pending") {
      setPricePromptId(itemId);
      setActualPrice("");
    } else if (currentStatus === "purchased") {
      await updatePurchaseItemStatus(itemId, "received");
    }
  }

  async function handleConfirmPurchase(itemId: string) {
    const price = actualPrice ? parseFloat(actualPrice) : undefined;
    await updatePurchaseItemStatus(itemId, "purchased", price);
    setPricePromptId(null);
    setActualPrice("");
  }

  async function handleDelete(itemId: string) {
    if (!confirm("Eliminar este item?")) return;
    await deletePurchaseItem(itemId);
  }

  async function handleClearReceived() {
    if (!confirm("Limpiar todos los items recibidos?")) return;
    await clearPurchasedItems();
  }

  // Count per provider for filter badges
  const providerCounts = new Map<string, number>();
  items.forEach((i) => {
    if (i.status === "pending") {
      const p = i.provider || "general";
      providerCounts.set(p, (providerCounts.get(p) || 0) + 1);
    }
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Lista de compras
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {pendingItems.length} pendiente(s) &middot;{" "}
            {purchasedItems.length} comprado(s) &middot;{" "}
            {receivedItems.length} recibido(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {receivedItems.length > 0 && (
            <button
              type="button"
              onClick={handleClearReceived}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Limpiar recibidos
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            {showForm ? "Cancelar" : "+ Añadir item"}
          </button>
        </div>
      </div>

      {/* Provider filter */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-full px-3 py-1 text-sm font-medium transition ${
            filter === "all"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          }`}
        >
          Todos ({items.filter((i) => i.status === "pending").length})
        </button>
        {PROVIDERS.map((p) => {
          const count = providerCounts.get(p.value) || 0;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => setFilter(p.value)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                filter === p.value
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : `${PROVIDER_COLORS[p.value]} hover:opacity-80`
              }`}
            >
              {p.label} {count > 0 && `(${count})`}
            </button>
          );
        })}
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
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
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
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Cant.
                </label>
                <input
                  type="number"
                  name="quantity"
                  defaultValue={1}
                  min={1}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Proveedor
                </label>
                <select
                  name="provider"
                  defaultValue={filter !== "all" ? filter : "general"}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Tipo
                </label>
                <select
                  name="item_type"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="general">General</option>
                  <option value="dtf">DTF</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Precio
                </label>
                <input
                  type="number"
                  name="estimated_price"
                  step="0.01"
                  min="0"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
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
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
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
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                Proveedor
              </th>
              <th className="hidden px-4 py-3 font-medium text-zinc-700 md:table-cell dark:text-zinc-300">
                Precio
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
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <tr
                  key={item.id}
                  className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                    item.status === "received" ? "opacity-50" : ""
                  }`}
                >
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
                      {item.notes && (
                        <span className="mt-0.5 text-xs text-zinc-400">
                          {item.notes}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-500 md:table-cell dark:text-zinc-400">
                    {item.quantity || 1}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        PROVIDER_COLORS[item.provider || "general"]
                      }`}
                    >
                      {PROVIDERS.find((p) => p.value === item.provider)
                        ?.label || item.provider}
                    </span>
                    {item.item_type === "dtf" && (
                      <span className="ml-1 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        DTF
                      </span>
                    )}
                  </td>
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
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[item.status || "pending"]
                      }`}
                    >
                      {STATUS_LABELS[item.status || "pending"]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {pricePromptId === item.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            value={actualPrice}
                            onChange={(e) => setActualPrice(e.target.value)}
                            placeholder="Precio"
                            className="w-20 rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleConfirmPurchase(item.id)}
                            className="rounded bg-amber-600 px-2 py-1 text-xs text-white hover:bg-amber-700"
                          >
                            OK
                          </button>
                          <button
                            type="button"
                            onClick={() => setPricePromptId(null)}
                            className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <>
                          {item.status !== "received" && (
                            <button
                              type="button"
                              onClick={() =>
                                handleStatusChange(
                                  item.id,
                                  item.status || "pending"
                                )
                              }
                              className={`rounded px-2 py-1 text-xs font-medium text-white ${
                                item.status === "pending"
                                  ? "bg-amber-600 hover:bg-amber-700"
                                  : "bg-green-600 hover:bg-green-700"
                              }`}
                            >
                              {item.status === "pending"
                                ? "Comprado"
                                : "Recibido"}
                            </button>
                          )}
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
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400"
                >
                  {filter !== "all"
                    ? "No hay items de este proveedor."
                    : "La lista esta vacia. Añade el primer item."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
