import { Suspense } from "react";
import Image from "next/image";
import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ContractForm from "./contract-form";
import type { AgreementLanguage } from "@/lib/studio-dev-agreement-text";

// `studio_dev_agreements` aún no está en database.types.ts.
interface DevAgreementRow {
  id: string;
  status: "pending" | "signed" | "cancelled";
  language: AgreementLanguage;
  signed_at: string | null;
  workspace_fee: number | string;
  engineering_hours: number;
  engineering_rate: number | string;
  printing_hours: number;
  printing_rate: number | string;
  minimum_months: number;
  approval_threshold: number | string;
  nda_reference_date: string | null;
  studio_projects: {
    name: string;
    client_name: string | null;
    nda_project_description: string | null;
  } | null;
}

export const metadata: Metadata = {
  title: "Development Agreement — Prototipalo",
};

export default async function ContractPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950" />}>
      <ContractContent params={params} />
    </Suspense>
  );
}

async function ContractContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawAgreement } = await (supabase as unknown as { from: (t: string) => any })
    .from("studio_dev_agreements")
    .select("*, studio_projects(name, client_name, nda_project_description)")
    .eq("token", token)
    .single();

  if (!rawAgreement) notFound();
  const agreement = rawAgreement as DevAgreementRow;
  const project = agreement.studio_projects;
  const lang = agreement.language;
  const contextName = project
    ? `${project.name}${project.client_name ? ` — ${project.client_name}` : ""}`
    : null;

  if (agreement.status === "signed") {
    const signedDate = agreement.signed_at
      ? new Date(agreement.signed_at).toLocaleDateString(
          lang === "es" ? "es-ES" : "en-GB",
          { day: "numeric", month: "long", year: "numeric" },
        )
      : null;
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-center">
            <Image src="/logo-dark.png" alt="Prototipalo" width={472} height={236} className="hidden h-8 w-auto dark:block" />
            <Image src="/logo-light.png" alt="Prototipalo" width={472} height={236} className="block h-8 w-auto dark:hidden" />
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-white">
              {lang === "es" ? "Contrato firmado" : "Agreement signed"}
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {lang === "es" ? (
                <>
                  Este contrato ya ha sido firmado{signedDate && <> el {signedDate}</>}. Se ha enviado una copia al email proporcionado.
                </>
              ) : (
                <>
                  This agreement has already been signed{signedDate && <> on {signedDate}</>}. A copy has been emailed to the address provided.
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <div className="mb-4 flex justify-center">
            <Image src="/logo-dark.png" alt="Prototipalo" width={472} height={236} className="hidden h-8 w-auto dark:block" />
            <Image src="/logo-light.png" alt="Prototipalo" width={472} height={236} className="block h-8 w-auto dark:hidden" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
            {lang === "es" ? "Contrato de Desarrollo y Colaboración" : "Development and Collaboration Agreement"}
          </h1>
          {contextName && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{contextName}</p>
          )}
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {lang === "es"
              ? "Rellena tus datos y firma para completar el contrato."
              : "Fill in your details and sign to complete the agreement."}
          </p>
        </div>
        <ContractForm
          token={token}
          language={lang}
          terms={{
            workspaceFee: Number(agreement.workspace_fee),
            engineeringHours: agreement.engineering_hours,
            engineeringRate: Number(agreement.engineering_rate),
            printingHours: agreement.printing_hours,
            printingRate: Number(agreement.printing_rate),
            minimumMonths: agreement.minimum_months,
            approvalThreshold: Number(agreement.approval_threshold),
          }}
          ndaReferenceDate={agreement.nda_reference_date}
          projectDescription={project?.nda_project_description ?? null}
        />
      </div>
    </div>
  );
}
