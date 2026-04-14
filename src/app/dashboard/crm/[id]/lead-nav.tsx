"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

interface LeadNavProps {
  prevId: string | null;
  nextId: string | null;
}

export default function LeadNav({ prevId, nextId }: LeadNavProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const suffix = from ? `?from=${from}` : "";
  const backHref = from === "tracker" ? "/dashboard/crm/timeline" : "/dashboard/crm";
  const backLabel = from === "tracker" ? "Volver a Tracker" : "Volver a Leads";

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement).isContentEditable) return;

      if (e.key === "j" && nextId) {
        e.preventDefault();
        router.push(`/dashboard/crm/${nextId}${suffix}`);
      } else if (e.key === "k" && prevId) {
        e.preventDefault();
        router.push(`/dashboard/crm/${prevId}${suffix}`);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevId, nextId, router, suffix]);

  return (
    <div className="mb-4 flex items-center justify-between md:mb-6">
      <Link
        href={backHref}
        className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground active:bg-accent md:h-auto md:px-0"
      >
        &larr; <span className="hidden sm:inline">{backLabel}</span><span className="sm:hidden">Volver</span>
      </Link>

      <div className="flex items-center gap-1">
        {prevId ? (
          <Link
            href={`/dashboard/crm/${prevId}${suffix}`}
            title="Anterior (k)"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-sm text-foreground hover:bg-accent active:bg-accent md:h-8 md:w-auto md:px-3"
          >
            <span className="md:hidden">&larr;</span>
            <span className="hidden md:inline">&larr; Ant</span>
          </Link>
        ) : (
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-sm text-muted-foreground opacity-50 md:h-8 md:w-auto md:px-3">
            <span className="md:hidden">&larr;</span>
            <span className="hidden md:inline">&larr; Ant</span>
          </span>
        )}

        {nextId ? (
          <Link
            href={`/dashboard/crm/${nextId}${suffix}`}
            title="Siguiente (j)"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-sm text-foreground hover:bg-accent active:bg-accent md:h-8 md:w-auto md:px-3"
          >
            <span className="md:hidden">&rarr;</span>
            <span className="hidden md:inline">Sig &rarr;</span>
          </Link>
        ) : (
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-sm text-muted-foreground opacity-50 md:h-8 md:w-auto md:px-3">
            <span className="md:hidden">&rarr;</span>
            <span className="hidden md:inline">Sig &rarr;</span>
          </span>
        )}
      </div>
    </div>
  );
}
