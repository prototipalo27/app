import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { deleteSupplier } from "../actions";
import PaymentForm from "./payment-form";
import Reconciliation from "./reconciliation";
import { getUserProfile, hasRole } from "@/lib/rbac";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getUserProfile();
  if (!profile) redirect("/login");
  const isManager = hasRole(profile.role, "manager");

  const supabase = await createClient();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .single();

  if (!supplier) notFound();

  const { data: payments } = await supabase
    .from("supplier_payments")
    .select("*")
    .eq("supplier_id", id)
    .order("payment_date", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <Link
          href="/dashboard/suppliers"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Volver a proveedores
        </Link>
      </div>

      {/* Supplier info card */}
      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {supplier.name}
            </h1>
            {supplier.holded_contact_id && (
              <span className="mt-1 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                Holded vinculado
              </span>
            )}
          </div>
          {isManager && (
            <form action={deleteSupplier}>
              <input type="hidden" name="id" value={supplier.id} />
              <button
                type="submit"
                className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                onClick={(e) => {
                  if (!confirm("Eliminar proveedor y todos sus pagos?")) {
                    e.preventDefault();
                  }
                }}
              >
                Eliminar
              </button>
            </form>
          )}
        </div>

        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 md:grid-cols-3">
          {supplier.email && (
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Email: </span>
              <span className="text-zinc-900 dark:text-white">
                {supplier.email}
              </span>
            </div>
          )}
          {supplier.phone && (
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Tel: </span>
              <span className="text-zinc-900 dark:text-white">
                {supplier.phone}
              </span>
            </div>
          )}
          {supplier.nif_cif && (
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">
                NIF/CIF:{" "}
              </span>
              <span className="text-zinc-900 dark:text-white">
                {supplier.nif_cif}
              </span>
            </div>
          )}
          {supplier.address && (
            <div className="sm:col-span-2">
              <span className="text-zinc-500 dark:text-zinc-400">
                Direccion:{" "}
              </span>
              <span className="text-zinc-900 dark:text-white">
                {[supplier.address, supplier.city, supplier.country]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </div>
          )}
          {supplier.notes && (
            <div className="sm:col-span-3">
              <span className="text-zinc-500 dark:text-zinc-400">
                Notas:{" "}
              </span>
              <span className="text-zinc-900 dark:text-white">
                {supplier.notes}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Payment form + Payments table */}
      <PaymentForm
        supplierId={supplier.id}
        payments={payments || []}
        supplierName={supplier.name}
        canManage={isManager}
      />

      {/* Reconciliation */}
      <Reconciliation
        payments={payments || []}
        supplierName={supplier.name}
        supplierEmail={supplier.email}
      />
    </div>
  );
}
