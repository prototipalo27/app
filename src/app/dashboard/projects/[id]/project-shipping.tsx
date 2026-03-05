"use client";

import { useState, useEffect, useRef } from "react";
import type { Tables } from "@/lib/supabase/database.types";
import type { PacklinkService, PacklinkTrackingEvent } from "@/lib/packlink/types";
import { saveClientAddress } from "./address-actions";

interface GlsTrackingEvent {
  date: string;
  description: string;
  city?: string;
}

type TrackingEvent = PacklinkTrackingEvent | GlsTrackingEvent;
type ShipmentRow = Tables<"shipping_info">;
type ClientAddress = Tables<"client_addresses">;

import { PackageListEditor, createEmptyPackage, type PackageItem } from "@/components/box-preset-selector";
import { SENDER_ADDRESS } from "@/lib/packlink/sender";

const MRW_SERVICES = [
  { id: "0000", name: "MRW Urgente 19h", delivery: "Entrega antes de las 19:00", code: "0000" },
  { id: "0005", name: "MRW Urgente 14h", delivery: "Entrega antes de las 14:00", code: "0005" },
  { id: "0010", name: "MRW Urgente 10h", delivery: "Entrega antes de las 10:00", code: "0010" },
] as const;

interface HoldedContactAddress {
  address?: string;
  city?: string;
  postalCode?: string;
  province?: string;
  country?: string;
  countryCode?: string;
}

interface ProjectShippingProps {
  projectId: string;
  shipments: ShipmentRow[];
  holdedContact: {
    name?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    billAddress?: HoldedContactAddress;
  } | null;
  holdedContactId: string | null;
  savedAddresses: ClientAddress[];
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  in_transit: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  delivered: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  DELIVERED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  created: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
};

// ─── Individual shipment card (collapsible) ─────────────────────────

