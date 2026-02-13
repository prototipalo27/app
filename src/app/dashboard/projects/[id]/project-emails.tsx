"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendProjectEmail } from "../actions";

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

interface ProjectEmailsProps {
  projectId: string;
  activities: Activity[];
  clientEmail: string | null;
}

function normalizeSubject(subject: string): string {
  return subject.replace(/^(Re:\s*|Fwd:\s*|FW:\s*|RE:\s*)+/gi, "").trim();
}

export default function ProjectEmails({
  projectId,
  activities,
  clientEmail,
}: ProjectEmailsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [emailTo, setEmailTo] = useState(clientEmail || "");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [replyThreadId, setReplyThreadId] = useState<string | null>(null);
  const [replyBanner, setReplyBanner] = useState<string | null>(null);

  const emailActivities = activities
    .filter((a) => a.activity_type === "email_sent" || a.activity_type === "email_received")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const handleReply = (activity: Activity) => {
    const meta = activity.metadata;
    const subject = String(meta?.email_subject || "");
    const messageId = String(meta?.message_id || "");

    setReplyToMessageId(messageId);
    setReplyThreadId(activity.thread_id || null);
    setEmailSubject(subject.startsWith("Re:") ? subject : `Re: ${subject}`);
    setEmailTo(
      activity.activity_type === "email_received"
        ? String(meta?.email_from || clientEmail || "")
        : String(meta?.email_to || clientEmail || "")
    );
    setEmailBody("");
    setReplyBanner(normalizeSubject(subject) || "(sin asunto)");
  };

  const cancelReply = () => {
    setReplyToMessageId(null);
    setReplyThreadId(null);
    setReplyBanner(null);
    setEmailSubject("");
    setEmailBody("");
  };

  const handleSend = () => {
    if (!emailTo.trim() || !emailSubject.trim() || !emailBody.trim()) return;
    startTransition(async () => {
      await sendProjectEmail(
        projectId,
        emailTo,
        emailSubject,
        emailBody,
        replyToMessageId || undefined,
        replyThreadId || undefined
      );
      cancelReply();
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Comunicaciones ({emailActivities.length})
        </h2>
      </div>

      <div className="p-5">
        {/* Email timeline */}
        {emailActivities.length > 0 && (
          <div className="mb-4 space-y-3">
            {emailActivities.map((activity) => {
              const isSent = activity.activity_type === "email_sent";
              const meta = activity.metadata;

              return (
                <div
                  key={activity.id}
                  className={`rounded-lg px-4 py-3 ${
                    isSent
                      ? "ml-8 bg-blue-600 text-white"
                      : "mr-8 bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
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
                      {new Date(activity.created_at).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {meta?.email_subject && (
                    <p
                      className={`text-xs ${
                        isSent ? "text-blue-200" : "text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      Asunto: {meta.email_subject}
                    </p>
                  )}

                  {activity.content && (
                    <p className="mt-2 whitespace-pre-wrap text-sm">
                      {activity.content}
                    </p>
                  )}

                  {!isSent && (
                    <button
                      onClick={() => handleReply(activity)}
                      className="mt-2 flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      Responder
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Compose */}
        <div className="space-y-2">
          {replyBanner && (
            <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 dark:bg-blue-900/20">
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
            onChange={(e) => setEmailSubject(e.target.value)}
            placeholder="Asunto"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
          />
          <textarea
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            placeholder="Escribe tu mensaje..."
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
            rows={3}
          />
          <div className="flex justify-end">
            <button
              onClick={handleSend}
              disabled={isPending || !emailTo.trim() || !emailSubject.trim() || !emailBody.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? "Enviando..." : "Enviar email"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
