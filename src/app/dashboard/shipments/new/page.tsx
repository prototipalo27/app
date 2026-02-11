"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { PacklinkService } from "@/lib/packlink/types";

const SENDER_ADDRESS = {
  name: "Prototipalo",
  street1: "",
  city: "",
  zip_code: "",
  country: "ES",
  email: "",
  phone: "",
};

interface ProjectOption {
  id: string;
  name: string;
}

export default function NewShipmentPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "selecting" | "creating" | "created">("form");
  const [services, setServices] = useState<PacklinkService[]>([]);
  const [selectedService, setSelectedService] = useState<PacklinkService | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  // Projects for optional linking
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  // Shipment info fields
  const [title, setTitle] = useState("");
  const [contentDescription, setContentDescription] = useState("");
  const [declaredValue, setDeclaredValue] = useState("");

  // Recipient
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");

  // Address
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("ES");

  // Package
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [length, setLength] = useState("");
  const [weight, setWeight] = useState("");

  // Fetch projects for optional linking
  useEffect(() => {
    fetch("/api/projects?unlinked=true")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

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
    setStep("creating");

    try {
      const res = await fetch("/api/packlink/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
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
          title: title || undefined,
          contentDescription: contentDescription || undefined,
          declaredValue: declaredValue ? Number(declaredValue) : undefined,
          content: contentDescription || "3D printed parts",
          contentvalue: declaredValue ? Number(declaredValue) : 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create shipment");
      }

      const data = await res.json();
      setReference(data.reference);
      setStep("created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating shipment");
      setStep("selecting");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white";

  // Step 1: Form
  if (step === "form") {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">Nuevo envio</h1>

        <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Shipment info */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Shipment info</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input type="text" placeholder="Title (e.g. Samples for Client X)" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass + " sm:col-span-2"} />
              <input type="text" placeholder="Content description" value={contentDescription} onChange={(e) => setContentDescription(e.target.value)} className={inputClass} />
              <input type="number" placeholder="Declared value (EUR)" value={declaredValue} onChange={(e) => setDeclaredValue(e.target.value)} min="0" step="0.01" className={inputClass} />
            </div>
          </div>

          {/* Link to project (optional) */}
          {projects.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Link to project (optional)</p>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className={inputClass}
              >
                <option value="">No project (standalone shipment)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Recipient */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Recipient</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input type="text" placeholder="Name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className={inputClass} />
              <input type="email" placeholder="Email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} className={inputClass} />
              <input type="tel" placeholder="Phone" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Address */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Destination address</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input type="text" placeholder="Street address" value={street} onChange={(e) => setStreet(e.target.value)} className={inputClass + " sm:col-span-2"} />
              <input type="text" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
              <input type="text" placeholder="Postal code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={inputClass} />
              <input type="text" placeholder="Country code (ES, FR…)" value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} className={inputClass} />
            </div>
          </div>

          {/* Package dimensions */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Package dimensions</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Width (cm)</label>
                <input type="number" value={width} onChange={(e) => setWidth(e.target.value)} min="1" className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Height (cm)</label>
                <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} min="1" className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Length (cm)</label>
                <input type="number" value={length} onChange={(e) => setLength(e.target.value)} min="1" className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Weight (kg)</label>
                <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} min="0.1" step="0.1" className={inputClass} />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => router.push("/dashboard/shipments")}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={searchServices}
              disabled={loading || !postalCode || !country || !width || !height || !length || !weight}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50 dark:focus:ring-offset-black"
            >
              {loading ? "Searching…" : "Search carriers"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Select carrier
  if (step === "selecting" || step === "creating") {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">Select carrier</h1>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
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
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50 dark:focus:ring-offset-black"
            >
              {loading ? "Creating…" : "Create shipment"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Created
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">Shipment created</h1>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center gap-2">
          <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm font-medium text-zinc-900 dark:text-white">
            Shipment created successfully
          </p>
        </div>

        <div className="space-y-2">
          {reference && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">Reference</span>
              <span className="font-mono font-medium text-zinc-900 dark:text-white">{reference}</span>
            </div>
          )}
          {selectedService && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">Carrier</span>
              <span className="font-medium text-zinc-900 dark:text-white">
                {selectedService.carrier_name} — {selectedService.name}
              </span>
            </div>
          )}
          {selectedService && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">Price</span>
              <span className="font-medium text-zinc-900 dark:text-white">
                {selectedService.price.total_price.toFixed(2)} {selectedService.price.currency}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Destination</span>
            <span className="text-right font-medium text-zinc-900 dark:text-white">
              {[street, postalCode, city, country].filter(Boolean).join(", ")}
            </span>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => router.push("/dashboard/shipments")}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Back to list
          </button>
          <button
            onClick={() => {
              setStep("form");
              setServices([]);
              setSelectedService(null);
              setReference(null);
              setTitle("");
              setContentDescription("");
              setDeclaredValue("");
              setSelectedProjectId("");
              setRecipientName("");
              setRecipientEmail("");
              setRecipientPhone("");
              setStreet("");
              setCity("");
              setPostalCode("");
              setCountry("ES");
              setWidth("");
              setHeight("");
              setLength("");
              setWeight("");
            }}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-black"
          >
            Create another
          </button>
        </div>
      </div>
    </div>
  );
}
