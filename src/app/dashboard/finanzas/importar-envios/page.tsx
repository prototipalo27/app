import { requireRole } from "@/lib/rbac";
import Link from "next/link";
import { listProjectsForAssignment } from "./actions";
import ImportClient from "./import-client";

export const dynamic = "force-dynamic";

export default async function ImportarEnviosPage() {
  await requireRole("manager");
  const projects = await listProjectsForAssignment();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6">
        <Link
          href="/dashboard/finanzas"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← Finanzas
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
          Imputar gastos de envío (MRW)
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Sube el resumen mensual de MRW en PDF. Se leen los albaranes, se
          reparten los recargos (combustible + seguro) y se imputa el coste a
          cada proyecto. Las líneas sin casar las asignas tú.
        </p>
      </div>

      <ImportClient projects={projects} />
    </div>
  );
}
