"use client";

import { useState, useEffect, useRef } from "react";
import type { Tables } from "@/lib/supabase/database.types";
import type { PacklinkService, PacklinkTrackingEvent } from "@/lib/packlink/types";

interface GlsTrackingEvent {
  date: string;
  description: string;
  city?: string;
}

type TrackingEvent = PacklinkTrackingEvent | GlsTrackingEvent;
type ShipmentRow = Tables<"shipping_info"> & { gls_barcode?: string | null; cabify_parcel_id?: string | null };
import { PackageListEditor, createEmptyPackage, type PackageItem } from "@/components/box-preset-selector";
import { SENDER_ADDRESS } from "@/lib/packlink/sender";

const GLS_SERVICES = [
  { id: "business24", name: "BusinessParcel 24H", delivery: "24h" },
  { id: "express14", name: "Express14", delivery: "Antes de las 14:00" },
  { id: "express1030", name: "Express 10:30", delivery: "Antes de las 10:30" },
  { id: "express830", name: "Express 8:30", delivery: "Antes de las 8:30" },
  { id: "economy", name: "EconomyParcel 48-72H", delivery: "48-72h" },
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
  shippingInfo: ShipmentRow | null;
  holdedContact: {
    name?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    billAddress?: HoldedContactAddress;
  } | null;
}

