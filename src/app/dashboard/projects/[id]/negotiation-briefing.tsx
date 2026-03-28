"use client";

import { useState } from "react";
import { generateNegotiationSummary } from "../actions";
import { Button } from "@/components/ui/button";

interface NegotiationBriefingProps {
  leadId: string;
}

export function NegotiationBriefing({ leadId }: NegotiationBriefingProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (summary) {
      setOpen(!open);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await generateNegotiationSummary(leadId);
    setLoading(false);
    if (result.success && result.summary) {
      setSummary(result.summary);
      setOpen(true);
    } else {
      setError(result.error || "Error al generar el resumen");
    }
  };

  const handleRegenerate = async () => {
    setLoading(true);
    setError(null);
    const result = await generateNegotiationSummary(leadId);
    setLoading(false);
    if (result.success && result.summary) {
      setSummary(result.summary);
    } else {
      setError(result.error || "Error al regenerar");
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Briefing de negociacion
          </h2>
          {loading && (
            <svg className="h-4 w-4 animate-spin text-purple-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>
        <svg
          className={`h-4 w-4 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {error && (
        <p className="px-5 pb-3 text-xs text-red-500">{error}</p>
      )}

      {open && summary && (
        <div className="border-t border-zinc-100 px-5 pb-5 pt-3 dark:border-zinc-800">
          <div
            className="prose prose-sm prose-zinc max-w-none dark:prose-invert [&_strong]:text-zinc-900 dark:[&_strong]:text-white [&_h2]:text-sm [&_h2]:mt-3 [&_h2]:mb-1 [&_p]:text-[13px] [&_li]:text-[13px] [&_ul]:my-1"
            dangerouslySetInnerHTML={{
              __html: summary
                .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                .replace(/^### (.*$)/gm, "<h3>$1</h3>")
                .replace(/^## (.*$)/gm, "<h2>$1</h2>")
                .replace(/^# (.*$)/gm, "<h1>$1</h1>")
                .replace(/^- (.*$)/gm, "<li>$1</li>")
                .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
                .replace(/\n\n/g, "</p><p>")
                .replace(/\n/g, "<br>"),
            }}
          />
          <div className="mt-3 flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleRegenerate();
              }}
              disabled={loading}
              className="text-xs text-muted-foreground"
            >
              {loading ? "Regenerando..." : "Regenerar resumen"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
