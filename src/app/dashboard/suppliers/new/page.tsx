import { createSupplier } from "../actions";
import SupplierSelector from "../supplier-selector";
import Link from "next/link";
import SupplierForm from "./supplier-form";
import { requireRole } from "@/lib/rbac";

export default async function NewSupplierPage() {
  await requireRole("manager");
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href="/dashboard/suppliers"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Volver a proveedores
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
          Nuevo proveedor
        </h1>
      </div>

      <SupplierForm action={createSupplier}>
        <SupplierSelector />
      </SupplierForm>
    </div>
  );
}
