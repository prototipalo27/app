"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

interface LeadNavProps {
  prevId: string | null;
  nextId: string | null;
  current: number;
  total: number;
}

export default function LeadNav({ prevId, nextId, current, total }: LeadNavProps) {
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

      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {current} de {total}
        </span>

        <div className="flex gap-1">
          {prevId ? (
            <Button variant="outline" size="sm" render={<Link href={`/dashboard/crm/${prevId}${suffix}`} title="Anterior (k)" />}>
              &larr; Ant
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              &larr; Ant
            </Button>
          )}

          {nextId ? (
            <Button variant="outline" size="sm" render={<Link href={`/dashboard/crm/${nextId}${suffix}`} title="Siguiente (j)" />}>
              Sig &rarr;
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Sig &rarr;
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
