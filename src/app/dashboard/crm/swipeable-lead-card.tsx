"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { agingClasses, tagClasses, type LeadWithAssignee } from "./crm-card";
import { Badge } from "@/components/ui/badge";

interface SwipeableLeadCardProps {
  lead: LeadWithAssignee & { ai_summary?: string | null };
  onDismiss: (lead: LeadWithAssignee) => void;
  onContact: (lead: LeadWithAssignee) => void;
  dismissingId: string | null;
  loadingContactId: string | null;
}

const SWIPE_THRESHOLD = 80;

export function SwipeableLeadCard({
  lead,
  onDismiss,
  onContact,
  dismissingId,
  loadingContactId,
}: SwipeableLeadCardProps) {
  const router = useRouter();
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [settled, setSettled] = useState<"left" | "right" | null>(null);
  const isScrollingRef = useRef<boolean | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isScrollingRef.current = null;
    setSwiping(true);
    setSettled(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swiping) return;
    const dx = e.touches[0].clientX - startXRef.current;
    const dy = e.touches[0].clientY - startYRef.current;

    // Determine if user is scrolling vertically or swiping horizontally
    if (isScrollingRef.current === null) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 5) {
        isScrollingRef.current = true;
        setSwiping(false);
        setOffsetX(0);
        return;
      }
      if (Math.abs(dx) > 5) {
        isScrollingRef.current = false;
      }
    }

    if (isScrollingRef.current) return;

    // Dampen the swipe after threshold
    const dampened = Math.abs(dx) > SWIPE_THRESHOLD
      ? Math.sign(dx) * (SWIPE_THRESHOLD + (Math.abs(dx) - SWIPE_THRESHOLD) * 0.3)
      : dx;
    setOffsetX(dampened);
  };

  const handleTouchEnd = () => {
    if (!swiping) return;
    setSwiping(false);

    if (offsetX > SWIPE_THRESHOLD) {
      // Swipe right → contact/respond
      setSettled("right");
      setOffsetX(0);
      setTimeout(() => {
        setSettled(null);
        onContact(lead);
      }, 200);
    } else if (offsetX < -SWIPE_THRESHOLD) {
      // Swipe left → dismiss
      setSettled("left");
      setOffsetX(0);
      setTimeout(() => {
        setSettled(null);
        onDismiss(lead);
      }, 200);
    } else {
      setOffsetX(0);
    }
  };

  const aging = (() => {
    const diff = Date.now() - new Date(lead.created_at).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  })();

  const isProcessing = dismissingId === lead.id || loadingContactId === lead.id;

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Background actions revealed on swipe */}
      <div className="absolute inset-0 flex">
        {/* Right action (swipe right → contact) */}
        <div
          className={`flex flex-1 items-center justify-start pl-4 transition-colors ${
            offsetX > SWIPE_THRESHOLD || settled === "right"
              ? "bg-blue-500"
              : "bg-blue-400/80"
          }`}
        >
          <div className="flex items-center gap-2 text-white">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-semibold">Responder</span>
          </div>
        </div>
        {/* Left action (swipe left → dismiss) */}
        <div
          className={`flex flex-1 items-center justify-end pr-4 transition-colors ${
            offsetX < -SWIPE_THRESHOLD || settled === "left"
              ? "bg-red-500"
              : "bg-red-400/80"
          }`}
        >
          <div className="flex items-center gap-2 text-white">
            <span className="text-sm font-semibold">Descartar</span>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
        </div>
      </div>

      {/* Card content */}
      <div
        className={`relative rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-700 dark:bg-zinc-800 ${
          isProcessing ? "opacity-50" : ""
        }`}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: swiping ? "none" : "transform 0.2s ease-out",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (Math.abs(offsetX) < 5 && !settled) {
            router.push(`/dashboard/crm/${lead.id}`);
          }
        }}
      >
        {/* Row 1: Name + aging + value */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
              {lead.full_name}
            </p>
            {lead.company && (
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{lead.company}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${agingClasses(lead.created_at)}`}>
              {aging}
            </span>
            {lead.estimated_value != null && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                {lead.estimated_value.toLocaleString("es-ES")} €
              </span>
            )}
          </div>
        </div>

        {/* Row 2: AI Summary */}
        {lead.ai_summary ? (
          <p className="mt-1.5 text-[13px] leading-snug text-zinc-600 dark:text-zinc-300">
            {lead.ai_summary}
          </p>
        ) : lead.message ? (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">
            {lead.message.slice(0, 100)}{lead.message.length > 100 ? "…" : ""}
          </p>
        ) : null}

        {/* Row 3: Tags */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {lead.project_type_tag && (
            <Badge variant="secondary" className={tagClasses(lead.project_type_tag)}>
              {lead.project_type_tag}
            </Badge>
          )}
          {lead.assignee_email && (
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
              {lead.assignee_email.split("@")[0]}
            </span>
          )}
          {lead.attachments && (
            <svg className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          )}
          {lead.phone && (
            <a
              href={`tel:${lead.phone}`}
              className="ml-auto inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {lead.phone}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
