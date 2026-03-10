import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import ProductCatalogSearch from "./product-catalog-search";

export default async function ProductCatalogPage() {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");

  const isManager = hasRole(profile.role, "manager");

  const supabase = await createClient();

  const { data: products } = await supabase
    .from("supplier_products")
    .select("*, suppliers(id, name)")
    .order("category")
    .order("name");

  // Get unique categories for filtering
  const categories = [
    ...new Set(
      (products || [])
        .map((p) => p.category)
        .filter(Boolean)
    ),
  ].sort() as string[];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href={isManager ? "/dashboard/suppliers" : "/dashboard/purchases"}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            &larr; {isManager ? "Proveedores" : "Compras"}
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
            Catalogo de productos
          </h1>
        </div>
      </div>

      <ProductCatalogSearch
        products={products || []}
        categories={categories}
        isManager={isManager}
      />
    </div>
  );
}
