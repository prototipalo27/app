"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { PacklinkService } from "@/lib/packlink/types";
import { PackageListEditor, createEmptyPackage, type PackageItem } from "@/components/box-preset-selector";
import { SENDER_ADDRESS } from "@/lib/packlink/sender";

interface ProjectOption {
  id: string;
  name: string;
}

interface HoldedContactResult {
  id: string;
  name: string;
  email: string;
  phone: string;
  mobile: string;
  billAddress?: {
    address?: string;
    city?: string;
    postalCode?: string;
    province?: string;
    country?: string;
    countryCode?: string;
  };
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

  // Holded contact search
  const [contactQuery, setContactQuery] = useState("");
  const [contactResults, setContactResults] = useState<HoldedContactResult[]>([]);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<HoldedContactResult | null>(null);
  const contactWrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Shipment info fields
  const [title, setTitle] = useState("");
  const [contentDescription, setContentDescription] = useState("");
  const [declaredValue, setDeclaredValue] = useState("");

  // Recipient
  const [recipientName, setRecipientName] = useState("");
  const [recipientSurname, setRecipientSurname] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");

  // Address
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("ES");

  // Packages
  const [packages, setPackages] = useState<PackageItem[]>([createEmptyPackage()]);

  // Fetch projects for optional linking
  useEffect(() => {
    fetch("/api/projects?unlinked=true")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Close contact dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (contactWrapperRef.current && !contactWrapperRef.current.contains(e.target as Node)) {
        setContactOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchContacts = useCallback(async (search: string) => {
    setContactLoading(true);
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/holded/contacts${params}`);
      if (res.ok) {
        const data = await res.json();
        setContactResults(data);
        setContactOpen(true);
      }
    } catch {
      setContactResults([]);
    } finally {
      setContactLoading(false);
    }
  }, []);

  function handleContactInputChange(value: string) {
    setContactQuery(value);
    if (selectedContact) setSelectedContact(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setContactResults([]);
      setContactOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      fetchContacts(value.trim());
    }, 300);
  }

  function handleContactSelect(contact: HoldedContactResult) {
    setSelectedContact(contact);
    setContactQuery(contact.name);
    setContactOpen(false);

    // Auto-fill recipient fields — split name into first + surname
    const nameParts = (contact.name || "").split(" ");
    setRecipientName(nameParts[0] || "");
    setRecipientSurname(nameParts.slice(1).join(" ") || "");
    setRecipientEmail(contact.email || "");
    setRecipientPhone(contact.phone || contact.mobile || "");

    // Auto-fill address from billAddress
    if (contact.billAddress) {
      setStreet(contact.billAddress.address || "");
      setCity(contact.billAddress.city || "");
      setPostalCode(contact.billAddress.postalCode || "");
      setCountry(contact.billAddress.countryCode || "ES");
    }
  }

  function handleContactClear() {
    setSelectedContact(null);
    setContactQuery("");
    setContactResults([]);
    setContactOpen(false);
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

          {/* Holded contact search */}
          <div ref={contactWrapperRef}>
            <p className="mb-2 text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Holded contact</p>
            <div className="relative">
              <input
                type="text"
                value={contactQuery}
                onChange={(e) => handleContactInputChange(e.target.value)}
                onFocus={() => { if (contactResults.length > 0 && !selectedContact) setContactOpen(true); }}
                placeholder="Search contacts in Holded..."
                className={inputClass + " pr-8"}
              />

              {(contactQuery || selectedContact) && (
                <button
                  type="button"
                  onClick={handleContactClear}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}

              {contactLoading && (
                <div className="absolute right-8 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-cyan-500" />
                </div>
              )}

              {contactOpen && contactResults.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                  {contactResults.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => handleContactSelect(c)}
                        className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700"
                      >
                        <span className="text-sm font-medium text-zinc-900 dark:text-white">{c.name}</span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {[c.email, c.billAddress?.city].filter(Boolean).join(" · ")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {contactOpen && !contactLoading && contactResults.length === 0 && contactQuery.trim().length >= 2 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-3 text-center text-sm text-zinc-500 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  No contacts found
                </div>
              )}
            </div>

            {selectedContact && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-cyan-50 px-3 py-2 dark:bg-cyan-900/20">
                <svg className="h-4 w-4 text-cyan-600 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium text-cyan-700 dark:text-cyan-300">{selectedContact.name}</span>
                <span className="text-xs text-cyan-600 dark:text-cyan-400">— fields auto-filled</span>
              </div>
            )}
          </div>

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
              <input type="text" placeholder="First name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className={inputClass} />
              <input type="text" placeholder="Surname" value={recipientSurname} onChange={(e) => setRecipientSurname(e.target.value)} className={inputClass} />
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

          {/* Packages */}
          <PackageListEditor
            packages={packages}
            onChange={setPackages}
            inputClass={inputClass}
          />

          <div className="flex gap-2">
            <button
              onClick={() => router.push("/dashboard/shipments")}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={searchServices}
              disabled={loading || !postalCode || !country || packages.some((p) => !p.width || !p.height || !p.length || !p.weight)}
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
              setSelectedContact(null);
              setContactQuery("");
              setRecipientName("");
              setRecipientSurname("");
              setRecipientEmail("");
              setRecipientPhone("");
              setStreet("");
              setCity("");
              setPostalCode("");
              setCountry("ES");
              setPackages([createEmptyPackage()]);
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
