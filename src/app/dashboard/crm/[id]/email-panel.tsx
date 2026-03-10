"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { sendLeadEmail, generateEmailDraft } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Activity {
  id: string;
  activity_type: string;
  content: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: any;
  thread_id: string | null;
  created_at: string;
  created_by: string | null;
}

interface EmailThread {
  threadId: string;
  subject: string;
  emails: Activity[];
  lastDate: string;
}

interface Snippet {
  id: string;
  title: string;
  category: string;
  content: string;
}

interface EmailResource {
  id: string;
  title: string;
  type: string;
  content: string | null;
  category: string | null;
}

interface EmailPanelProps {
  activities: Activity[];
  leadId: string;
  leadEmail: string | null;
  leadName: string;
  leadCompany: string | null;
  emailSubjectTag: string | null;
  leadNumber: number | null;
  holdedProformaId: string | null;
  snippets?: Snippet[];
  emailResources?: EmailResource[];
  leadMessage?: string | null;
  aiDraft?: string | null;
}

function normalizeSubject(subject: string): string {
  return subject.replace(/^(Re:\s*|Fwd:\s*|FW:\s*|RE:\s*)+/gi, "").trim();
}

function groupIntoThreads(activities: Activity[]): EmailThread[] {
  const emailActivities = activities.filter(
    (a) => a.activity_type === "email_sent" || a.activity_type === "email_received" || a.activity_type === "email_scheduled"
  );

  const threadMap = new Map<string, Activity[]>();

  for (const activity of emailActivities) {
    const subject = String(activity.metadata?.email_subject || "(sin asunto)");
    const key = activity.thread_id || `subj:${normalizeSubject(subject)}`;

    if (!threadMap.has(key)) {
      threadMap.set(key, []);
    }
    threadMap.get(key)!.push(activity);
  }

  const threads: EmailThread[] = [];
  for (const [threadId, emails] of threadMap) {
    emails.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const firstSubject = String(emails[0].metadata?.email_subject || "(sin asunto)");

    threads.push({
      threadId,
      subject: normalizeSubject(firstSubject) || "(sin asunto)",
      emails,
      lastDate: emails[emails.length - 1].created_at,
    });
  }

  threads.sort(
    (a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()
  );

  return threads;
}

function buildDefaultSubject(tag: string | null, company: string | null, name: string, leadNumber: number | null): string {
  const identifier = tag || company || name;
  const ref = leadNumber ? ` [PT-${String(leadNumber).padStart(4, "0")}]` : "";
  return `Presupuesto${ref} - Prototipalo - ${identifier}`;
}

const SNIPPET_CATEGORIES = [
  { id: "saludo", label: "Saludo", color: "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50" },
  { id: "pagos", label: "Pagos", color: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50" },
  { id: "envios", label: "Envios", color: "bg-cyan-100 text-cyan-700 hover:bg-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:hover:bg-cyan-900/50" },
  { id: "plazos", label: "Plazos", color: "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50" },
  { id: "materiales", label: "Materiales", color: "bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50" },
  { id: "cierre", label: "Cierre", color: "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50" },
] as const;

export default function EmailPanel({ activities, leadId, leadEmail, leadName, leadCompany, emailSubjectTag, leadNumber, holdedProformaId, snippets = [], emailResources = [], leadMessage, aiDraft }: EmailPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const defaultSubject = buildDefaultSubject(emailSubjectTag, leadCompany, leadName, leadNumber);

  const [attachProforma, setAttachProforma] = useState(false);
  const [attachedResources, setAttachedResources] = useState<Set<string>>(new Set());
  const [forceNow, setForceNow] = useState(false);
  const [emailTo, setEmailTo] = useState(leadEmail || "");
  const [emailSubject, setEmailSubject] = useState(defaultSubject);
  const [emailBody, setEmailBody] = useState("");
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [replyThreadId, setReplyThreadId] = useState<string | null>(null);
  const [replyBanner, setReplyBanner] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, []);

  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  const threads = groupIntoThreads(activities);

  useEffect(() => {
    if (aiDraft && !emailBody) {
      setEmailBody(aiDraft);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiDraft]);

  useEffect(() => {
    resizeTextarea();
  }, [emailBody, resizeTextarea]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { body?: string; subject?: string } | undefined;
      if (detail?.body) setEmailBody(detail.body);
      if (detail?.subject) setEmailSubject(detail.subject);
      setAttachProforma(true);
      setReplyToMessageId(null);
      setReplyThreadId(null);
      setReplyBanner(null);
      setTimeout(() => {
        document.getElementById("email-compose")?.scrollIntoView({ behavior: "smooth" });
        textareaRef.current?.focus();
      }, 100);
    };
    window.addEventListener("send-proforma", handler);
    return () => window.removeEventListener("send-proforma", handler);
  }, []);

  const handleReply = (activity: Activity) => {
    const meta = activity.metadata;
    const subject = String(meta?.email_subject || "");
    const messageId = String(meta?.message_id || "");

    setReplyToMessageId(messageId);
    setReplyThreadId(activity.thread_id || null);
    setEmailSubject(subject.startsWith("Re:") ? subject : `Re: ${subject}`);
    setEmailTo(
      activity.activity_type === "email_received"
        ? String(meta?.email_from || leadEmail || "")
        : String(meta?.email_to || leadEmail || "")
    );
    setEmailBody("");
    setReplyBanner(normalizeSubject(subject) || "(sin asunto)");

    document.getElementById("email-compose")?.scrollIntoView({ behavior: "smooth" });
  };

  const cancelReply = () => {
    setReplyToMessageId(null);
    setReplyThreadId(null);
    setReplyBanner(null);
    setEmailSubject(defaultSubject);
    setEmailBody("");
  };

  const handleGenerateDraft = async () => {
    setIsGenerating(true);
    try {
      let replyContent: string | undefined;
      if (replyToMessageId) {
        const replyEmail = activities.find(
          (a) => (a.metadata as Record<string, unknown>)?.message_id === replyToMessageId
        );
        replyContent = replyEmail?.content || undefined;
      }
      const result = await generateEmailDraft(leadId, replyContent);
      if (result.success && result.draft) {
        setEmailBody(result.draft);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = () => {
    if (!emailTo.trim() || !emailSubject.trim() || !emailBody.trim()) return;
    setSendError(null);
    startTransition(async () => {
      const resAttachments = emailResources
        .filter((r) => attachedResources.has(r.id) && r.content)
        .map((r) => ({ title: r.title, url: r.content! }));

      const result = await sendLeadEmail(
        leadId,
        emailTo,
        emailSubject,
        emailBody,
        replyToMessageId || undefined,
        replyThreadId || undefined,
        attachProforma || undefined,
        resAttachments.length > 0 ? resAttachments : undefined,
        forceNow || undefined
      );
      if (result.success) {
        cancelReply();
        setAttachProforma(false);
        setAttachedResources(new Set());
        setForceNow(false);
        if (result.scheduled) {
          setSendError(null);
          alert("Email programado para las 8:00 AM");
        }
        router.refresh();
      } else {
        setSendError(result.error || "Error al enviar el email");
      }
    });
  };

  const toggleThread = (threadId: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Email threads */}
      {threads.length > 0 && (
        <Card>
          <CardHeader className="border-b">
            <h3 className="text-sm font-semibold text-card-foreground">
              Emails ({activities.filter((a) => a.activity_type === "email_sent" || a.activity_type === "email_received" || a.activity_type === "email_scheduled").length})
            </h3>
          </CardHeader>

          <div className="divide-y">
            {threads.map((thread) => {
              const isExpanded = expandedThreads.has(thread.threadId);
              const lastEmail = thread.emails[thread.emails.length - 1];
              const hasMultiple = thread.emails.length > 1;

              return (
                <div key={thread.threadId}>
                  <button
                    onClick={() => toggleThread(thread.threadId)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {thread.subject}
                        </span>
                        {hasMultiple && (
                          <Badge variant="secondary">
                            {thread.emails.length}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {lastEmail.activity_type === "email_received"
                          ? `De: ${lastEmail.metadata?.email_from_name || lastEmail.metadata?.email_from || ""}`
                          : `Para: ${lastEmail.metadata?.email_to || ""}`}
                        {" — "}
                        {(lastEmail.content || "").slice(0, 80)}
                        {(lastEmail.content?.length || 0) > 80 ? "..." : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(thread.lastDate).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <svg
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="border-t bg-muted/30 px-4 py-4">
                      <div className="space-y-3">
                        {thread.emails.map((email) => {
                          const isSent = email.activity_type === "email_sent" || email.activity_type === "email_scheduled";
                          const meta = email.metadata;

                          return (
                            <div key={email.id}>
                              <div
                                className={`rounded-lg px-4 py-3 ${
                                  isSent
                                    ? "ml-8 bg-blue-600 text-white"
                                    : "mr-8 bg-card text-foreground"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span
                                    className={`text-xs font-semibold ${
                                      isSent ? "text-blue-200" : "text-muted-foreground"
                                    }`}
                                  >
                                    {isSent
                                      ? `Para: ${meta?.email_to || ""}`
                                      : `De: ${meta?.email_from_name || meta?.email_from || ""}`}
                                  </span>
                                  <span
                                    className={`text-[10px] ${
                                      isSent ? "text-blue-300" : "text-muted-foreground"
                                    }`}
                                  >
                                    {new Date(email.created_at).toLocaleDateString("es-ES", {
                                      day: "numeric",
                                      month: "short",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>

                                {email.content && (
                                  <p className="mt-2 whitespace-pre-wrap text-sm">
                                    {email.content}
                                  </p>
                                )}

                                {!isSent && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleReply(email)}
                                    className="mt-2 text-muted-foreground hover:text-foreground"
                                  >
                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                    </svg>
                                    Responder
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Compose */}
      <Card id="email-compose">
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-card-foreground">
              {replyBanner ? "Responder email" : "Nuevo email"}
            </h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleGenerateDraft}
              disabled={isGenerating}
              className="bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50"
            >
              {isGenerating ? (
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              )}
              {isGenerating ? "Generando..." : "IA"}
            </Button>
            {snippets.length > 0 && (
              <>
                <span className="text-border">|</span>
                {SNIPPET_CATEGORIES.filter((cat) =>
                  snippets.some((s) => s.category === cat.id)
                ).map((cat) => (
                  <div key={cat.id} className="group relative">
                    <button
                      type="button"
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${cat.color}`}
                    >
                      {cat.label}
                    </button>
                    <div className="invisible absolute left-0 top-full z-20 pt-1 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
                      <div className="min-w-56 max-w-72 rounded-lg border bg-popover py-1 shadow-lg">
                        {snippets
                          .filter((s) => s.category === cat.id)
                          .map((snippet) => (
                            <button
                              key={snippet.id}
                              type="button"
                              onClick={() =>
                                setEmailBody((prev) =>
                                  prev ? prev + "\n\n" + snippet.content : snippet.content
                                )
                              }
                              className="block w-full px-3 py-2 text-left hover:bg-muted"
                            >
                              <span className="block text-xs font-medium text-foreground">
                                {snippet.title}
                              </span>
                              <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                                {snippet.content.slice(0, 80)}
                                {snippet.content.length > 80 ? "..." : ""}
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
            {emailResources.length > 0 && (
              <>
                <span className="text-border">|</span>
                <div className="group relative">
                  <button
                    type="button"
                    className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
                  >
                    Recursos
                  </button>
                  <div className="invisible absolute right-0 top-full z-20 pt-1 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
                    <div className="max-h-64 min-w-64 max-w-80 overflow-y-auto rounded-lg border bg-popover py-1 shadow-lg">
                      {(() => {
                        const grouped: Record<string, EmailResource[]> = {};
                        for (const r of emailResources) {
                          const cat = r.category || "General";
                          if (!grouped[cat]) grouped[cat] = [];
                          grouped[cat].push(r);
                        }
                        return Object.entries(grouped)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([cat, items]) => (
                            <div key={cat}>
                              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {cat}
                              </div>
                              {items.map((r) => (
                                <button
                                  key={r.id}
                                  type="button"
                                  onClick={() => {
                                    if (!r.content) return;
                                    const insert = r.type === "imagen"
                                      ? `<img src="${r.content}" alt="${r.title}" style="max-width:100%;height:auto;" />`
                                      : r.content;
                                    setEmailBody((prev) =>
                                      prev ? prev + "\n\n" + insert : insert
                                    );
                                  }}
                                  className="block w-full px-3 py-2 text-left hover:bg-muted"
                                >
                                  <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                                    {r.type === "imagen" ? (
                                      <svg className="h-3 w-3 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                    ) : (
                                      <svg className="h-3 w-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                      </svg>
                                    )}
                                    {r.title}
                                  </span>
                                </button>
                              ))}
                            </div>
                          ));
                      })()}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {replyBanner && (
            <div className="mb-3 flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 dark:bg-blue-900/20">
              <span className="text-xs text-blue-700 dark:text-blue-300">
                Respondiendo a: {replyBanner}
              </span>
              <button
                onClick={cancelReply}
                className="ml-2 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <div className="space-y-2">
            <Input
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="Para"
            />
            <Input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Asunto"
            />
            <textarea
              ref={textareaRef}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder="Escribe tu mensaje..."
              className="min-h-[6rem] w-full resize-none overflow-hidden rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
            {sendError && (
              <p className="text-xs text-destructive">{sendError}</p>
            )}
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {holdedProformaId && (
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={attachProforma}
                      onChange={(e) => setAttachProforma(e.target.checked)}
                      className="h-4 w-4 rounded border-input text-blue-600 focus:ring-blue-500"
                    />
                    Presupuesto PDF
                  </label>
                )}
                {emailResources.filter((r) => r.type === "archivo").map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={attachedResources.has(r.id)}
                      onChange={(e) => {
                        setAttachedResources((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(r.id);
                          else next.delete(r.id);
                          return next;
                        });
                      }}
                      className="h-4 w-4 rounded border-input text-emerald-600 focus:ring-emerald-500"
                    />
                    {r.title}
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={forceNow}
                    onChange={(e) => setForceNow(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-input text-orange-600 focus:ring-orange-500"
                  />
                  Enviar ya
                </label>
                <Button
                  onClick={handleSend}
                  disabled={isPending || !emailTo.trim() || !emailSubject.trim() || !emailBody.trim()}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  {isPending ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
