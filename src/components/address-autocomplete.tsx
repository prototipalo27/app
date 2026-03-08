"use client";

import { useEffect, useRef, useState } from "react";

export interface AddressComponents {
  address: string;
  postalCode: string;
  city: string;
  province: string;
  country: string;
}

interface AddressAutocompleteProps {
  name: string;
  required?: boolean;
  className?: string;
  placeholder?: string;
  defaultValue?: string;
  onAddressSelect?: (components: AddressComponents) => void;
}

let scriptLoaded = false;
let scriptLoading = false;
const callbacks: (() => void)[] = [];

function loadGoogleMapsScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();

  return new Promise((resolve) => {
    callbacks.push(resolve);

    if (scriptLoading) return;
    scriptLoading = true;

    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) {
      console.warn("[AddressAutocomplete] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set");
      scriptLoading = false;
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&loading=async`;
    script.async = true;
    script.onload = () => {
      scriptLoaded = true;
      scriptLoading = false;
      callbacks.forEach((cb) => cb());
      callbacks.length = 0;
    };
    script.onerror = () => {
      console.error("[AddressAutocomplete] Failed to load Google Maps script");
      scriptLoading = false;
    };
    document.head.appendChild(script);
  });
}

export default function AddressAutocomplete({
  name,
  required,
  className,
  placeholder = "Calle Mayor, 1",
  defaultValue,
  onAddressSelect,
}: AddressAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue || "");
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;

    loadGoogleMapsScript().then(async () => {
      if (!containerRef.current || initializedRef.current) return;
      initializedRef.current = true;

      // Import the Places library
      const { Place, PlaceAutocompleteElement } =
        (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;

      // Create autocomplete element
      const autocomplete = new PlaceAutocompleteElement({
        componentRestrictions: { country: "es" },
        types: ["address"],
      });

      // Style the element to match the form
      autocomplete.style.width = "100%";
      autocomplete.setAttribute("placeholder", placeholder);

      // Insert it into the container
      containerRef.current.appendChild(autocomplete);

      // Listen for place selection
      autocomplete.addEventListener("gmp-select", async (event: Event) => {
        const selectEvent = event as Event & {
          place: google.maps.places.Place;
        };
        const place = selectEvent.place;

        await place.fetchFields({
          fields: ["addressComponents", "formattedAddress"],
        });

        const components = place.addressComponents || [];
        const get = (type: string) =>
          components.find((c) => c.types.includes(type));

        const streetNumber = get("street_number")?.longText || "";
        const route = get("route")?.longText || "";
        const address = route
          ? `${route}${streetNumber ? `, ${streetNumber}` : ""}`
          : place.formattedAddress || "";

        const parsed: AddressComponents = {
          address,
          postalCode: get("postal_code")?.longText || "",
          city:
            get("locality")?.longText ||
            get("administrative_area_level_2")?.longText ||
            "",
          province:
            get("administrative_area_level_2")?.longText ||
            get("administrative_area_level_1")?.longText ||
            "",
          country: get("country")?.longText || "España",
        };

        setValue(parsed.address);
        if (hiddenInputRef.current) {
          hiddenInputRef.current.value = parsed.address;
        }
        onAddressSelect?.(parsed);
      });
    });
  }, [placeholder, onAddressSelect]);

  return (
    <div>
      {/* Hidden input for form submission */}
      <input
        ref={hiddenInputRef}
        type="hidden"
        name={name}
        value={value}
      />
      {/* Google Places autocomplete mounts here */}
      <div ref={containerRef} className={className} />
      {/* Fallback input if script fails to load */}
      {!initializedRef.current && (
        <noscript>
          <input
            name={name}
            type="text"
            required={required}
            className={className}
            placeholder={placeholder}
          />
        </noscript>
      )}
    </div>
  );
}
