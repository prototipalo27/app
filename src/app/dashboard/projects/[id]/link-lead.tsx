"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchLeads, linkLeadToProject } from "../../crm/actions";
import Link from "next/link";

interface Lead {
  id: string;
  full_name: string;
  email: string | null;
  company: string | null;
}

interface LinkLeadProps {
  projectId: string;
  linkedLead: { id: string; full_name: string; email: string | null } | null;
}

export default function LinkLead({ projectId, linkedLead }: LinkLeadProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Lead[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    startTransition(async () => {
      const leads = await searchLeads(query);
      setResults(leads);
    });
  };

  const handleLink = (leadId: string) => {
    startTransition(async () => {
      await linkLeadToProject(leadId, projectId);
      setShowSearch(false);
      setQuery("");
      setResults([]);
      router.refresh();
    });
  };

  if (linkedLead) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-white">
            {linkedLead.full_name}
          </p>
          {linkedLead.email && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {linkedLead.email}
            </p>
          )}
        </div>
        <Link
          href={`/dashboard/crm/${linkedLead.id}`}
          className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Ver lead
        </Link>
      </div>
    );
  }

  return (
    <div>
      {!showSearch ? (
        <button
          onClick={() => setShowSearch(true)}
          className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Vincular lead
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Buscar por nombre o email..."
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
            />
            <button
              onClick={handleSearch}
              disabled={isPending || !query.trim()}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Buscar
            </button>
            <button
              onClick={() => {
                setShowSearch(false);
                setQuery("");
                setResults([]);
              }}
              className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
          </div>

          {results.length > 0 && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700">
              {results.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => handleLink(lead.id)}
                  disabled={isPending}
                  className="flex w-full items-center justify-between border-b border-zinc-100 px-4 py-2.5 text-left last:border-0 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">
                      {lead.full_name}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {[lead.email, lead.company].filter(Boolean).join(" — ")}
                    </p>
                  </div>
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    Vincular
                  </span>
                </button>
              ))}
            </div>
          )}

          {results.length === 0 && query && !isPending && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Sin resultados. Prueba con otro termino.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
