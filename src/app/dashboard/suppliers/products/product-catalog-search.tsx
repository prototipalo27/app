"use client";

import { useState } from "react";
import Link from "next/link";

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
}: {
  products: Product[];
  categories: string[];
}) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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

  return (
    <div>
      {/* Search + filter */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="Buscar producto, proveedor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
        />
        <select
          value={selectedCategory || ""}
          onChange={(e) =>
            setSelectedCategory(e.target.value || null)
          }
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
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

      {/* Grouped product list */}
      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">
            {products.length === 0
              ? "No hay productos en el catalogo. Añade productos desde la pagina de cada proveedor."
              : "No se encontraron productos con esos filtros."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, items]) => (
              <div key={category}>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {category}
                </h2>
                <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                      <tr>
                        <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                          Producto
                        </th>
                        <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                          Proveedor
                        </th>
                        <th className="hidden px-4 py-2 text-right font-medium text-zinc-700 sm:table-cell dark:text-zinc-300">
                          Precio
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {items.map((product) => (
                        <tr
                          key={product.id}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        >
                          <td className="px-4 py-3">
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
                          <td className="px-4 py-3">
                            {product.suppliers ? (
                              <Link
                                href={`/dashboard/suppliers/${product.suppliers.id}`}
                                className="text-zinc-700 hover:text-green-600 dark:text-zinc-300 dark:hover:text-green-400"
                              >
                                {product.suppliers.name}
                              </Link>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </td>
                          <td className="hidden px-4 py-3 text-right whitespace-nowrap sm:table-cell">
                            {product.price != null ? (
                              <span className="text-zinc-600 dark:text-zinc-300">
                                {product.price.toFixed(2)}&euro;
                              </span>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
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
