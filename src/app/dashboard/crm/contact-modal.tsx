"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendLeadEmail } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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

  const receivedEmails = activities.filter(
    (a) => a.activity_type === "email_received"
  );
  const latestReceived = receivedEmails[receivedEmails.length - 1] || null;

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
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden flex flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Contactar a {leadName}</DialogTitle>
          {leadCompany && (
            <DialogDescription>{leadCompany}</DialogDescription>
          )}
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Show received emails */}
          {activities.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span
                          className={`text-xs font-semibold ${
                            isSent
                              ? "text-blue-200"
                              : "text-muted-foreground"
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
                                : "text-muted-foreground/70"
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
                            : "text-muted-foreground/70"
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
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {latestReceived ? "Responder" : "Nuevo email"}
            </h4>
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
                readOnly
                className="bg-muted text-muted-foreground"
              />
              <Textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Escribe tu mensaje..."
                rows={4}
                autoFocus
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="link"
              onClick={() => router.push(`/dashboard/crm/${leadId}`)}
              className="px-0"
            >
              Ver ficha completa
            </Button>
            {holdedProformaId && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={attachProforma}
                  onChange={(e) => setAttachProforma(e.target.checked)}
                  className="h-4 w-4 rounded border-input text-blue-600 focus:ring-blue-500"
                />
                Adjuntar presupuesto PDF
              </label>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleSend}
              disabled={
                isPending ||
                !emailTo.trim() ||
                !emailSubject.trim() ||
                !emailBody.trim()
              }
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {isPending ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
