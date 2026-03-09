"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { searchLeadsForLink, linkLeadToClient, searchHoldedContacts, linkLeadToHoldedContact } from "../actions";

type LeadResult = { id: string; full_name: string; company: string | null; email: string | null; phone: string | null };
type HoldedResult = { id: string; name: string; email: string; phone: string; code: string };

export default function LinkClient({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState<LeadResult[]>([]);
  const [holdedResults, setHoldedResults] = useState<HoldedResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchingHolded, setSearchingHolded] = useState(false);
  const [linking, setLinking] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(q: string) {
    setQuery(q);
    if (q.length < 2) {
      setLeads([]);
      setHoldedResults([]);
      return;
    }

    // Search leads immediately
    setSearching(true);
    searchLeadsForLink(q).then((data) => {
      setLeads(data.filter((r) => r.id !== leadId));
      setSearching(false);
    });

    // Debounce Holded search (slower API)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchingHolded(true);
      searchHoldedContacts(q).then((data) => {
        setHoldedResults(data);
        setSearchingHolded(false);
      });
    }, 500);
  }

  async function handleLinkLead(clientId: string) {
    setLinking(true);
    const result = await linkLeadToClient(leadId, clientId);
    if (result.success) {
      setOpen(false);
      setQuery("");
      setLeads([]);
      setHoldedResults([]);
      router.refresh();
    }
    setLinking(false);
  }

  async function handleLinkHolded(holdedContactId: string) {
    setLinking(true);
    const result = await linkLeadToHoldedContact(leadId, holdedContactId);
    if (result.success) {
      setOpen(false);
      setQuery("");
      setLeads([]);
      setHoldedResults([]);
      router.refresh();
    }
    setLinking(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        Vincular cliente existente
      </button>
    );
  }

  const hasLeads = leads.length > 0;
  const hasHolded = holdedResults.length > 0;
  const noResults = query.length >= 2 && !searching && !searchingHolded && !hasLeads && !hasHolded;

  return (
    <div className="mt-2 rounded-lg border border-input bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar en leads y Holded..."
          autoFocus
          className="h-8 flex-1 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          onClick={() => { setOpen(false); setQuery(""); setLeads([]); setHoldedResults([]); }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          X
        </button>
      </div>

      {(searching || searchingHolded) && (
        <p className="mt-2 text-xs text-muted-foreground">
          {searching && searchingHolded ? "Buscando en leads y Holded..." : searching ? "Buscando leads..." : "Buscando en Holded..."}
        </p>
      )}

      <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
        {/* Lead results */}
        {hasLeads && (
          <>
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Leads</p>
            {leads.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleLinkLead(r.id)}
                disabled={linking}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
              >
                <div className="min-w-0">
                  <span className="font-medium text-foreground">{r.full_name}</span>
                  {r.company && (
                    <span className="ml-1.5 text-xs text-muted-foreground">{r.company}</span>
                  )}
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {r.email && <span>{r.email}</span>}
                    {r.phone && <span>{r.phone}</span>}
                  </div>
                </div>
                <svg className="h-4 w-4 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </button>
            ))}
          </>
        )}

        {/* Holded results */}
        {hasHolded && (
          <>
            <p className="mt-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Holded</p>
            {holdedResults.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleLinkHolded(c.id)}
                disabled={linking}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50"
              >
                <div className="min-w-0">
                  <span className="font-medium text-foreground">{c.name}</span>
                  {c.code && (
                    <span className="ml-1.5 text-xs text-muted-foreground">{c.code}</span>
                  )}
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {c.email && <span>{c.email}</span>}
                    {c.phone && <span>{c.phone}</span>}
                  </div>
                </div>
                <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  Holded
                </span>
              </button>
            ))}
          </>
        )}
      </div>

      {noResults && (
        <p className="mt-2 text-xs text-muted-foreground">Sin resultados en leads ni Holded</p>
      )}
    </div>
  );
}
