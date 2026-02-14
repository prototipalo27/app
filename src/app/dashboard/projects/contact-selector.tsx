"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface ContactResult {
  id: string;
  name: string;
  email: string;
  code: string;
  tradeName: string;
  phone: string;
}

interface SelectedContact {
  id: string;
  name: string;
  email: string;
}

export default function ContactSelector() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactResult[]>([]);
  const [selected, setSelected] = useState<SelectedContact | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchContacts = useCallback(async (search: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/holded/contacts${params}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch contacts");
      }
      const data = await res.json();
      setResults(data);
      setIsOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching contacts");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInputChange(value: string) {
    setQuery(value);
    if (selected) {
      setSelected(null);
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      fetchContacts(value.trim());
    }, 300);
  }

  function handleSelect(contact: ContactResult) {
    setSelected({ id: contact.id, name: contact.name, email: contact.email });
    setQuery(contact.name);
    setIsOpen(false);
  }

  function handleClear() {
    setSelected(null);
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setError(null);
  }

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/holded/contacts/sync", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Sync failed");
      }
      // Re-run the current search if there's a query
      if (query.trim().length >= 2) {
        await fetchContacts(query.trim());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error syncing contacts");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div ref={wrapperRef} className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Client (Holded)
        </label>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          title="Sincronizar contactos de Holded"
          className="text-xs text-zinc-400 hover:text-green-500 disabled:opacity-50 transition-colors"
        >
          <svg className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0 && !selected) setIsOpen(true);
          }}
          placeholder="Search contacts in Holded..."
          className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 pr-8 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
        />

        {/* Clear button */}
        {(query || selected) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="absolute right-8 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-green-500" />
          </div>
        )}

        {/* Dropdown */}
        {isOpen && results.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(c)}
                  className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700"
                >
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">
                    {c.name}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {[c.email, c.code].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* No results */}
        {isOpen && !loading && results.length === 0 && query.trim().length >= 2 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-3 text-center text-sm text-zinc-500 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
            No contacts found
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}

      {/* Selected contact badge */}
      {selected && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 dark:bg-green-900/20">
          <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-medium text-green-700 dark:text-green-300">
            {selected.name}
          </span>
          {selected.email && (
            <span className="text-xs text-green-600 dark:text-green-400">
              ({selected.email})
            </span>
          )}
        </div>
      )}

      {/* Hidden fields for form submission */}
      <input type="hidden" name="holded_contact_id" value={selected?.id ?? ""} />
      <input type="hidden" name="client_name" value={selected?.name ?? ""} />
      <input type="hidden" name="client_email" value={selected?.email ?? ""} />
    </div>
  );
}
