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
    <div className="mb-6 flex items-center justify-between">
      <Link
        href={backHref}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; {backLabel}
      </Link>

      <div className="flex items-center gap-1">
        {prevId ? (
          <Link
            href={`/dashboard/crm/${prevId}${suffix}`}
            title="Anterior (k)"
            className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
          >
            &larr; Ant
          </Link>
        ) : (
          <span className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium text-muted-foreground opacity-50">
            &larr; Ant
          </span>
        )}

        {nextId ? (
          <Link
            href={`/dashboard/crm/${nextId}${suffix}`}
            title="Siguiente (j)"
            className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Sig &rarr;
          </Link>
        ) : (
          <span className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium text-muted-foreground opacity-50">
            Sig &rarr;
          </span>
        )}
      </div>
    </div>
  );
}