export function ProjectShipping({ projectId, shippingInfo, holdedContact }: ProjectShippingProps) {
  // Determine initial step based on existing data
  const getInitialStep = () => {
    if (shippingInfo?.packlink_shipment_ref || shippingInfo?.gls_barcode || shippingInfo?.cabify_parcel_id) return "created" as const;
    return "idle" as const;
  };

  const [step, setStep] = useState<"idle" | "form" | "selecting" | "creating" | "created">(getInitialStep);
  const [carrier, setCarrier] = useState<"packlink" | "gls" | "cabify">(
    shippingInfo?.carrier === "Cabify" ? "cabify" : shippingInfo?.carrier === "GLS" ? "gls" : shippingInfo?.packlink_shipment_ref ? "packlink" : "gls",
  );
  const [services, setServices] = useState<PacklinkService[]>([]);
  const [selectedService, setSelectedService] = useState<PacklinkService | null>(null);
  const [tracking, setTracking] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentShipping, setCurrentShipping] = useState<ShipmentRow | null>(shippingInfo);

  const isGls = currentShipping?.carrier === "GLS";
  const isCabify = currentShipping?.carrier === "Cabify";
  const hasRef = isGls ? !!currentShipping?.gls_barcode : isCabify ? !!currentShipping?.cabify_parcel_id : !!currentShipping?.packlink_shipment_ref;
  const [glsServiceId, setGlsServiceId] = useState("business24");
  const [glsPrices, setGlsPrices] = useState<Record<string, { price: number; zone: string; service: string; horario: string }>>({});
  const glsPriceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [cabifyEstimate, setCabifyEstimate] = useState<{ amount: number; currency: string } | null>(null);
  const cabifyEstimateRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Form state — pre-fill from Holded contact (split name into first + surname)
  const [recipientName, setRecipientName] = useState(() => {
    const parts = (holdedContact?.name ?? "").split(" ");
    return parts[0] || "";
  });
  const [recipientSurname, setRecipientSurname] = useState(() => {
    const parts = (holdedContact?.name ?? "").split(" ");
    return parts.slice(1).join(" ") || "";
  });
  const [recipientEmail, setRecipientEmail] = useState(
    holdedContact?.email ?? "",
  );
  const [recipientPhone, setRecipientPhone] = useState(
    holdedContact?.phone || holdedContact?.mobile || "",
  );
  const [street, setStreet] = useState(
    holdedContact?.billAddress?.address ?? "",
  );
  const [city, setCity] = useState(
    holdedContact?.billAddress?.city ?? "",
  );
  const [postalCode, setPostalCode] = useState(
    holdedContact?.billAddress?.postalCode ?? "",
  );
  const [country, setCountry] = useState(
    holdedContact?.billAddress?.countryCode ?? "ES",
  );
  const [packages, setPackages] = useState<PackageItem[]>([createEmptyPackage()]);

  // Fetch tracking when shipment exists
  useEffect(() => {
    if (step === "created") {
      if (currentShipping?.carrier === "GLS" && currentShipping?.gls_barcode) {
        fetchGlsTracking(currentShipping.gls_barcode);
      } else if (currentShipping?.carrier === "Cabify" && currentShipping?.cabify_parcel_id) {
        fetchCabifyTracking(currentShipping.cabify_parcel_id);
      } else if (currentShipping?.packlink_shipment_ref) {
        fetchPacklinkTracking(currentShipping.packlink_shipment_ref);
      }
    }
  }, [currentShipping?.packlink_shipment_ref, currentShipping?.gls_barcode, currentShipping?.cabify_parcel_id, currentShipping?.carrier, step]);

  // Estimate Cabify price
  useEffect(() => {
    if (carrier !== "cabify" || !street || !city || !postalCode) {
      setCabifyEstimate(null);
      return;
    }
    if (cabifyEstimateRef.current) clearTimeout(cabifyEstimateRef.current);
    cabifyEstimateRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          dropoffAddress: street,
          dropoffCity: city,
          dropoffPostalCode: postalCode,
        });
        const res = await fetch(`/api/cabify/estimate?${params}`);
        if (res.ok) {
          const data = await res.json();
          setCabifyEstimate(data.price ?? null);
        } else {
          setCabifyEstimate(null);
        }
      } catch {
        setCabifyEstimate(null);
      }
    }, 500);
  }, [carrier, street, city, postalCode]);

  // Estimate GLS prices for all services
  useEffect(() => {
    if (carrier !== "gls" || !postalCode || !country) {
      setGlsPrices({});
      return;
    }
    const totalWeight = packages.reduce((sum, p) => sum + (Number(p.weight) || 0), 0);
    if (!totalWeight) { setGlsPrices({}); return; }

    if (glsPriceRef.current) clearTimeout(glsPriceRef.current);
    glsPriceRef.current = setTimeout(async () => {
      try {
        const firstPkg = packages[0];
        const params = new URLSearchParams({
          weight: String(totalWeight),
          postalCode,
          country,
          all: "true",
          ...(firstPkg.width ? { width: firstPkg.width } : {}),
          ...(firstPkg.height ? { height: firstPkg.height } : {}),
          ...(firstPkg.length ? { length: firstPkg.length } : {}),
        });
        const res = await fetch(`/api/gls/price?${params}`);
        if (res.ok) setGlsPrices(await res.json());
        else setGlsPrices({});
      } catch {
        setGlsPrices({});
      }
    }, 300);
  }, [carrier, postalCode, country, packages]);

  async function fetchPacklinkTracking(ref: string) {
    try {
      const res = await fetch(`/api/packlink/shipments/${ref}/tracking`);
      if (res.ok) {
        const data = await res.json();
        setTracking(data.history ?? []);
      }
    } catch {
      // Tracking may not be available yet
    }
  }

  async function fetchGlsTracking(barcode: string) {
    try {
      const res = await fetch(`/api/gls/shipments/${barcode}/tracking`);
      if (res.ok) {
        const data = await res.json();
        setTracking(data.events ?? []);
      }
    } catch {
      // Tracking may not be available yet
    }
  }

  async function fetchCabifyTracking(parcelId: string) {
    try {
      const res = await fetch(`/api/cabify/shipments/${parcelId}/tracking`);
      if (res.ok) {
        const data = await res.json();
        setTracking(data.events ?? []);
      }
    } catch {
      // Tracking may not be available yet
    }
  }

  function refreshTracking() {
    if (currentShipping?.carrier === "GLS" && currentShipping?.gls_barcode) {
      fetchGlsTracking(currentShipping.gls_barcode);
    } else if (currentShipping?.carrier === "Cabify" && currentShipping?.cabify_parcel_id) {
      fetchCabifyTracking(currentShipping.cabify_parcel_id);
    } else if (currentShipping?.packlink_shipment_ref) {
      fetchPacklinkTracking(currentShipping.packlink_shipment_ref);
    }
  }

  async function searchServices() {
    setLoading(true);
    setError(null);

    try {
      const firstPkg = packages[0];
      const params = new URLSearchParams({
        fromZip: SENDER_ADDRESS.zip_code,
        fromCountry: SENDER_ADDRESS.country,
        toZip: postalCode,
        toCountry: country,
        width: firstPkg.width,
        height: firstPkg.height,
        length: firstPkg.length,
        weight: firstPkg.weight,
      });

      const res = await fetch(`/api/packlink/services?${params}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch services");
      }

      const data = await res.json();
      setServices(data);
      setStep("selecting");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching services");
    } finally {
      setLoading(false);
    }
  }

  async function createCabifyShipment() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/cabify/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          recipientName: `${recipientName} ${recipientSurname}`.trim(),
          recipientPhone: recipientPhone || undefined,
          recipientEmail: recipientEmail || undefined,
          street,
          city,
          postalCode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create Cabify shipment");
      }

      const data = await res.json();
      setCurrentShipping({
        ...currentShipping,
        id: currentShipping?.id ?? "",
        project_id: projectId,
        cabify_parcel_id: data.parcelId,
        carrier: "Cabify",
        address_line: street,
        city,
        postal_code: postalCode,
        country: "ES",
        recipient_name: `${recipientName} ${recipientSurname}`.trim(),
        recipient_phone: recipientPhone,
        recipient_email: recipientEmail,
        shipment_status: "pending",
        shipped_at: new Date().toISOString(),
        tracking_number: data.trackingUrl ?? null,
        gls_barcode: null,
        packlink_shipment_ref: null,
        packlink_order_ref: null,
        service_id: null,
        service_name: null,
        price: null,
        label_url: null,
        notes: null,
        delivered_at: null,
        title: null,
        content_description: null,
        declared_value: null,
        package_width: null,
        package_height: null,
        package_length: null,
        package_weight: null,
        created_at: null,
        created_by: null,
      });
      setStep("created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating Cabify shipment");
    } finally {
      setLoading(false);
    }
  }

  async function createGlsShipment() {
    setLoading(true);
    setError(null);

    try {
      const totalWeight = packages.reduce((sum, p) => sum + Number(p.weight), 0);
      const firstPkg = packages[0];

      const res = await fetch("/api/gls/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          recipientName: `${recipientName} ${recipientSurname}`.trim(),
          recipientAddress: street,
          recipientCity: city,
          recipientPostalCode: postalCode,
          recipientCountry: country,
          recipientPhone: recipientPhone || undefined,
          recipientEmail: recipientEmail || undefined,
          packages: packages.length,
          weight: totalWeight,
          packageWidth: Number(firstPkg.width),
          packageHeight: Number(firstPkg.height),
          packageLength: Number(firstPkg.length),
          horario: glsPrices[glsServiceId]?.horario || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create GLS shipment");
      }

      const data = await res.json();
      setCurrentShipping({
        ...currentShipping,
        id: currentShipping?.id ?? "",
        project_id: projectId,
        gls_barcode: data.barcode,
        carrier: "GLS",
        label_url: data.labelUrl,
        address_line: street,
        city,
        postal_code: postalCode,
        country,
        recipient_name: `${recipientName} ${recipientSurname}`.trim(),
        recipient_phone: recipientPhone,
        recipient_email: recipientEmail,
        package_width: Number(firstPkg.width),
        package_height: Number(firstPkg.height),
        package_length: Number(firstPkg.length),
        package_weight: totalWeight,
        shipment_status: "pending",
        shipped_at: new Date().toISOString(),
        packlink_shipment_ref: null,
        packlink_order_ref: null,
        service_id: null,
        service_name: null,
        price: null,
        notes: null,
        delivered_at: null,
        tracking_number: null,
        title: null,
        content_description: null,
        declared_value: null,
        created_at: null,
        created_by: null,
      });
      setStep("created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating GLS shipment");
    } finally {
      setLoading(false);
    }
  }

  async function createShipment() {
    if (!selectedService) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/packlink/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          serviceId: selectedService.id,
          serviceName: `${selectedService.carrier_name} - ${selectedService.name}`,
          from: SENDER_ADDRESS,
          to: {
            name: recipientName,
            surname: recipientSurname,
            email: recipientEmail,
            phone: recipientPhone,
            street1: street,
            city,
            zip_code: postalCode,
            country,
          },
          packages: packages.map((p) => ({
            width: Number(p.width),
            height: Number(p.height),
            length: Number(p.length),
            weight: Number(p.weight),
          })),
          content: "3D printed parts",
          contentvalue: 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create shipment");
      }

      const data = await res.json();
      setCurrentShipping({
        ...currentShipping,
        id: currentShipping?.id ?? "",
        project_id: projectId,
        packlink_shipment_ref: data.reference,
        service_name: `${selectedService.carrier_name} - ${selectedService.name}`,
        carrier: `${selectedService.carrier_name} - ${selectedService.name}`,
        price: selectedService.price.total_price,
        address_line: street,
        city,
        postal_code: postalCode,
        country,
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        recipient_email: recipientEmail,
        package_width: Number(packages[0].width),
        package_height: Number(packages[0].height),
        package_length: Number(packages[0].length),
        package_weight: Number(packages[0].weight),
        shipment_status: "pending",
        shipped_at: new Date().toISOString(),
        packlink_order_ref: null,
        service_id: selectedService.id,
        label_url: null,
        notes: null,
        delivered_at: null,
        tracking_number: null,
        title: null,
        content_description: null,
        declared_value: null,
        created_at: null,
        created_by: null,
      });
      setStep("created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating shipment");
    } finally {
      setLoading(false);
    }
  }

  async function downloadLabel() {
    if (isCabify) {
      // Cabify doesn't provide downloadable labels — open tracking URL if available
      if (currentShipping?.tracking_number) {
        window.open(currentShipping.tracking_number, "_blank");
      }
      return;
    }

    if (isGls) {
      const barcode = currentShipping?.gls_barcode;
      if (!barcode) return;
      window.open(`/api/gls/shipments/${barcode}/label`, "_blank");
      return;
    }

    if (!currentShipping?.packlink_shipment_ref) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/packlink/shipments/${currentShipping.packlink_shipment_ref}/labels`,
      );
      if (res.ok) {
        const labels = await res.json();
        if (labels.length > 0 && labels[0].url) {
          window.open(labels[0].url, "_blank");
        }
      }
    } catch {
      setError("Error fetching labels");
    } finally {
      setLoading(false);
    }
  }

  // State 1: No shipment — show button
  if (step === "idle") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
          <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Shipping
        </h2>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          No shipment configured for this project yet.
        </p>
        <button
          onClick={() => setStep("form")}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-zinc-900"
        >
          Prepare shipment
        </button>
      </div>
    );
  }

  // State 2: Form
  if (step === "form") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
          <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Shipping details
        </h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Carrier selector */}
          <div>
            <p className="mb-2 text-xs font-medium text-zinc-500 uppercase dark:text-zinc-400">Carrier</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCarrier("gls")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  carrier === "gls"
                    ? "border-cyan-500 bg-cyan-50 text-cyan-700 dark:border-cyan-400 dark:bg-cyan-900/20 dark:text-cyan-300"
                    : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600"
                }`}
              >
                GLS
              </button>
              <button
                type="button"
                onClick={() => setCarrier("packlink")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  carrier === "packlink"
                    ? "border-cyan-500 bg-cyan-50 text-cyan-700 dark:border-cyan-400 dark:bg-cyan-900/20 dark:text-cyan-300"
                    : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600"
                }`}
              >
                Packlink
              </button>
              <button
                type="button"
                onClick={() => setCarrier("cabify")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  carrier === "cabify"
                    ? "border-cyan-500 bg-cyan-50 text-cyan-700 dark:border-cyan-400 dark:bg-cyan-900/20 dark:text-cyan-300"
                    : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600"
                }`}
              >
                Cabify
              </button>
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
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">Rellena la dirección destino para ver precio</p>
              )}
            </div>
          )}

          {/* GLS service selector */}
          {carrier === "gls" && (
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500 uppercase dark:text-zinc-400">GLS Service</p>
              <div className="space-y-2">
                {GLS_SERVICES.map((svc) => {
                  const price = glsPrices[svc.id];
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => setGlsServiceId(svc.id)}
                      className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                        glsServiceId === svc.id
                          ? "border-cyan-500 bg-cyan-50 text-cyan-700 dark:border-cyan-400 dark:bg-cyan-900/20 dark:text-cyan-300"
                          : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600"
                      }`}
                    >
                      <div>
                        <span className="font-medium">{svc.name}</span>
                        <br />
                        <span className="text-xs opacity-70">{svc.delivery}</span>
                      </div>
                      {price && (
                        <span className={`text-sm font-semibold tabular-nums ${
                          glsServiceId === svc.id ? "text-cyan-700 dark:text-cyan-300" : "text-zinc-900 dark:text-white"
                        }`}>
                          {price.price.toFixed(2)} €
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recipient */}
          <div>
            <p className="mb-2 text-xs font-medium text-zinc-500 uppercase dark:text-zinc-400">Recipient</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="First name"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <input
                type="text"
                placeholder="Surname"
                value={recipientSurname}
                onChange={(e) => setRecipientSurname(e.target.value)}
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <input
                type="email"
                placeholder="Email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <input
                type="tel"
                placeholder="Phone"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <p className="mb-2 text-xs font-medium text-zinc-500 uppercase dark:text-zinc-400">Destination address</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Street address"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white sm:col-span-2"
              />
              <input
                type="text"
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <input
                type="text"
                placeholder="Postal code"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <input
                type="text"
                placeholder="Country code (ES, FR…)"
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                maxLength={2}
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
          </div>

          {/* Packages (not needed for Cabify) */}
          {carrier !== "cabify" && (
            <PackageListEditor
              packages={packages}
              onChange={setPackages}
              inputClass="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => setStep("idle")}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={
              carrier === "cabify"
                ? createCabifyShipment
                : carrier === "gls"
                  ? createGlsShipment
                  : searchServices
            }
            disabled={
              loading ||
              !postalCode ||
              !country ||
              (carrier !== "cabify" && packages.some((p) => !p.width || !p.height || !p.length || !p.weight))
            }
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50 dark:focus:ring-offset-zinc-900"
          >
            {loading
              ? carrier === "cabify" ? "Creating…" : carrier === "gls" ? "Creating…" : "Searching…"
              : carrier === "cabify" ? "Crear envio Cabify" : carrier === "gls" ? "Crear envio GLS" : "Search carriers"}
          </button>
        </div>
      </div>
    );
  }

  // State 3: Select carrier
  if (step === "selecting") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
          <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Select carrier
        </h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {services.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No shipping services available for this route.
          </p>
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
            onClick={() => { setStep("form"); setServices([]); setSelectedService(null); }}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Back
          </button>
          <button
            onClick={createShipment}
            disabled={loading || !selectedService}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50 dark:focus:ring-offset-zinc-900"
          >
            {loading ? "Creating…" : "Create shipment"}
          </button>
        </div>
      </div>
    );
  }

  // State 4: Shipment created
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
        <svg className="h-4 w-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Shipment
      </h2>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {(currentShipping?.packlink_shipment_ref || currentShipping?.gls_barcode || currentShipping?.cabify_parcel_id) && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">{isGls ? "GLS Barcode" : isCabify ? "Cabify Parcel" : "Reference"}</span>
            <span className="font-mono font-medium text-zinc-900 dark:text-white">
              {isGls ? currentShipping?.gls_barcode : isCabify ? currentShipping?.cabify_parcel_id : currentShipping?.packlink_shipment_ref}
            </span>
          </div>
        )}
        {currentShipping?.carrier && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Carrier</span>
            <span className="font-medium text-zinc-900 dark:text-white">{currentShipping.carrier}</span>
          </div>
        )}
        {currentShipping?.price != null && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Price</span>
            <span className="font-medium text-zinc-900 dark:text-white">
              {Number(currentShipping.price).toFixed(2)} EUR
            </span>
          </div>
        )}
        {currentShipping?.shipment_status && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Status</span>
            <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
              {currentShipping.shipment_status}
            </span>
          </div>
        )}
        {currentShipping?.tracking_number && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Tracking</span>
            <span className="font-mono font-medium text-zinc-900 dark:text-white">
              {currentShipping.tracking_number}
            </span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">Destination</span>
          <span className="text-right font-medium text-zinc-900 dark:text-white">
            {[currentShipping?.address_line, currentShipping?.postal_code, currentShipping?.city, currentShipping?.country]
              .filter(Boolean)
              .join(", ")}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={downloadLabel}
          disabled={loading || !hasRef}
          className="rounded-lg border border-cyan-300 px-3 py-1.5 text-sm font-medium text-cyan-700 hover:bg-cyan-50 disabled:opacity-50 dark:border-cyan-800 dark:text-cyan-400 dark:hover:bg-cyan-900/20"
        >
          {loading ? "Loading…" : "Download label"}
        </button>
        <button
          onClick={refreshTracking}
          disabled={!hasRef}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Refresh tracking
        </button>
      </div>

      {/* Tracking timeline */}
      {tracking.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-xs font-medium text-zinc-500 uppercase dark:text-zinc-400">Tracking</p>
          <div className="space-y-3">
            {tracking.map((event, i) => {
              const eventDate = "timestamp" in event ? event.timestamp : (event as GlsTrackingEvent).date;
              const eventCity = "city" in event ? event.city : undefined;
              return (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`h-2.5 w-2.5 rounded-full ${i === 0 ? "bg-cyan-500" : "bg-zinc-300 dark:bg-zinc-600"}`} />
                    {i < tracking.length - 1 && <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-700" />}
                  </div>
                  <div className="pb-3">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{event.description}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
  );
}
