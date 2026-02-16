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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Extractos bancarios
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Gestiona extractos BBVA por mes, mapea proveedores y envia reclamaciones de facturas
        </p>
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
