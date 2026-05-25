"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatDayMonthTime } from "@/lib/dates";

export interface LeadRemarkSummary {
  id: string;
  content: string | null;
  photo_paths: string[];
  created_at: string;
  created_by: string | null;
}

interface Props {
  remarks: LeadRemarkSummary[];
  userMap: Record<string, string>;
}

/**
 * Read-only view of the commercial notes (lead_remarks) attached to a lead,
 * surfaced inside the linked project so PMs and producers don't have to
 * jump back to the CRM to read them. Editing stays in the CRM page.
 */
export default function LeadRemarksReadonly({ remarks, userMap }: Props) {
  const [lightbox, setLightbox] = useState<{ remarkId: string; index: number } | null>(null);

  if (remarks.length === 0) return null;

  const active = lightbox
    ? remarks.find((r) => r.id === lightbox.remarkId) ?? null
    : null;

  return (
    <>
      <div className="rounded-xl border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase text-muted-foreground">
          Notas comerciales del lead ({remarks.length})
        </h3>
        <ul className="space-y-4">
          {remarks.map((r) => {
            const author = r.created_by ? userMap[r.created_by] ?? "—" : "—";
            return (
              <li key={r.id} className="space-y-2 rounded-lg border bg-background p-3">
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{author}</span>
                  <span>{formatDayMonthTime(r.created_at)}</span>
                </div>
                {r.content && (
                  <p className="whitespace-pre-wrap text-sm text-foreground">{r.content}</p>
                )}
                {r.photo_paths.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {r.photo_paths.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setLightbox({ remarkId: r.id, index: i })}
                        className="group relative overflow-hidden rounded-md border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/lead-remarks/${r.id}/photo/${i}`}
                          alt={`Foto ${i + 1}`}
                          loading="lazy"
                          className="h-20 w-full object-cover transition group-hover:scale-105"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <Dialog
        open={lightbox !== null}
        onOpenChange={(open) => { if (!open) setLightbox(null); }}
      >
        <DialogContent
          showCloseButton
          className="max-w-[92vw] bg-transparent p-0 ring-0 shadow-none sm:max-w-[92vw]"
        >
          {active && lightbox && (
            <div className="relative flex h-[88vh] items-center justify-center">
              {active.photo_paths.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setLightbox({
                        remarkId: active.id,
                        index: (lightbox.index - 1 + active.photo_paths.length) % active.photo_paths.length,
                      })
                    }
                    className="absolute left-2 z-10 bg-white/10 text-white hover:bg-white/20"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setLightbox({
                        remarkId: active.id,
                        index: (lightbox.index + 1) % active.photo_paths.length,
                      })
                    }
                    className="absolute right-2 z-10 bg-white/10 text-white hover:bg-white/20"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Button>
                </>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/lead-remarks/${active.id}/photo/${lightbox.index}`}
                alt={`Foto ${lightbox.index + 1}`}
                className="max-h-full max-w-full rounded-lg object-contain"
              />
              {active.photo_paths.length > 1 && (
                <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
                  {lightbox.index + 1} / {active.photo_paths.length}
                </span>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
