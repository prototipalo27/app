"use client";

import { useState, useEffect } from "react";
import type { Tables } from "@/lib/supabase/database.types";
import type { PacklinkService, PacklinkTrackingEvent } from "@/lib/packlink/types";

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
  shippingInfo: Tables<"shipping_info"> | null;
  holdedContact: {
    name?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    billAddress?: HoldedContactAddress;
  } | null;
}

// Sender address (workshop default)
const SENDER_ADDRESS = {
  name: "Prototipalo",
  street1: "Calle Viriato 27",
  city: "Madrid",
  zip_code: "28010",
  country: "ES",
  email: "",
  phone: "",
};

export function ProjectShipping({ projectId, shippingInfo, holdedContact }: ProjectShippingProps) {
  // Determine initial step based on existing data
  const getInitialStep = () => {
    if (shippingInfo?.packlink_shipment_ref) return "created" as const;
    return "idle" as const;
  };

  const [step, setStep] = useState<"idle" | "form" | "selecting" | "creating" | "created">(getInitialStep);
  const [services, setServices] = useState<PacklinkService[]>([]);
  const [selectedService, setSelectedService] = useState<PacklinkService | null>(null);
  const [tracking, setTracking] = useState<PacklinkTrackingEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentShipping, setCurrentShipping] = useState(shippingInfo);

  // Form state — pre-fill from Holded contact
  const [recipientName, setRecipientName] = useState(
    holdedContact?.name ?? "",
  );
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
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [length, setLength] = useState("");
  const [weight, setWeight] = useState("");

  // Fetch tracking when shipment exists
  useEffect(() => {
    if (currentShipping?.packlink_shipment_ref && step === "created") {
      fetchTracking(currentShipping.packlink_shipment_ref);
    }
  }, [currentShipping?.packlink_shipment_ref, step]);

  async function fetchTracking(ref: string) {
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

  async function searchServices() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        fromZip: SENDER_ADDRESS.zip_code,
        fromCountry: SENDER_ADDRESS.country,
        toZip: postalCode,
        toCountry: country,
        width,
        height,
        length,
        weight,
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
            email: recipientEmail,
            phone: recipientPhone,
            street1: street,
            city,
            zip_code: postalCode,
            country,
          },
          packages: [
            {
              width: Number(width),
              height: Number(height),
              length: Number(length),
              weight: Number(weight),
            },
          ],
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
        package_width: Number(width),
        package_height: Number(height),
        package_length: Number(length),
        package_weight: Number(weight),
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
          {/* Recipient */}
          <div>
            <p className="mb-2 text-xs font-medium text-zinc-500 uppercase dark:text-zinc-400">Recipient</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Name"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
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

          {/* Package dimensions */}
          <div>
            <p className="mb-2 text-xs font-medium text-zinc-500 uppercase dark:text-zinc-400">Package dimensions</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Width (cm)</label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  min="1"
                  className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Height (cm)</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  min="1"
                  className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Length (cm)</label>
                <input
                  type="number"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  min="1"
                  className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Weight (kg)</label>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  min="0.1"
                  step="0.1"
                  className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => setStep("idle")}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={searchServices}
            disabled={loading || !postalCode || !country || !width || !height || !length || !weight}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50 dark:focus:ring-offset-zinc-900"
          >
            {loading ? "Searching…" : "Search carriers"}
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
        {currentShipping?.packlink_shipment_ref && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Reference</span>
            <span className="font-mono font-medium text-zinc-900 dark:text-white">
              {currentShipping.packlink_shipment_ref}
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
          disabled={loading}
          className="rounded-lg border border-cyan-300 px-3 py-1.5 text-sm font-medium text-cyan-700 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-400 dark:hover:bg-cyan-900/20"
        >
          {loading ? "Loading…" : "Download label"}
        </button>
        <button
          onClick={() => currentShipping?.packlink_shipment_ref && fetchTracking(currentShipping.packlink_shipment_ref)}
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
            {tracking.map((event, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`h-2.5 w-2.5 rounded-full ${i === 0 ? "bg-cyan-500" : "bg-zinc-300 dark:bg-zinc-600"}`} />
                  {i < tracking.length - 1 && <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-700" />}
                </div>
                <div className="pb-3">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{event.description}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {event.city && `${event.city} · `}
                    {new Date(event.timestamp).toLocaleString()}
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
