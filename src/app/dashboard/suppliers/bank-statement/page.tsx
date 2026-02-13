import Link from "next/link";
import { getSuppliers, getVendorMappings, getClaimHistory, getStatements } from "./actions";
import StatementProcessor from "./statement-processor";

export default async function BankStatementPage() {
  const [suppliers, vendorMappings, claimHistory, statements] = await Promise.all([
    getSuppliers(),
    getVendorMappings(),
    getClaimHistory(),
    getStatements(),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/dashboard/suppliers"
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Extractos bancarios
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Gestiona extractos BBVA por mes, mapea proveedores y envia reclamaciones de facturas
          </p>
        </div>
      </div>

      <StatementProcessor
        suppliers={suppliers}
        vendorMappings={vendorMappings}
        claimHistory={claimHistory}
        statements={statements}
      />
    </div>
  );
}
