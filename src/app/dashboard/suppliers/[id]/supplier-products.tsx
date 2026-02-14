"use client";

import { useState, useRef } from "react";
import { addSupplierProduct, deleteSupplierProduct } from "../actions";

interface Product {
  id: string;
  name: string;
  category: string | null;
  url: string | null;
  price: number | null;
  notes: string | null;
}

const inputClass =
  "mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500";

export default function SupplierProducts({
  supplierId,
  products,
}: {
  supplierId: string;
  products: Product[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAdd(formData: FormData) {
    setSaving(true);
    setError(null);
    const result = await addSupplierProduct(formData);
    setSaving(false);
    if (result?.success) {
      formRef.current?.reset();
      setShowForm(false);
    } else {
      setError(result?.error || "Error al añadir producto");
    }
  }

  async function handleDelete(productId: string) {
    if (!confirm("Eliminar este producto?")) return;
    setDeleting(productId);
    const result = await deleteSupplierProduct(productId, supplierId);
    setDeleting(null);
    if (!result?.success) {
      setError(result?.error || "Error al eliminar producto");
    }
  }

  // Group products by category
  const grouped = products.reduce<Record<string, Product[]>>((acc, p) => {
    const cat = p.category || "Sin categoria";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  return (
    <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
          Productos / Materiales
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
        >
          {showForm ? "Cancelar" : "+ Producto"}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Add product form */}
      {showForm && (
        <form
          ref={formRef}
          action={handleAdd}
          className="mt-4 space-y-3 rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50"
        >
          <input type="hidden" name="supplier_id" value={supplierId} />

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Nombre *
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="PLA Negro 1kg"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Categoria
              </label>
              <input
                type="text"
                name="category"
                placeholder="filamento, tornilleria..."
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                URL (enlace al producto)
              </label>
              <input
                type="url"
                name="url"
                placeholder="https://..."
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Precio orientativo
              </label>
              <input
                type="number"
                name="price"
                step="0.01"
                min="0"
                placeholder="0.00"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Notas
            </label>
            <input
              type="text"
              name="notes"
              placeholder="Notas adicionales..."
              className={inputClass}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Añadir producto"}
            </button>
          </div>
        </form>
      )}

      {/* Product list */}
      {products.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          No hay productos registrados para este proveedor.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, items]) => (
              <div key={category}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {category}
                </h3>
                <div className="overflow-x-auto rounded-lg border border-zinc-100 dark:border-zinc-800">
                  <table className="w-full text-left text-sm">
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {items.map((product) => (
                        <tr
                          key={product.id}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        >
                          <td className="px-3 py-2">
                            <div className="font-medium text-zinc-900 dark:text-white">
                              {product.url ? (
                                <a
                                  href={product.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-green-600 dark:hover:text-green-400"
                                >
                                  {product.name} ↗
                                </a>
                              ) : (
                                product.name
                              )}
                            </div>
                            {product.notes && (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {product.notes}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {product.price != null && (
                              <span className="text-zinc-600 dark:text-zinc-300">
                                {product.price.toFixed(2)}&euro;
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => handleDelete(product.id)}
                              disabled={deleting === product.id}
                              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                            >
                              {deleting === product.id
                                ? "..."
                                : "Eliminar"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
