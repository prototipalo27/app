import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import QuoteForm from "./quote-form";

export const metadata: Metadata = {
  title: "Datos de facturación — Prototipalo",
};

export default async function QuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: quoteRequest } = await supabase
    .from("quote_requests")
    .select("*, leads(full_name, company)")
    .eq("token", token)
    .single();

  if (!quoteRequest) notFound();

  const lead = quoteRequest.leads as { full_name: string; company: string | null } | null;

  if (quoteRequest.status === "submitted") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white">
            Datos ya enviados
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Gracias, ya hemos recibido tus datos de facturación. Nos pondremos en contacto contigo pronto.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
            Datos de facturación
          </h1>
          {lead && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {lead.full_name}
              {lead.company ? ` — ${lead.company}` : ""}
            </p>
          )}
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Por favor, rellena los siguientes datos para que podamos preparar tu presupuesto.
          </p>
        </div>
        <QuoteForm token={token} />
      </div>
    </div>
  );
}
