import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Tables } from "@/lib/supabase/database.types";
import type { Metadata } from "next";
import { getTracking } from "@/lib/packlink/api";
import { getTracking as getGlsTracking } from "@/lib/gls/api";
import { getVerifiedClient } from "@/lib/client-auth";
import ClientPortal from "./client-portal";

interface TrackingEvent {
  city?: string;
  description: string;
  timestamp?: string;
  date?: string;
}

const STATUSES = [
  { value: "pending", label: "Pendiente" },
  { value: "design", label: "Diseño" },
  { value: "printing", label: "Impresión" },
  { value: "post_processing", label: "Post-procesado" },
  { value: "qc", label: "Control de calidad" },
  { value: "shipping", label: "Envío" },
  { value: "delivered", label: "Entregado" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  design: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  printing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  post_processing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  qc: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  shipping: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  delivered: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const supabase = createServiceClient();
  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("tracking_token", token)
    .single();

  return {
    title: project ? `${project.name} — Tracking` : "Tracking",
  };
}

function ItemProgress({ item }: { item: Tables<"project_items"> }) {
  const pct = item.quantity > 0 ? (item.completed / item.quantity) * 100 : 0;
  const isComplete = item.completed === item.quantity;

  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
      <div className="flex items-center gap-2">
        {isComplete ? (
          <span className="text-green-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        ) : (
          <span className="h-4 w-4" />
        )}
        <span
          className={`flex-1 text-sm font-medium ${
            isComplete
              ? "text-green-600 dark:text-green-400"
              : "text-zinc-900 dark:text-white"
          }`}
        >
          {item.name}
        </span>
        <span
          className={`text-sm tabular-nums ${
            isComplete
              ? "font-semibold text-green-600 dark:text-green-400"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          {item.completed}/{item.quantity}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className={`h-full rounded-full transition-all ${
            isComplete ? "bg-green-500" : "bg-blue-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Pipeline({ currentStatus }: { currentStatus: string }) {
  const currentIdx = STATUSES.findIndex((s) => s.value === currentStatus);

  return (
    <div className="space-y-2">
      {STATUSES.map((s) => {
        const thisIdx = STATUSES.findIndex((st) => st.value === s.value);
        const isCurrent = currentStatus === s.value;
        const isPast = thisIdx < currentIdx;
        return (
          <div
            key={s.value}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
              isCurrent
                ? "bg-brand-blue-light font-medium text-brand-blue dark:bg-brand-blue/10 dark:text-brand-blue"
                : isPast
                  ? "text-zinc-400 line-through dark:text-zinc-500"
                  : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                isCurrent
                  ? "bg-brand-blue"
                  : isPast
                    ? "bg-zinc-300 dark:bg-zinc-600"
                    : "bg-zinc-200 dark:bg-zinc-700"
              }`}
            />
            {s.label}
          </div>
        );
      })}
    </div>
  );
}

function ShippingCard({ shipping, trackingEvents, glsBarcode }: { shipping: Tables<"shipping_info">; trackingEvents: TrackingEvent[]; glsBarcode?: string | null }) {
  const addressParts = [
    shipping.address_line,
    shipping.postal_code,
    shipping.city,
    shipping.country,
  ].filter(Boolean);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
        <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
        Envío
      </h2>
      <div className="space-y-2">
        {shipping.carrier && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Transportista</span>
            <span className="font-medium text-zinc-900 dark:text-white">{shipping.carrier}</span>
          </div>
        )}
        {(shipping.tracking_number || glsBarcode) && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">N.º seguimiento</span>
            <span className="font-mono font-medium text-zinc-900 dark:text-white">{glsBarcode || shipping.tracking_number}</span>
          </div>
        )}
        {shipping.shipment_status && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Estado</span>
            <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
              {shipping.shipment_status}
            </span>
          </div>
        )}
        {addressParts.length > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Dirección</span>
            <span className="text-right font-medium text-zinc-900 dark:text-white">{addressParts.join(", ")}</span>
          </div>
        )}
        {shipping.shipped_at && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Enviado</span>
            <span className="font-medium text-zinc-900 dark:text-white">
              {new Date(shipping.shipped_at).toLocaleDateString("es-ES")}
            </span>
          </div>
        )}
        {shipping.delivered_at && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Entregado</span>
            <span className="font-medium text-green-600 dark:text-green-400">
              {new Date(shipping.delivered_at).toLocaleDateString("es-ES")}
            </span>
          </div>
        )}
      </div>

      {trackingEvents.length > 0 && (
        <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <p className="mb-3 text-xs font-medium text-zinc-500 uppercase dark:text-zinc-400">Seguimiento</p>
          <div className="space-y-3">
            {trackingEvents.map((event, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`h-2.5 w-2.5 rounded-full ${i === 0 ? "bg-cyan-500" : "bg-zinc-300 dark:bg-zinc-600"}`} />
                  {i < trackingEvents.length - 1 && <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-700" />}
                </div>
                <div className="pb-3">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{event.description}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {event.city && `${event.city} · `}
                    {(event.timestamp || event.date) && new Date(event.timestamp || event.date!).toLocaleString("es-ES")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default async function TrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, status, description, client_name, tracking_token, client_email, google_drive_folder_id, design_visible, design_approved_at, deliverable_visible, deliverable_approved_at, payment_confirmed_at")
    .eq("tracking_token", token)
    .single();

  if (!project) {
    notFound();
  }

  const [{ data: items }, { data: shipping }] = await Promise.all([
    supabase
      .from("project_items")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("shipping_info")
      .select("*")
      .eq("project_id", project.id)
      .single(),
  ]);

  // Fetch tracking events if a shipment exists
  let trackingEvents: TrackingEvent[] = [];
  const shippingRow = shipping as Record<string, unknown> | null;
  const glsBarcode = shippingRow?.gls_barcode as string | null;

  if (shipping?.carrier === "GLS" && glsBarcode) {
    try {
      const events = await getGlsTracking(glsBarcode);
      trackingEvents = events.map((e) => ({
        description: e.description,
        date: e.date,
        city: e.city,
      }));
    } catch {
      // Tracking may not be available
    }
  } else if (shipping?.packlink_shipment_ref) {
    try {
      const trackingData = await getTracking(shipping.packlink_shipment_ref);
      trackingEvents = trackingData.history ?? [];
    } catch {
      // Tracking may not be available
    }
  }

  // Check client verification
  const verifiedEmail = await getVerifiedClient(project.id);
  const isVerified = !!verifiedEmail;

  const currentStatusColor =
    STATUS_COLORS[project.status] ?? STATUS_COLORS.pending;

  const totalItems = items?.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
  const completedItems = items?.reduce((sum, i) => sum + i.completed, 0) ?? 0;
  const overallPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-dark.png" alt="Prototipalo" className="hidden h-20 dark:block" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-light.png" alt="Prototipalo" className="block h-20 dark:hidden" />
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            Seguimiento de proyecto
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {/* Project name + status badge */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {project.name}
            </h1>
            {project.description && (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {project.description}
              </p>
            )}
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${currentStatusColor}`}
          >
            {STATUSES.find((s) => s.value === project.status)?.label ??
              project.status}
          </span>
        </div>

        {/* Overall progress */}
        {totalItems > 0 && (
          <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-zinc-900 dark:text-white">
                Progreso general
              </span>
              <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                {overallPct}%
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div
                className={`h-full rounded-full transition-all ${
                  overallPct === 100 ? "bg-green-500" : "bg-blue-500"
                }`}
                style={{ width: `${overallPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Pipeline */}
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
            Estado
          </h2>
          <Pipeline currentStatus={project.status} />
        </div>

        {/* Items */}
        {items && items.length > 0 && (
          <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
              Piezas
            </h2>
            <div className="space-y-3">
              {items.map((item) => (
                <ItemProgress key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* Client Portal (Briefing, Diseño, Entregable) */}
        {project.google_drive_folder_id && (
          <div className="mb-6">
            <ClientPortal
              token={token}
              projectId={project.id}
              clientEmail={project.client_email}
              hasDriveFolder={!!project.google_drive_folder_id}
              isVerified={isVerified}
              designVisible={project.design_visible}
              designApprovedAt={project.design_approved_at}
              deliverableVisible={project.deliverable_visible}
              deliverableApprovedAt={project.deliverable_approved_at}
              paymentConfirmedAt={project.payment_confirmed_at}
            />
          </div>
        )}

        {/* Shipping */}
        {shipping && <div className="mb-6"><ShippingCard shipping={shipping} trackingEvents={trackingEvents} glsBarcode={glsBarcode} /></div>}
      </main>

      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        Prototipalo &mdash; Taller de producción
      </footer>
    </div>
  );
}
