"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendLeadEmail } from "../actions";

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
}

function normalizeSubject(subject: string): string {
  return subject.replace(/^(Re:\s*|Fwd:\s*|FW:\s*|RE:\s*)+/gi, "").trim();
}

function groupIntoThreads(activities: Activity[]): EmailThread[] {
  const emailActivities = activities.filter(
    (a) => a.activity_type === "email_sent" || a.activity_type === "email_received"
  );

  const threadMap = new Map<string, Activity[]>();

  for (const activity of emailActivities) {
    const subject = String(activity.metadata?.email_subject || "(sin asunto)");
    // Use thread_id if available, otherwise group by normalized subject
    const key = activity.thread_id || `subj:${normalizeSubject(subject)}`;

    if (!threadMap.has(key)) {
      threadMap.set(key, []);
    }
    threadMap.get(key)!.push(activity);
  }

  const threads: EmailThread[] = [];
  for (const [threadId, emails] of threadMap) {
    // Sort emails chronologically within thread
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

  // Sort threads by most recent activity first
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
  { id: "envios", label: "Envíos", color: "bg-cyan-100 text-cyan-700 hover:bg-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:hover:bg-cyan-900/50" },
  { id: "plazos", label: "Plazos", color: "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50" },
  { id: "materiales", label: "Materiales", color: "bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50" },
  { id: "cierre", label: "Cierre", color: "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50" },
] as const;

export default function EmailPanel({ activities, leadId, leadEmail, leadName, leadCompany, emailSubjectTag, leadNumber, holdedProformaId, snippets = [] }: EmailPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const defaultSubject = buildDefaultSubject(emailSubjectTag, leadCompany, leadName, leadNumber);

  // Proforma attachment toggle
  const [attachProforma, setAttachProforma] = useState(false);

  // Compose state
  const [emailTo, setEmailTo] = useState(leadEmail || "");
  const [emailSubject, setEmailSubject] = useState(defaultSubject);
  const [emailBody, setEmailBody] = useState("");

  // Reply state
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [replyThreadId, setReplyThreadId] = useState<string | null>(null);
  const [replyBanner, setReplyBanner] = useState<string | null>(null);

  // Expanded threads
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  const threads = groupIntoThreads(activities);

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

    // Scroll to compose
    document.getElementById("email-compose")?.scrollIntoView({ behavior: "smooth" });
  };

  const cancelReply = () => {
    setReplyToMessageId(null);
    setReplyThreadId(null);
    setReplyBanner(null);
    setEmailSubject(defaultSubject);
    setEmailBody("");
  };

  const handleSend = () => {
    if (!emailTo.trim() || !emailSubject.trim() || !emailBody.trim()) return;
    startTransition(async () => {
      await sendLeadEmail(
        leadId,
        emailTo,
        emailSubject,
        emailBody,
        replyToMessageId || undefined,
        replyThreadId || undefined,
        attachProforma || undefined
      );
      cancelReply();
      setAttachProforma(false);
      router.refresh();
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
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Emails ({activities.filter((a) => a.activity_type === "email_sent" || a.activity_type === "email_received").length})
            </h3>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {threads.map((thread) => {
              const isExpanded = expandedThreads.has(thread.threadId);
              const lastEmail = thread.emails[thread.emails.length - 1];
              const hasMultiple = thread.emails.length > 1;

              return (
                <div key={thread.threadId}>
                  {/* Thread header */}
                  <button
                    onClick={() => toggleThread(thread.threadId)}
                    className="flex w-full items-center gap-3 px-6 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                          {thread.subject}
                        </span>
                        {hasMultiple && (
                          <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                            {thread.emails.length}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {lastEmail.activity_type === "email_received"
                          ? `De: ${lastEmail.metadata?.email_from_name || lastEmail.metadata?.email_from || ""}`
                          : `Para: ${lastEmail.metadata?.email_to || ""}`}
                        {" — "}
                        {(lastEmail.content || "").slice(0, 80)}
                        {(lastEmail.content?.length || 0) > 80 ? "..." : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                      {new Date(thread.lastDate).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <svg
                      className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Thread emails */}
                  {isExpanded && (
                    <div className="border-t border-zinc-100 bg-zinc-50/50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-800/20">
                      <div className="space-y-3">
                        {thread.emails.map((email) => {
                          const isSent = email.activity_type === "email_sent";
                          const meta = email.metadata;

                          return (
                            <div key={email.id}>
                              <div
                                className={`rounded-lg px-4 py-3 ${
                                  isSent
                                    ? "ml-8 bg-blue-600 text-white"
                                    : "mr-8 bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span
                                    className={`text-xs font-semibold ${
                                      isSent ? "text-blue-200" : "text-zinc-500 dark:text-zinc-400"
                                    }`}
                                  >
                                    {isSent
                                      ? `Para: ${meta?.email_to || ""}`
                                      : `De: ${meta?.email_from_name || meta?.email_from || ""}`}
                                  </span>
                                  <span
                                    className={`text-[10px] ${
                                      isSent ? "text-blue-300" : "text-zinc-400 dark:text-zinc-500"
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

                                {/* Reply button on received emails */}
                                {!isSent && (
                                  <button
                                    onClick={() => handleReply(email)}
                                    className="mt-2 flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                                  >
                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                    </svg>
                                    Responder
                                  </button>
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
        </div>
      )}

      {/* Compose */}
      <div
        id="email-compose"
        className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
            {replyBanner ? "Responder email" : "Nuevo email"}
          </h3>
          {snippets.length > 0 && (
            <>
              <span className="text-zinc-300 dark:text-zinc-600">|</span>
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
                    <div className="min-w-56 max-w-72 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
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
                            className="block w-full px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                          >
                            <span className="block text-xs font-medium text-zinc-800 dark:text-zinc-200">
                              {snippet.title}
                            </span>
                            <span className="mt-0.5 block truncate text-[10px] text-zinc-500 dark:text-zinc-400">
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
          <input
            type="email"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            placeholder="Para"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
          />
          <input
            type="text"
            value={emailSubject}
            readOnly
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
          />
          <textarea
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            placeholder="Escribe tu mensaje..."
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
            rows={4}
          />
          <div className="flex items-center justify-between">
            {holdedProformaId ? (
              <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={attachProforma}
                  onChange={(e) => setAttachProforma(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600"
                />
                Adjuntar proforma PDF
              </label>
            ) : (
              <div />
            )}
            <button
              onClick={handleSend}
              disabled={isPending || !emailTo.trim() || !emailSubject.trim() || !emailBody.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? "Enviando..." : "Enviar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
