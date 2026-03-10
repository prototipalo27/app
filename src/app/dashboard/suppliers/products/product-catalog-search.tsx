"use client";

import { useState } from "react";
import Link from "next/link";
import { addPurchaseItem } from "@/app/dashboard/purchases/actions";

interface Product {
  id: string;
  name: string;
  category: string | null;
  url: string | null;
  price: number | null;
  notes: string | null;
  suppliers: { id: string; name: string } | null;
}

export default function ProductCatalogSearch({
  products,
  categories,
  isManager,
}: {
  products: Product[];
  categories: string[];
  isManager: boolean;
}) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const filtered = products.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.notes?.toLowerCase().includes(search.toLowerCase()) ||
      p.suppliers?.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group by category
  const grouped = filtered.reduce<Record<string, Product[]>>((acc, p) => {
    const cat = p.category || "Sin categoria";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  async function handleRequestPurchase(product: Product) {
    setRequestingId(product.id);
    try {
      const formData = new FormData();
      formData.set("description", product.name);
      if (product.url) formData.set("link", product.url);
      const qty = quantities[product.id] || 1;
      formData.set("quantity", String(qty));
      if (product.price != null)
        formData.set("estimated_price", String(product.price));
      await addPurchaseItem(formData);
      setRequestedIds((prev) => new Set(prev).add(product.id));
    } catch {
      // ignore
    } finally {
      setRequestingId(null);
    }
  }

  return (
    <div>
      {/* Search + filter */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="Buscar producto, proveedor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
        />
        <select
          value={selectedCategory || ""}
          onChange={(e) =>
            setSelectedCategory(e.target.value || null)
          }
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
        >
          <option value="">Todas las categorias</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Results count */}
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        {filtered.length} producto{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Product table */}
      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">
            {products.length === 0
              ? "No hay productos en el catalogo. Añade productos desde la pagina de cada proveedor."
              : "No se encontraron productos con esos filtros."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <colgroup>
              <col className="w-[40%]" />
              <col className="w-[25%]" />
              <col className="w-[15%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-zinc-700 dark:text-zinc-300">
                  Producto
                </th>
                <th className="px-4 py-2.5 text-center font-medium text-zinc-700 dark:text-zinc-300">
                  Proveedor
                </th>
                <th className="hidden px-4 py-2.5 text-center font-medium text-zinc-700 sm:table-cell dark:text-zinc-300">
                  Precio
                </th>
                <th className="px-4 py-2.5 text-center font-medium text-zinc-700 dark:text-zinc-300">
                  Accion
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([category, items]) => (
                  <>
                    {/* Category header row */}
                    <tr key={`cat-${category}`} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td
                        colSpan={4}
                        className="bg-zinc-50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400"
                      >
                        {category}
                      </td>
                    </tr>
                    {/* Products in category */}
                    {items.map((product) => (
                      <tr
                        key={product.id}
                        className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                      >
                        <td className="px-4 py-3 text-left">
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
                        <td className="px-4 py-3 text-center">
                          {product.suppliers ? (
                            isManager ? (
                              <Link
                                href={`/dashboard/suppliers/${product.suppliers.id}`}
                                className="text-zinc-700 hover:text-green-600 dark:text-zinc-300 dark:hover:text-green-400"
                              >
                                {product.suppliers.name}
                              </Link>
                            ) : (
                              <span className="text-zinc-700 dark:text-zinc-300">
                                {product.suppliers.name}
                              </span>
                            )
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 text-center whitespace-nowrap sm:table-cell">
                          {product.price != null ? (
                            <span className="text-zinc-600 dark:text-zinc-300">
                              {product.price.toFixed(2)}&euro;
                            </span>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {requestedIds.has(product.id) ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Solicitado
                            </span>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              <input
                                type="number"
                                min={1}
                                value={quantities[product.id] || 1}
                                onChange={(e) =>
                                  setQuantities((prev) => ({
                                    ...prev,
                                    [product.id]: Math.max(1, parseInt(e.target.value, 10) || 1),
                                  }))
                                }
                                className="w-14 rounded-lg border border-zinc-300 px-2 py-1.5 text-center text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                              />
                              <button
                                type="button"
                                disabled={requestingId === product.id}
                                onClick={() => handleRequestPurchase(product)}
                                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white whitespace-nowrap hover:bg-brand-dark disabled:opacity-50"
                              >
                                {requestingId === product.id
                                  ? "..."
                                  : "Solicitar"}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
