"use client";

import { useEffect, useRef, useState, useCallback } from "react";

declare global {
  interface Window {
    google?: typeof google;
    __googleMapsCallback?: () => void;
  }
}

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
      console.warn("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set");
      scriptLoading = false;
      return;
    }

    window.__googleMapsCallback = () => {
      scriptLoaded = true;
      scriptLoading = false;
      callbacks.forEach((cb) => cb());
      callbacks.length = 0;
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=__googleMapsCallback`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  });
}

function extractComponents(
  place: google.maps.places.PlaceResult
): AddressComponents {
  const get = (type: string) =>
    place.address_components?.find((c) => c.types.includes(type));

  const streetNumber = get("street_number")?.long_name || "";
  const route = get("route")?.long_name || "";
  const address = route ? `${route}${streetNumber ? `, ${streetNumber}` : ""}` : place.formatted_address || "";

  return {
    address,
    postalCode: get("postal_code")?.long_name || "",
    city:
      get("locality")?.long_name ||
      get("administrative_area_level_2")?.long_name ||
      "",
    province:
      get("administrative_area_level_2")?.long_name ||
      get("administrative_area_level_1")?.long_name ||
      "",
    country: get("country")?.long_name || "España",
  };
}

export default function AddressAutocomplete({
  name,
  required,
  className,
  placeholder = "Calle Mayor, 1",
  defaultValue,
  onAddressSelect,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [value, setValue] = useState(defaultValue || "");

  const handlePlaceChanged = useCallback(() => {
    const ac = autocompleteRef.current;
    if (!ac) return;

    const place = ac.getPlace();
    if (!place.address_components) return;

    const components = extractComponents(place);
    setValue(components.address);
    onAddressSelect?.(components);
  }, [onAddressSelect]);

  useEffect(() => {
    loadGoogleMapsScript().then(() => {
      if (!inputRef.current || !window.google) return;

      const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ["address"],
        componentRestrictions: { country: "es" },
        fields: ["address_components", "formatted_address"],
      });

      ac.addListener("place_changed", handlePlaceChanged);
      autocompleteRef.current = ac;
    });
  }, [handlePlaceChanged]);

  return (
    <input
      ref={inputRef}
      name={name}
      type="text"
      required={required}
      className={className}
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      autoComplete="off"
    />
  );
}
