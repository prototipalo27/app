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

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

interface Suggestion {
  placePrediction: {
    placeId: string;
    text: { text: string };
    structuredFormat: {
      mainText: { text: string };
      secondaryText: { text: string };
    };
  };
}

interface PlaceDetails {
  addressComponents: Array<{
    longText: string;
    types: string[];
  }>;
  formattedAddress: string;
}

async function fetchSuggestions(input: string): Promise<Suggestion[]> {
  if (!input || input.length < 3 || !API_KEY) return [];

  const res = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
      },
      body: JSON.stringify({
        input,
        includedRegionCodes: ["es"],
        includedPrimaryTypes: ["street_address", "route", "premise", "subpremise"],
        languageCode: "es",
      }),
    }
  );

  if (!res.ok) return [];
  const data = await res.json();
  return data.suggestions || [];
}

async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}?fields=addressComponents,formattedAddress&languageCode=es`,
    {
      headers: {
        "X-Goog-Api-Key": API_KEY,
      },
    }
  );

  if (!res.ok) return null;
  return res.json();
}

function parseComponents(place: PlaceDetails): AddressComponents {
  const get = (type: string) =>
    place.addressComponents?.find((c) => c.types.includes(type));

  const streetNumber = get("street_number")?.longText || "";
  const route = get("route")?.longText || "";
  const address = route
    ? `${route}${streetNumber ? `, ${streetNumber}` : ""}`
    : place.formattedAddress || "";

  return {
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
}

export default function AddressAutocomplete({
  name,
  required,
  className,
  placeholder = "Calle Mayor, 1",
  defaultValue,
  onAddressSelect,
}: AddressAutocompleteProps) {
  const [value, setValue] = useState(defaultValue || "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (input: string) => {
    setValue(input);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (input.length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const results = await fetchSuggestions(input);
      setSuggestions(results);
      setShowDropdown(results.length > 0);
      setLoading(false);
    }, 300);
  };

  const handleSelect = async (suggestion: Suggestion) => {
    const { placeId } = suggestion.placePrediction;
    setShowDropdown(false);
    setValue(suggestion.placePrediction.text.text);

    const details = await fetchPlaceDetails(placeId);
    if (details) {
      const components = parseComponents(details);
      setValue(components.address);
      onAddressSelect?.(components);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        name={name}
        type="text"
        required={required}
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        autoComplete="off"
      />

      {showDropdown && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {suggestions.map((s, i) => (
            <li
              key={i}
              className="cursor-pointer px-3 py-2.5 text-sm text-zinc-900 hover:bg-zinc-100 dark:text-white dark:hover:bg-zinc-800"
              onMouseDown={() => handleSelect(s)}
            >
              <span className="font-medium">
                {s.placePrediction.structuredFormat.mainText.text}
              </span>
              <span className="ml-1.5 text-zinc-500 dark:text-zinc-400">
                {s.placePrediction.structuredFormat.secondaryText.text}
              </span>
            </li>
          ))}
          {loading && (
            <li className="px-3 py-2 text-sm text-zinc-400">Buscando...</li>
          )}
        </ul>
      )}
    </div>
  );
}
