"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { searchLeadsForLink, linkLeadToClient } from "../actions";
import { Button } from "@/components/ui/button";

export default function LinkClient({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { id: string; full_name: string; company: string | null; email: string | null; phone: string | null }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const data = await searchLeadsForLink(q);
    // Exclude current lead
    setResults(data.filter((r) => r.id !== leadId));
    setSearching(false);
  }

  async function handleLink(clientId: string) {
    setLinking(true);
    const result = await linkLeadToClient(leadId, clientId);
    if (result.success) {
      setOpen(false);
      setQuery("");
      setResults([]);
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

  return (
    <div className="mt-2 rounded-lg border border-input bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar por nombre, empresa, email o tel..."
          autoFocus
          className="h-8 flex-1 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          onClick={() => { setOpen(false); setQuery(""); setResults([]); }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          X
        </button>
      </div>

      {searching && (
        <p className="mt-2 text-xs text-muted-foreground">Buscando...</p>
      )}

      {results.length > 0 && (
        <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleLink(r.id)}
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
        </div>
      )}

      {query.length >= 2 && !searching && results.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">Sin resultados</p>
      )}
    </div>
  );
}
