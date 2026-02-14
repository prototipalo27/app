import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { deleteSupplier } from "../actions";
import PaymentForm from "./payment-form";
import Reconciliation from "./reconciliation";
import DeleteButton from "./delete-button";
import SupplierEditForm from "./supplier-edit-form";
import SupplierProducts from "./supplier-products";
import { requireRole } from "@/lib/rbac";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("manager");
  const { id } = await params;

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

  const { data: products } = await supabase
    .from("supplier_products")
    .select("*")
    .eq("supplier_id", id)
    .order("category")
    .order("name");

  const deleteForm = (
    <form action={deleteSupplier}>
      <input type="hidden" name="id" value={supplier.id} />
      <DeleteButton />
    </form>
  );

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

      {/* Supplier info card (editable) */}
      <SupplierEditForm supplier={supplier} deleteForm={deleteForm} />

      {/* Supplier products */}
      <SupplierProducts
        supplierId={supplier.id}
        products={products || []}
      />

      {/* Payment form + Payments table */}
      <PaymentForm
        supplierId={supplier.id}
        payments={payments || []}
        supplierName={supplier.name}
        canManage={true}
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