function ShipmentCard({ shipment }: { shipment: ShipmentRow }) {
  const [open, setOpen] = useState(false);
  const [tracking, setTracking] = useState<TrackingEvent[]>([]);

  const isMrw = shipment.carrier === "MRW";
  const isGls = shipment.carrier === "GLS";
  const isCabify = shipment.carrier === "Cabify";
  const ref = isMrw ? shipment.mrw_albaran : isGls ? shipment.gls_barcode : isCabify ? shipment.cabify_parcel_id : shipment.packlink_shipment_ref;

  async function fetchTracking() {
    try {
      if (isMrw && shipment.mrw_albaran) {
        const res = await fetch(`/api/mrw/shipments/${shipment.mrw_albaran}/tracking`);
        if (res.ok) setTracking((await res.json()).events ?? []);
      } else if (isGls && shipment.gls_barcode) {
        const res = await fetch(`/api/gls/shipments/${shipment.gls_barcode}/tracking`);
        if (res.ok) setTracking((await res.json()).events ?? []);
      } else if (isCabify && shipment.cabify_parcel_id) {
        const res = await fetch(`/api/cabify/shipments/${shipment.cabify_parcel_id}/tracking`);
        if (res.ok) setTracking((await res.json()).events ?? []);
      } else if (shipment.packlink_shipment_ref) {
        const res = await fetch(`/api/packlink/shipments/${shipment.packlink_shipment_ref}/tracking`);
        if (res.ok) setTracking((await res.json()).history ?? []);
      }
    } catch {
      // Tracking may not be available yet
    }
  }

  useEffect(() => {
    if (open && tracking.length === 0 && ref) fetchTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function downloadLabel() {
    if (isMrw && shipment.mrw_albaran) {
      window.open(`/api/mrw/shipments/${shipment.mrw_albaran}/label`, "_blank");
    } else if (isCabify && shipment.tracking_number) {
      window.open(shipment.tracking_number, "_blank");
    } else if (isGls && shipment.gls_barcode) {
      window.open(`/api/gls/shipments/${shipment.gls_barcode}/label`, "_blank");
    } else if (shipment.packlink_shipment_ref) {
      fetch(`/api/packlink/shipments/${shipment.packlink_shipment_ref}/labels`)
        .then((r) => r.json())
        .then((labels) => {
          if (labels.length > 0 && labels[0].url) window.open(labels[0].url, "_blank");
        })
        .catch(() => {});
    }
  }

  const statusClass = STATUS_BADGE[shipment.shipment_status ?? "pending"] ?? STATUS_BADGE.pending;
  const dest = [shipment.address_line, shipment.postal_code, shipment.city].filter(Boolean).join(", ");

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
            isMrw ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            : isGls ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            : isCabify ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
          }`}>
            {isMrw ? "MRW" : isGls ? "GLS" : isCabify ? "Cabify" : "Packlink"}
          </span>
          <span className="truncate text-sm font-medium text-zinc-900 dark:text-white">{dest || "—"}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass}`}>
            {shipment.shipment_status ?? "pending"}
          </span>
          <svg className={`h-4 w-4 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <div className="space-y-1.5">
            {ref && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">{isMrw ? "MRW Albaran" : isGls ? "GLS Barcode" : isCabify ? "Parcel ID" : "Reference"}</span>
                <span className="font-mono font-medium text-zinc-900 dark:text-white">{ref}</span>
              </div>
            )}
            {shipment.carrier && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Carrier</span>
                <span className="font-medium text-zinc-900 dark:text-white">{shipment.carrier}</span>
              </div>
            )}
            {shipment.recipient_name && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Recipient</span>
                <span className="font-medium text-zinc-900 dark:text-white">{shipment.recipient_name}</span>
              </div>
            )}
            {shipment.price != null && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Price</span>
                <span className="font-medium text-zinc-900 dark:text-white">{Number(shipment.price).toFixed(2)} EUR</span>
              </div>
            )}
            {shipment.tracking_number && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Tracking</span>
                <span className="font-mono font-medium text-zinc-900 dark:text-white">{shipment.tracking_number}</span>
              </div>
            )}
            {shipment.shipped_at && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Shipped</span>
                <span className="text-zinc-900 dark:text-white">{new Date(shipment.shipped_at).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={downloadLabel}
              disabled={!ref}
              className="rounded-lg border border-cyan-300 px-3 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-50 disabled:opacity-50 dark:border-cyan-800 dark:text-cyan-400 dark:hover:bg-cyan-900/20"
            >
              Download label
            </button>
            <button
              onClick={fetchTracking}
              disabled={!ref}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Refresh tracking
            </button>
          </div>

          {tracking.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-zinc-500 uppercase dark:text-zinc-400">Tracking</p>
              <div className="space-y-2">
                {tracking.map((event, i) => {
                  const eventDate = "timestamp" in event ? event.timestamp : (event as GlsTrackingEvent).date;
                  const eventCity = "city" in event ? event.city : undefined;
                  return (
                    <div key={i} className="flex gap-2.5">
                      <div className="flex flex-col items-center">
                        <div className={`h-2 w-2 rounded-full ${i === 0 ? "bg-cyan-500" : "bg-zinc-300 dark:bg-zinc-600"}`} />
                        {i < tracking.length - 1 && <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-700" />}
                      </div>
                      <div className="pb-2">
                        <p className="text-xs font-medium text-zinc-900 dark:text-white">{event.description}</p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          {eventCity && `${eventCity} · `}
                          {new Date(eventDate).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────

export function ProjectShipping({ projectId, shipments: initialShipments, holdedContact, holdedContactId, savedAddresses: initialAddresses }: ProjectShippingProps) {
  const [shipmentList, setShipmentList] = useState<ShipmentRow[]>(initialShipments);
  const [addresses, setAddresses] = useState<ClientAddress[]>(initialAddresses);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [carrier, setCarrier] = useState<"packlink" | "mrw" | "cabify">("mrw");
  const [services, setServices] = useState<PacklinkService[]>([]);
  const [selectedService, setSelectedService] = useState<PacklinkService | null>(null);
  const [formStep, setFormStep] = useState<"form" | "selecting">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mrwServiceId, setMrwServiceId] = useState("0000");
  const [cabifyEstimate, setCabifyEstimate] = useState<{ amount: number; currency: string } | null>(null);
  const cabifyEstimateRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Address picker
  const [selectedAddressId, setSelectedAddressId] = useState<string>("new");
  const [saveAddr, setSaveAddr] = useState(false);
  const [addrLabel, setAddrLabel] = useState("");

  // Recipient / address fields
  const [recipientName, setRecipientName] = useState(() => {
    const parts = (holdedContact?.name ?? "").split(" ");
    return parts[0] || "";
  });
  const [recipientSurname, setRecipientSurname] = useState(() => {
    const parts = (holdedContact?.name ?? "").split(" ");
    return parts.slice(1).join(" ") || "";
  });
  const [recipientEmail, setRecipientEmail] = useState(holdedContact?.email ?? "");
  const [recipientPhone, setRecipientPhone] = useState(holdedContact?.phone || holdedContact?.mobile || "");
  const [street, setStreet] = useState(holdedContact?.billAddress?.address ?? "");
  const [city, setCity] = useState(holdedContact?.billAddress?.city ?? "");
  const [postalCode, setPostalCode] = useState(holdedContact?.billAddress?.postalCode ?? "");
  const [country, setCountry] = useState(holdedContact?.billAddress?.countryCode ?? "ES");
  const [packages, setPackages] = useState<PackageItem[]>([createEmptyPackage()]);

  // Fill form from saved address
  function applyAddress(addrId: string) {
    setSelectedAddressId(addrId);
    if (addrId === "new") {
      // Reset to Holded contact defaults
      const parts = (holdedContact?.name ?? "").split(" ");
      setRecipientName(parts[0] || "");
      setRecipientSurname(parts.slice(1).join(" ") || "");
      setRecipientEmail(holdedContact?.email ?? "");
      setRecipientPhone(holdedContact?.phone || holdedContact?.mobile || "");
      setStreet(holdedContact?.billAddress?.address ?? "");
      setCity(holdedContact?.billAddress?.city ?? "");
      setPostalCode(holdedContact?.billAddress?.postalCode ?? "");
      setCountry(holdedContact?.billAddress?.countryCode ?? "ES");
      return;
    }
    const addr = addresses.find((a) => a.id === addrId);
    if (!addr) return;
    const parts = (addr.recipient_name ?? "").split(" ");
    setRecipientName(parts[0] || "");
    setRecipientSurname(parts.slice(1).join(" ") || "");
    setRecipientEmail(addr.recipient_email ?? "");
    setRecipientPhone(addr.recipient_phone ?? "");
    setStreet(addr.address_line ?? "");
    setCity(addr.city ?? "");
    setPostalCode(addr.postal_code ?? "");
    setCountry(addr.country ?? "ES");
  }

  // Estimate Cabify price
  useEffect(() => {
    if (carrier !== "cabify" || !street || !city || !postalCode) { setCabifyEstimate(null); return; }
    if (cabifyEstimateRef.current) clearTimeout(cabifyEstimateRef.current);
    cabifyEstimateRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ dropoffAddress: street, dropoffCity: city, dropoffPostalCode: postalCode });
        const res = await fetch(`/api/cabify/estimate?${params}`);
        if (res.ok) { setCabifyEstimate((await res.json()).price ?? null); } else { setCabifyEstimate(null); }
      } catch { setCabifyEstimate(null); }
    }, 500);
  }, [carrier, street, city, postalCode]);

  // (GLS price estimation removed — MRW is now the default carrier)

  // Save address if checkbox ticked
  async function maybeSaveAddress() {
    if (!saveAddr || !holdedContactId) return;
    const result = await saveClientAddress({
      holdedContactId,
      label: addrLabel || undefined,
      recipientName: `${recipientName} ${recipientSurname}`.trim() || undefined,
      recipientPhone: recipientPhone || undefined,
      recipientEmail: recipientEmail || undefined,
      addressLine: street || undefined,
      city: city || undefined,
      postalCode: postalCode || undefined,
      country: country || undefined,
    });
    if (result.success && result.data) {
      setAddresses((prev) => [result.data, ...prev]);
    }
  }

  async function searchServices() {
    setLoading(true); setError(null);
    try {
      const firstPkg = packages[0];
      const params = new URLSearchParams({
        fromZip: SENDER_ADDRESS.zip_code, fromCountry: SENDER_ADDRESS.country,
        toZip: postalCode, toCountry: country,
        width: firstPkg.width, height: firstPkg.height, length: firstPkg.length, weight: firstPkg.weight,
      });
      const res = await fetch(`/api/packlink/services?${params}`);
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Failed to fetch services"); }
      setServices(await res.json());
      setFormStep("selecting");
    } catch (err) { setError(err instanceof Error ? err.message : "Error fetching services"); }
    finally { setLoading(false); }
  }

  async function createCabifyShipment() {
    setLoading(true); setError(null);
    try {
      const addrId = selectedAddressId !== "new" ? selectedAddressId : undefined;
      const res = await fetch("/api/cabify/shipments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          recipientName: `${recipientName} ${recipientSurname}`.trim(),
          recipientPhone: recipientPhone || undefined,
          recipientEmail: recipientEmail || undefined,
          street, city, postalCode,
          addressId: addrId,
        }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Failed to create Cabify shipment"); }
      await maybeSaveAddress();
      // Reload page to get fresh shipments
      window.location.reload();
    } catch (err) { setError(err instanceof Error ? err.message : "Error creating Cabify shipment"); }
    finally { setLoading(false); }
  }

  async function createMrwShipment() {
    setLoading(true); setError(null);
    try {
      const totalWeight = packages.reduce((sum, p) => sum + Number(p.weight), 0);
      const firstPkg = packages[0];
      const addrId = selectedAddressId !== "new" ? selectedAddressId : undefined;
      const res = await fetch("/api/mrw/shipments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          recipientName: `${recipientName} ${recipientSurname}`.trim(),
          recipientAddress: street, recipientCity: city,
          recipientPostalCode: postalCode, recipientCountry: country,
          recipientPhone: recipientPhone || undefined, recipientEmail: recipientEmail || undefined,
          packages: packages.length, weight: totalWeight,
          packageWidth: Number(firstPkg.width), packageHeight: Number(firstPkg.height), packageLength: Number(firstPkg.length),
          service: mrwServiceId,
          addressId: addrId,
        }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Failed to create MRW shipment"); }
      await maybeSaveAddress();
      window.location.reload();
    } catch (err) { setError(err instanceof Error ? err.message : "Error creating MRW shipment"); }
    finally { setLoading(false); }
  }

  async function createPacklinkShipment() {
    if (!selectedService) return;
    setLoading(true); setError(null);
    try {
      const addrId = selectedAddressId !== "new" ? selectedAddressId : undefined;
      const res = await fetch("/api/packlink/shipments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          serviceId: selectedService.id,
          serviceName: `${selectedService.carrier_name} - ${selectedService.name}`,
          from: SENDER_ADDRESS,
          to: {
            name: recipientName, surname: recipientSurname,
            email: recipientEmail, phone: recipientPhone,
            street1: street, city, zip_code: postalCode, country,
          },
          packages: packages.map((p) => ({
            width: Number(p.width), height: Number(p.height),
            length: Number(p.length), weight: Number(p.weight),
          })),
          content: "3D printed parts", contentvalue: 0,
          addressId: addrId,
        }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Failed to create shipment"); }
      await maybeSaveAddress();
      window.location.reload();
    } catch (err) { setError(err instanceof Error ? err.message : "Error creating shipment"); }
    finally { setLoading(false); }
  }

  const inputClass = "block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white";

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
          <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Shipping
          {shipmentList.length > 0 && (
            <span className="ml-1 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {shipmentList.length}
            </span>
          )}
        </h2>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setFormStep("form"); setError(null); }}
            className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-700 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-zinc-900"
          >
            + Nuevo envio
          </button>
        )}
      </div>

      {/* Existing shipments list */}
      {shipmentList.length > 0 && (
        <div className="mb-4 space-y-2">
          {shipmentList.map((s) => (
            <ShipmentCard key={s.id} shipment={s} />
          ))}
        </div>
      )}

      {!showForm && shipmentList.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No hay envios configurados para este proyecto.
        </p>
      )}

      {/* ─── New shipment form ──────────────────────────────────────── */}
      {showForm && formStep === "form" && (
        <div className="rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
          <h3 className="mb-3 text-xs font-semibold text-zinc-700 uppercase dark:text-zinc-300">Nuevo envio</h3>

          {error && (
            <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Address picker */}
            {holdedContactId && addresses.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-zinc-500 uppercase dark:text-zinc-400">Direccion guardada</p>
                <select
                  value={selectedAddressId}
                  onChange={(e) => applyAddress(e.target.value)}
                  className={inputClass}
                >
                  <option value="new">Nueva direccion</option>
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label || [a.address_line, a.city, a.postal_code].filter(Boolean).join(", ")}
                      {a.is_default ? " (default)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Carrier selector */}
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500 uppercase dark:text-zinc-400">Carrier</p>
              <div className="flex gap-2">
                {(["mrw", "packlink", "cabify"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCarrier(c)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      carrier === c
                        ? "border-cyan-500 bg-cyan-50 text-cyan-700 dark:border-cyan-400 dark:bg-cyan-900/20 dark:text-cyan-300"
                        : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600"
                    }`}
                  >
                    {c === "mrw" ? "MRW" : c === "packlink" ? "Packlink" : "Cabify"}
                  </button>
                ))}
              </div>
            </div>

            {/* Cabify estimate */}
            {carrier === "cabify" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  Cabify — Courier urbano (solo Madrid)
                </p>
                {cabifyEstimate ? (
                  <p className="mt-1 text-sm font-semibold text-amber-800 dark:text-amber-300">
                    Precio estimado: {cabifyEstimate.amount.toFixed(2)} {cabifyEstimate.currency}
                  </p>
                ) : street && city && postalCode ? (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">Calculando precio…</p>
                ) : (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">Rellena la direccion destino para ver precio</p>
                )}
              </div>
            )}

            {/* MRW service selector */}
            {carrier === "mrw" && (
              <div>
                <p className="mb-2 text-xs font-medium text-zinc-500 uppercase dark:text-zinc-400">MRW Service</p>
                <div className="space-y-2">
                  {MRW_SERVICES.map((svc) => (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => setMrwServiceId(svc.id)}
                      className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                        mrwServiceId === svc.id
                          ? "border-cyan-500 bg-cyan-50 text-cyan-700 dark:border-cyan-400 dark:bg-cyan-900/20 dark:text-cyan-300"
                          : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600"
                      }`}
                    >
                      <div>
                        <span className="font-medium">{svc.name}</span>
                        <br />
                        <span className="text-xs opacity-70">{svc.delivery}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recipient */}
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500 uppercase dark:text-zinc-400">Recipient</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <input type="text" placeholder="First name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className={inputClass} />
                <input type="text" placeholder="Surname" value={recipientSurname} onChange={(e) => setRecipientSurname(e.target.value)} className={inputClass} />
                <input type="email" placeholder="Email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} className={inputClass} />
                <input type="tel" placeholder="Phone" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} className={inputClass} />
              </div>
            </div>

            {/* Address */}
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500 uppercase dark:text-zinc-400">Destination address</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <input type="text" placeholder="Street address" value={street} onChange={(e) => setStreet(e.target.value)} className={`${inputClass} sm:col-span-2`} />
                <input type="text" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
                <input type="text" placeholder="Postal code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={inputClass} />
                <input type="text" placeholder="Country code (ES, FR…)" value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} className={inputClass} />
              </div>
            </div>

            {/* Packages (not needed for Cabify) */}
            {carrier !== "cabify" && (
              <PackageListEditor packages={packages} onChange={setPackages} inputClass={inputClass} />
            )}

            {/* Save address checkbox */}
            {holdedContactId && selectedAddressId === "new" && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={saveAddr}
                    onChange={(e) => setSaveAddr(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-cyan-600 focus:ring-cyan-500 dark:border-zinc-600"
                  />
                  Guardar direccion para este cliente
                </label>
                {saveAddr && (
                  <input
                    type="text"
                    placeholder="Etiqueta (ej. Oficina Madrid)"
                    value={addrLabel}
                    onChange={(e) => setAddrLabel(e.target.value)}
                    className={inputClass}
                  />
                )}
              </div>
            )}
          </div>

          <div className="mt-5 flex gap-2">
            <button
              onClick={() => { setShowForm(false); setError(null); }}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              onClick={carrier === "cabify" ? createCabifyShipment : carrier === "mrw" ? createMrwShipment : searchServices}
              disabled={loading || !postalCode || !country || (carrier !== "cabify" && packages.some((p) => !p.width || !p.height || !p.length || !p.weight))}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50 dark:focus:ring-offset-zinc-900"
            >
              {loading
                ? carrier === "cabify" || carrier === "mrw" ? "Creando…" : "Buscando…"
                : carrier === "cabify" ? "Crear envio Cabify" : carrier === "mrw" ? "Crear envio MRW" : "Buscar transportistas"}
            </button>
          </div>
        </div>
      )}

      {/* ─── Packlink service selection ─────────────────────────────── */}
      {showForm && formStep === "selecting" && (
        <div className="rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
          <h3 className="mb-3 text-xs font-semibold text-zinc-700 uppercase dark:text-zinc-300">Seleccionar transportista</h3>

          {error && (
            <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</div>
          )}

          {services.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No hay servicios disponibles para esta ruta.</p>
          ) : (
            <div className="space-y-2">
              {services.map((service) => {
                const isSelected = selectedService?.id === service.id;
                return (
                  <button
                    key={service.id}
                    onClick={() => setSelectedService(service)}
                    className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                      isSelected
                        ? "border-cyan-500 bg-cyan-50 dark:border-cyan-400 dark:bg-cyan-900/20"
                        : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-medium ${isSelected ? "text-cyan-700 dark:text-cyan-300" : "text-zinc-900 dark:text-white"}`}>
                        {service.carrier_name} — {service.name}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {service.transit_days || service.transit_hours}
                        {service.delivery_to_parcelshop && " · Drop-off point"}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold ${isSelected ? "text-cyan-700 dark:text-cyan-300" : "text-zinc-900 dark:text-white"}`}>
                      {service.price.total_price.toFixed(2)} {service.price.currency}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <button
              onClick={() => { setFormStep("form"); setServices([]); setSelectedService(null); }}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Volver
            </button>
            <button
              onClick={createPacklinkShipment}
              disabled={loading || !selectedService}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50 dark:focus:ring-offset-zinc-900"
            >
              {loading ? "Creando…" : "Crear envio"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
