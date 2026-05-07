import { Suspense } from "react";
import Image from "next/image";
import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDocument } from "@/lib/holded/api";
import ProformaForm from "./proforma-form";
import StudioProformaPay from "./studio-proforma-pay";

export const metadata: Metadata = {
  title: "Presupuesto — Prototipalo",
};

export default async function ProformaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950" />}>
      <ProformaContent params={params} />
    </Suspense>
  );
}

async function ProformaContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceClient();

  // Studio payments come first: simpler flow, no billing form needed.
  const { data: studioPayment } = await supabase
    .from("studio_payments")
    .select(
      "id, label, amount, currency, holded_proforma_id, holded_proforma_doc_number, payment_status, status, studio_project_id",
    )
    .eq("tracking_token", token)
    .maybeSingle();

  if (studioPayment && studioPayment.holded_proforma_id) {
    return (
      <StudioProformaScreen
        token={token}
        payment={studioPayment}
      />
    );
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, holded_proforma_id, holded_contact_id, client_name, proforma_sent_at")
    .eq("tracking_token", token)
    .single();

  if (!project || !project.holded_proforma_id) notFound();

  // "Already accepted" now means already paid (via Stripe webhook → payment_status = 'paid').
  // That way if the client bails from the Stripe page they can re-enter and try again.
  const { data: quoteRequest } = project.holded_contact_id
    ? await supabase
        .from("quote_requests")
        .select("payment_status")
        .eq("holded_contact_id", project.holded_contact_id)
        .limit(1)
        .maybeSingle()
    : { data: null };

  const alreadyAccepted = quoteRequest?.payment_status === "paid";

  if (alreadyAccepted) {
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
              Presupuesto ya aceptado
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Gracias, ya hemos recibido tus datos. Te mantendremos informado del progreso de tu proyecto.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Fetch proforma lines from Holded
  let lines: Array<{ name: string; units: number; price: number; tax: number }> = [];
  let subtotal = 0;
  let totalTax = 0;
  let total = 0;

  try {
    const doc = await getDocument("proform", project.holded_proforma_id);
    lines = (doc.products || []).map((p) => ({
      name: p.name,
      units: p.units,
      price: p.price,
      tax: p.tax,
    }));
    subtotal = doc.subtotal || 0;
    totalTax = doc.tax || 0;
    total = doc.total || 0;
  } catch {
    // If Holded fails, show empty lines — still allow acceptance
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
            Presupuesto
          </h1>
          {project.client_name && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {project.client_name} — {project.name}
            </p>
          )}
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Revisa el presupuesto, completa tus datos de facturación y envío, y acepta para que pongamos tu proyecto en marcha.
          </p>
        </div>
        <ProformaForm
          token={token}
          lines={lines}
          subtotal={subtotal}
          totalTax={totalTax}
          total={total}
        />
      </div>
    </div>
  );
}

async function StudioProformaScreen({
  token,
  payment,
}: {
  token: string;
  payment: {
    id: string;
    label: string;
    amount: number;
    currency: string;
    holded_proforma_id: string | null;
    holded_proforma_doc_number: string | null;
    payment_status: string | null;
    studio_project_id: string;
  };
}) {
  if (payment.payment_status === "paid") {
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
            <h1 className="text-lg font-bold text-zinc-900 dark:text-white">Pago recibido</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Hemos recibido tu pago. ¡Gracias!
            </p>
          </div>
        </div>
      </div>
    );
  }

  const supabase = createServiceClient();
  const { data: project } = await supabase
    .from("studio_projects")
    .select("name, client_company_name, client_name, tax_rate, currency")
    .eq("id", payment.studio_project_id)
    .single();

  let subtotal = Number(payment.amount);
  let total = subtotal;
  let docNumber = payment.holded_proforma_doc_number || "";

  if (payment.holded_proforma_id) {
    try {
      const doc = await getDocument("proform", payment.holded_proforma_id);
      subtotal = doc.subtotal || subtotal;
      total = doc.total || subtotal;
      if (!docNumber && doc.docNumber) docNumber = doc.docNumber;
    } catch {
      // Fallback to local values if Holded is unreachable.
    }
  }

  const taxRate = Number(project?.tax_rate ?? 0);
  const taxAmount = total - subtotal;
  const clientLabel = project?.client_company_name || project?.client_name || "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <div className="w-full max-w-xl">
        <div className="mb-6 text-center">
          <div className="mb-4 flex justify-center">
            <Image src="/logo-dark.png" alt="Prototipalo" width={472} height={236} className="hidden h-8 w-auto dark:block" />
            <Image src="/logo-light.png" alt="Prototipalo" width={472} height={236} className="block h-8 w-auto dark:hidden" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
            Proforma{docNumber ? ` ${docNumber}` : ""}
          </h1>
          {clientLabel && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {clientLabel} — {project?.name}
            </p>
          )}
        </div>

        <StudioProformaPay
          token={token}
          label={payment.label}
          subtotal={subtotal}
          taxAmount={taxAmount}
          taxRate={taxRate}
          total={total}
          docNumber={docNumber}
        />
      </div>
    </div>
  );
}
