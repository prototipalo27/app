import Image from "next/image";
import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDocument } from "@/lib/holded/api";
import ProformaForm from "./proforma-form";

export const metadata: Metadata = {
  title: "Presupuesto — Prototipalo",
};

export default async function ProformaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, holded_proforma_id, client_name, proforma_sent_at")
    .eq("tracking_token", token)
    .single();

  if (!project || !project.holded_proforma_id) notFound();

  // Check if already accepted (shipping_info exists with recipient data)
  const { data: shippingInfo } = await supabase
    .from("shipping_info")
    .select("recipient_name")
    .eq("project_id", project.id)
    .maybeSingle();

  const alreadyAccepted = !!shippingInfo?.recipient_name;

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
