import Image from "next/image";
import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import NdaForm from "./nda-form";

export const metadata: Metadata = {
  title: "Acuerdo de confidencialidad — Prototipalo",
};

export default async function NdaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: nda } = await supabase
    .from("nda_agreements")
    .select("*, leads(full_name, company)")
    .eq("token", token)
    .single();

  if (!nda) notFound();

  const lead = nda.leads as { full_name: string; company: string | null } | null;

  if (nda.status === "signed") {
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
              Acuerdo ya firmado
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Este acuerdo de confidencialidad ya ha sido firmado
              {nda.signed_at && (
                <> el {new Date(nda.signed_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</>
              )}
              . Se ha enviado una copia al email proporcionado.
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
            Acuerdo de confidencialidad
          </h1>
          {lead && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {lead.full_name}
              {lead.company ? ` — ${lead.company}` : ""}
            </p>
          )}
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Rellena tus datos y firma para completar el acuerdo.
          </p>
        </div>
        <NdaForm token={token} />
      </div>
    </div>
  );
}
