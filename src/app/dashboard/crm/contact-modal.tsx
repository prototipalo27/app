"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendLeadEmail } from "./actions";

interface EmailActivity {
  id: string;
  activity_type: string;
  content: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: any;
  thread_id: string | null;
  created_at: string;
  created_by: string | null;
}

interface ContactModalProps {
  leadId: string;
  leadName: string;
  leadEmail: string | null;
  leadCompany: string | null;
  emailSubjectTag: string | null;
  leadNumber: number | null;
  holdedProformaId: string | null;
  activities: EmailActivity[];
  onClose: () => void;
}

function normalizeSubject(subject: string): string {
  return subject.replace(/^(Re:\s*|Fwd:\s*|FW:\s*|RE:\s*)+/gi, "").trim();
}

export function ContactModal({
  leadId,
  leadName,
  leadEmail,
  leadCompany,
  emailSubjectTag,
  leadNumber,
  holdedProformaId,
  activities,
  onClose,
}: ContactModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [attachProforma, setAttachProforma] = useState(false);

  // Find the latest received email to show
  const receivedEmails = activities.filter(
    (a) => a.activity_type === "email_received"
  );
  const latestReceived = receivedEmails[receivedEmails.length - 1] || null;

  // Build default subject
  const identifier = emailSubjectTag || leadCompany || leadName;
  const ref = leadNumber ? ` [PT-${String(leadNumber).padStart(4, "0")}]` : "";
  const defaultSubject = latestReceived
    ? `Re: ${latestReceived.metadata?.email_subject || "(sin asunto)"}`
    : `Presupuesto${ref} - Prototipalo - ${identifier}`;

  const [emailTo, setEmailTo] = useState(leadEmail || "");
  const [emailSubject, setEmailSubject] = useState(defaultSubject);
  const [emailBody, setEmailBody] = useState("");

  const handleSend = () => {
    if (!emailTo.trim() || !emailSubject.trim() || !emailBody.trim()) return;
    startTransition(async () => {
      await sendLeadEmail(
        leadId,
        emailTo,
        emailSubject,
        emailBody,
        latestReceived?.metadata?.message_id || undefined,
        latestReceived?.thread_id || undefined,
        attachProforma || undefined
      );
      router.refresh();
      onClose();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-700">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Contactar a {leadName}
            </h3>
            {leadCompany && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {leadCompany}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Show received emails */}
          {activities.length > 0 && (
            <div className="mb-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Emails recibidos
              </h4>
              {activities.map((email) => {
                const isSent = email.activity_type === "email_sent";
                const meta = email.metadata;
                return (
                  <div
                    key={email.id}
                    className={`rounded-lg px-4 py-3 ${
                      isSent
                        ? "ml-8 bg-blue-600 text-white"
                        : "bg-zinc-50 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span
                          className={`text-xs font-semibold ${
                            isSent
                              ? "text-blue-200"
                              : "text-zinc-500 dark:text-zinc-400"
                          }`}
                        >
                          {isSent
                            ? `Para: ${meta?.email_to || ""}`
                            : `De: ${meta?.email_from_name || meta?.email_from || ""}`}
                        </span>
                        {meta?.email_subject && (
                          <span
                            className={`ml-2 text-xs ${
                              isSent
                                ? "text-blue-300"
                                : "text-zinc-400 dark:text-zinc-500"
                            }`}
                          >
                            — {normalizeSubject(meta.email_subject)}
                          </span>
                        )}
                      </div>
                      <span
                        className={`shrink-0 text-[10px] ${
                          isSent
                            ? "text-blue-300"
                            : "text-zinc-400 dark:text-zinc-500"
                        }`}
                      >
                        {new Date(email.created_at).toLocaleDateString(
                          "es-ES",
                          {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </span>
                    </div>
                    {email.content && (
                      <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-sm">
                        {email.content}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Composer */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {latestReceived ? "Responder" : "Nuevo email"}
            </h4>
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
                autoFocus
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-100 px-6 py-4 dark:border-zinc-700">
          <div className="flex items-center gap-4">
            <button
              onClick={() =>
                router.push(`/dashboard/crm/${leadId}`)
              }
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Ver ficha completa
            </button>
            {holdedProformaId && (
              <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={attachProforma}
                  onChange={(e) => setAttachProforma(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600"
                />
                Adjuntar proforma
              </label>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Cancelar
            </button>
            <button
              onClick={handleSend}
              disabled={
                isPending ||
                !emailTo.trim() ||
                !emailSubject.trim() ||
                !emailBody.trim()
              }
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
