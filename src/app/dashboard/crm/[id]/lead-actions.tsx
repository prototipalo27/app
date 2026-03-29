"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  updateLeadStatus,
  assignLead,
  addNote,
  deleteLead,
  blockEmailAndDeleteLead,
  updatePaymentCondition,
  updateDesiredDeliveryDate,
  updateLeadTag,
  updateEstimationField,
  updateEstimatedValue,
  createLeadProforma,
  sendProformaToClient,
  sendInvoiceToClient,
  createStripeCheckout,
  markAsPaid,
  updateLeadOwner,
  sendQuoteToClient,
  sendNdaToClient,
} from "../actions";
import type { Tables } from "@/lib/supabase/database.types";
import {
  LEAD_COLUMNS,
  STATUS_LABELS,
  QUANTITY_RANGES,
  COMPLEXITY_OPTIONS,
  URGENCY_OPTIONS,
  type LeadStatus,
} from "@/lib/crm-config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { PdfPreviewButton } from "./pdf-viewer";

interface LeadActionsProps {
  leadId: string;
  leadEmail: string | null;
  currentStatus: LeadStatus;
  managers: { id: string; email: string }[];
  assignedTo: string | null;
  quoteRequest: Tables<"quote_requests"> | null;
  paymentCondition: string | null;
  projectTypeTag: string | null;
  projectTemplateTags: string[];
  estimatedQuantity: string | null;
  estimatedComplexity: string | null;
  estimatedUrgency: string | null;
  estimatedValue: number | null;
  desiredDeliveryDate: string | null;
  nextId: string | null;
  ownedBy: string | null;
  commission: {
    isReturning: boolean;
    rate: number;
    quoteTotal: number;
    commission: number;
    prepaidBonus: number;
  } | null;
  ndaStatus: "none" | "pending" | "signed";
  ndaSignedAt?: string;
  ndaSignerName?: string;
}

export default function LeadActions({
  leadId,
  leadEmail,
  currentStatus,
  managers,
  assignedTo,
  quoteRequest,
  paymentCondition,
  projectTypeTag,
  projectTemplateTags,
  estimatedQuantity,
  estimatedComplexity,
  estimatedUrgency,
  estimatedValue,
  desiredDeliveryDate,
  nextId,
  ownedBy,
  commission,
  ndaStatus,
  ndaSignedAt,
  ndaSignerName,
}: LeadActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [note, setNote] = useState("");
  const [showLostReason, setShowLostReason] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sendingProforma, setSendingProforma] = useState(false);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [docSent, setDocSent] = useState<string | null>(null);
  const [generatingPayLink, setGeneratingPayLink] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [editedValue, setEditedValue] = useState(estimatedValue?.toString() ?? "");
  useEffect(() => {
    setEditedValue(estimatedValue?.toString() ?? "");
  }, [estimatedValue]);
  const [ndaError, setNdaError] = useState<string | null>(null);

  const selectClass =
    "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

  const handleStatusChange = (newStatus: LeadStatus) => {
    if (newStatus === "lost") {
      setShowLostReason(true);
      return;
    }
    startTransition(async () => {
      await updateLeadStatus(leadId, newStatus);
      if (nextId) {
        router.push(`/dashboard/crm/${nextId}`);
      } else {
        router.push("/dashboard/crm");
      }
    });
  };

  const handleLostConfirm = () => {
    startTransition(async () => {
      await updateLeadStatus(leadId, "lost", lostReason || undefined);
      setShowLostReason(false);
      setLostReason("");
      if (nextId) {
        router.push(`/dashboard/crm/${nextId}`);
      } else {
        router.push("/dashboard/crm");
      }
    });
  };

  const handleAssign = (userId: string) => {
    startTransition(async () => {
      await assignLead(leadId, userId || null);
      router.refresh();
    });
  };

  const handleAddNote = () => {
    if (!note.trim()) return;
    startTransition(async () => {
      await addNote(leadId, note);
      setNote("");
      router.refresh();
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteLead(leadId);
    });
  };

  const nextStatuses = LEAD_COLUMNS.filter(
    (col) => col.id !== currentStatus
  );

  return (
    <div className="space-y-6">
      {/* Status buttons */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-card-foreground">
          Cambiar estado
        </h3>
        <p className="mb-2 text-xs text-muted-foreground">
          Actual: {STATUS_LABELS[currentStatus]}
        </p>
        <div className="flex flex-wrap gap-2">
          {nextStatuses.map((col) => (
            <Button
              key={col.id}
              variant="secondary"
              size="sm"
              onClick={() => handleStatusChange(col.id)}
              disabled={isPending}
              className={col.badge}
            >
              {col.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Lost reason inline */}
      {showLostReason && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm font-medium text-destructive">
            Motivo de perdida (opcional)
          </p>
          <Textarea
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            placeholder="Ej: Presupuesto demasiado alto..."
            className="mt-2"
            rows={2}
          />
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={handleLostConfirm}
              disabled={isPending}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Confirmar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowLostReason(false);
                setLostReason("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* NDA */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-card-foreground">
          Confidencialidad
        </h3>
        {ndaStatus === "signed" ? (
          <div className="space-y-1">
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              NDA firmado
            </Badge>
            <p className="text-xs text-muted-foreground">
              {ndaSignerName && <>{ndaSignerName} — </>}
              {ndaSignedAt && new Date(ndaSignedAt).toLocaleDateString("es-ES", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        ) : ndaStatus === "pending" ? (
          <div className="space-y-1">
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
              NDA pendiente de firma
            </Badge>
            <p className="text-xs text-muted-foreground">
              Enviado, esperando firma del cliente.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {leadEmail ? (
              <Button
                size="sm"
                onClick={() => {
                  setNdaError(null);
                  startTransition(async () => {
                    const result = await sendNdaToClient(leadId);
                    if (!result.success) {
                      setNdaError(result.error || "Error al enviar el NDA");
                    }
                    router.refresh();
                  });
                }}
                disabled={isPending}
                className="block bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
              >
                {isPending ? "Enviando..." : "Enviar NDA al cliente"}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                El lead necesita un email para enviar el NDA.
              </p>
            )}
          </div>
        )}
        {ndaError && (
          <p className="mt-1 text-xs text-destructive">{ndaError}</p>
        )}
      </div>

      {/* Assign */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-card-foreground">
          Asignar a
        </h3>
        <select
          value={assignedTo || ""}
          onChange={(e) => handleAssign(e.target.value)}
          disabled={isPending}
          className={selectClass}
        >
          <option value="">Sin asignar</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.email.split("@")[0]}
            </option>
          ))}
        </select>
      </div>

      {/* Owner */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-card-foreground">
          Captado por
        </h3>
        <select
          value={ownedBy || ""}
          onChange={(e) => {
            const value = e.target.value || null;
            startTransition(async () => {
              await updateLeadOwner(leadId, value);
              router.refresh();
            });
          }}
          disabled={isPending}
          className={selectClass}
        >
          <option value="">Sin asignar</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.email.split("@")[0]}
            </option>
          ))}
        </select>

      </div>

      {/* Payment condition */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-card-foreground">
          Condicion de pago
        </h3>
        <select
          value={paymentCondition || ""}
          onChange={(e) => {
            const value = e.target.value || null;
            startTransition(async () => {
              await updatePaymentCondition(leadId, value);
              router.refresh();
            });
          }}
          disabled={isPending}
          className={selectClass}
        >
          <option value="">Sin definir</option>
          <option value="50-50">50-50 (dos plazos)</option>
          <option value="100-5">100% (-5% dto)</option>
        </select>
      </div>

      {/* Desired delivery date */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-card-foreground">
          Fecha de entrega deseada
        </h3>
        <input
          type="date"
          value={desiredDeliveryDate || ""}
          onChange={(e) => {
            const value = e.target.value || null;
            startTransition(async () => {
              await updateDesiredDeliveryDate(leadId, value);
              router.refresh();
            });
          }}
          disabled={isPending}
          className={selectClass}
        />
      </div>

      {/* Project type tag */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-card-foreground">
          Tipo de proyecto
        </h3>
        <select
          value={projectTypeTag || ""}
          onChange={(e) => {
            const value = e.target.value || null;
            startTransition(async () => {
              await updateLeadTag(leadId, value);
              router.refresh();
            });
          }}
          disabled={isPending}
          className={selectClass}
        >
          <option value="">Sin tipo</option>
          {projectTemplateTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </div>

      {/* Estimation */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-card-foreground">
          Estimacion de valor
        </h3>
        <div className="space-y-2">
          <select
            value={estimatedQuantity || ""}
            onChange={(e) => {
              const value = e.target.value || null;
              startTransition(async () => {
                await updateEstimationField(leadId, "estimated_quantity", value);
                router.refresh();
              });
            }}
            disabled={isPending}
            className={selectClass}
          >
            <option value="">Cantidad...</option>
            {QUANTITY_RANGES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          <select
            value={estimatedComplexity || ""}
            onChange={(e) => {
              const value = e.target.value || null;
              startTransition(async () => {
                await updateEstimationField(leadId, "estimated_complexity", value);
                router.refresh();
              });
            }}
            disabled={isPending}
            className={selectClass}
          >
            <option value="">Complejidad...</option>
            {COMPLEXITY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <select
            value={estimatedUrgency || ""}
            onChange={(e) => {
              const value = e.target.value || null;
              startTransition(async () => {
                await updateEstimationField(leadId, "estimated_urgency", value);
                router.refresh();
              });
            }}
            disabled={isPending}
            className={selectClass}
          >
            <option value="">Urgencia...</option>
            {URGENCY_OPTIONS.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>

          <div>
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editedValue}
                  onChange={(e) => setEditedValue(e.target.value)}
                  placeholder="0"
                  disabled={isPending}
                  className="h-8 w-28 rounded-lg border border-input bg-transparent px-2.5 pr-7 text-sm tabular-nums text-green-700 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:text-green-400"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-green-700 dark:text-green-400">€</span>
              </div>
              {editedValue !== (estimatedValue?.toString() ?? "") && (
                <Button
                  size="sm"
                  onClick={() => {
                    const val = editedValue.trim() ? parseFloat(editedValue) : null;
                    startTransition(async () => {
                      await updateEstimatedValue(leadId, val);
                      router.refresh();
                    });
                  }}
                  disabled={isPending}
                  className="h-8 bg-green-600 text-white hover:bg-green-700"
                >
                  Guardar
                </Button>
              )}
            </div>
            <span className="mt-1 block text-[11px] text-muted-foreground">valor estimado</span>
          </div>
        </div>
      </div>

      {/* Presupuesto */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-card-foreground">
          Presupuesto
        </h3>
        {(() => {
          if (!quoteRequest || (!quoteRequest.items && quoteRequest.status === "pending")) {
            return (
              <p className="text-xs text-muted-foreground">
                Crea un presupuesto en el editor de la izquierda.
              </p>
            );
          }

          const hasItems = Array.isArray(quoteRequest.items) && (quoteRequest.items as unknown[]).length > 0;
          const status = quoteRequest.status;

          if (hasItems && status === "pending") {
            return (
              <div className="space-y-2">
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  Presupuesto guardado
                </Badge>
                {leadEmail ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setQuoteError(null);
                      startTransition(async () => {
                        const result = await sendQuoteToClient(leadId);
                        if (!result.success) {
                          setQuoteError(result.error || "Error al enviar el presupuesto");
                        }
                        router.refresh();
                      });
                    }}
                    disabled={isPending}
                    className="block bg-brand text-white hover:bg-brand-dark"
                  >
                    {isPending ? "Enviando..." : "Enviar al cliente"}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    El lead necesita un email para enviar el presupuesto.
                  </p>
                )}
                {quoteError && (
                  <p className="text-xs text-destructive">{quoteError}</p>
                )}
              </div>
            );
          }

          if (status === "quote_sent") {
            return (
              <div className="space-y-2">
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                  Pendiente de datos del cliente
                </Badge>
                {quoteRequest.holded_estimate_id && (
                  <PdfPreviewButton leadId={leadId} docType="estimate" />
                )}
                <button
                  onClick={() => {
                    const baseUrl = window.location.origin;
                    navigator.clipboard.writeText(`${baseUrl}/quote/${quoteRequest.token}`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="block text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  {copied ? "Copiado!" : "Copiar enlace del presupuesto"}
                </button>
              </div>
            );
          }

          if (status === "submitted") {
            return (
              <div className="space-y-2">
                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Datos recibidos
                </Badge>
                <div className="text-xs text-muted-foreground">
                  <p><strong>Razon social:</strong> {quoteRequest.billing_name}</p>
                  <p><strong>NIF:</strong> {quoteRequest.tax_id}</p>
                </div>
                {quoteError && (
                  <p className="text-xs text-destructive">{quoteError}</p>
                )}
              </div>
            );
          }

          return null;
        })()}

        {/* Proforma & Factura — visible siempre que haya items + contacto Holded */}
        {quoteRequest && Array.isArray(quoteRequest.items) && (quoteRequest.items as unknown[]).length > 0 && quoteRequest.holded_contact_id && (
          <div className="space-y-2 border-t pt-3 mt-3">
            {/* Proforma */}
            {!quoteRequest.holded_proforma_id && (
              <Button
                size="sm"
                onClick={() => {
                  setQuoteError(null);
                  startTransition(async () => {
                    const result = await createLeadProforma(leadId);
                    if (!result.success) {
                      setQuoteError(result.error || "Error");
                    }
                    router.refresh();
                  });
                }}
                disabled={isPending}
                className="block bg-brand text-white hover:bg-brand-dark"
              >
                {isPending ? "Creando..." : "Crear proforma en Holded"}
              </Button>
            )}

            {quoteRequest.holded_proforma_id && (
              <>
                <a
                  href={`https://app.holded.com/sales/revenue#open:proform-${quoteRequest.holded_proforma_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  Ver proforma en Holded
                </a>

                <div className="flex flex-wrap gap-1.5">
                  <PdfPreviewButton leadId={leadId} docType="proform" />

                  <Button
                    size="sm"
                    onClick={async () => {
                      setSendingProforma(true);
                      setQuoteError(null);
                      setDocSent(null);
                      const result = await sendProformaToClient(leadId);
                      setSendingProforma(false);
                      if (result.success) {
                        setDocSent("proforma");
                        router.refresh();
                      } else {
                        setQuoteError(result.error || "Error");
                      }
                    }}
                    disabled={sendingProforma}
                    className="bg-brand text-white hover:bg-brand-dark"
                  >
                    {sendingProforma ? "Enviando..." : "Enviar proforma"}
                  </Button>
                </div>
              </>
            )}

            {/* Factura */}
            <div className="border-t pt-2 space-y-2">
              {quoteRequest.holded_invoice_id && (
                <>
                  <a
                    href={`https://app.holded.com/sales/revenue#open:invoice-${quoteRequest.holded_invoice_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Ver factura en Holded
                  </a>
                  <PdfPreviewButton leadId={leadId} docType="invoice" />
                </>
              )}

              <Button
                size="sm"
                onClick={async () => {
                  setSendingInvoice(true);
                  setQuoteError(null);
                  setDocSent(null);
                  const result = await sendInvoiceToClient(leadId);
                  setSendingInvoice(false);
                  if (result.success) {
                    setDocSent("factura");
                    router.refresh();
                  } else {
                    setQuoteError(result.error || "Error");
                  }
                }}
                disabled={sendingInvoice}
                className={quoteRequest.holded_invoice_id ? "" : "bg-brand text-white hover:bg-brand-dark"}
                variant={quoteRequest.holded_invoice_id ? "secondary" : "default"}
              >
                {sendingInvoice
                  ? "Enviando..."
                  : quoteRequest.holded_invoice_id
                    ? "Reenviar factura"
                    : "Crear y enviar factura"}
              </Button>
            </div>

            {docSent && (
              <p className="text-xs text-green-600 dark:text-green-400">
                {docSent === "proforma" ? "Proforma enviada" : "Factura enviada"} correctamente
              </p>
            )}

            {quoteError && (
              <p className="text-xs text-destructive">{quoteError}</p>
            )}
          </div>
        )}
      </div>

      {/* Payment section */}
      {quoteRequest && Array.isArray(quoteRequest.items) && (quoteRequest.items as unknown[]).length > 0 && quoteRequest.holded_proforma_id && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-card-foreground">Pago</h3>
          <div className="space-y-2">
            {quoteRequest.payment_status === "paid" ? (
              <div className="space-y-1">
                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Pagado
                  {quoteRequest.paid_at && (
                    <span className="ml-1 font-normal">
                      {new Date(quoteRequest.paid_at).toLocaleDateString("es-ES")}
                    </span>
                  )}
                </Badge>
                {quoteRequest.paid_amount && (
                  <p className="text-xs text-muted-foreground">
                    {Number(quoteRequest.paid_amount).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
                  </p>
                )}
              </div>
            ) : (
              <>
                <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  Pendiente de pago
                </Badge>

                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      setGeneratingPayLink(true);
                      setQuoteError(null);
                      const result = await createStripeCheckout(leadId);
                      setGeneratingPayLink(false);
                      if (result.success && result.url) {
                        setPaymentLink(result.url);
                        navigator.clipboard.writeText(result.url);
                      } else {
                        setQuoteError(result.error || "Error");
                      }
                    }}
                    disabled={generatingPayLink}
                  >
                    {generatingPayLink ? "Generando..." : paymentLink ? "Link copiado!" : "Generar link de pago"}
                  </Button>

                  <Button
                    size="sm"
                    onClick={async () => {
                      setMarkingPaid(true);
                      setQuoteError(null);
                      const result = await markAsPaid(leadId);
                      setMarkingPaid(false);
                      if (result.success) {
                        setDocSent("pago");
                        router.refresh();
                      } else {
                        setQuoteError(result.error || "Error");
                      }
                    }}
                    disabled={markingPaid}
                    className="bg-green-600 text-white hover:bg-green-700"
                  >
                    {markingPaid ? "Procesando..." : "Marcar como pagado"}
                  </Button>
                </div>

                {paymentLink && (
                  <input
                    readOnly
                    value={paymentLink}
                    onClick={(e) => {
                      (e.target as HTMLInputElement).select();
                      navigator.clipboard.writeText(paymentLink);
                    }}
                    className="w-full rounded-md border bg-muted px-2 py-1 text-xs text-muted-foreground cursor-pointer"
                  />
                )}

                {docSent === "pago" && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Pago confirmado. Factura enviada y proyecto creado.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Add note */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-card-foreground">
          Nota rapida
        </h3>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Escribe una nota..."
          rows={3}
        />
        <Button
          onClick={handleAddNote}
          disabled={isPending || !note.trim()}
          className="mt-2"
        >
          Guardar nota
        </Button>
      </div>

      {/* Block + Delete */}
      <div className="space-y-3 border-t pt-4">
        {leadEmail && (
          <>
            {!showBlock ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBlock(true)}
                className="text-orange-600 hover:text-orange-700 dark:text-orange-400"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Bloquear remitente
              </Button>
            ) : (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-900/10">
                <p className="text-sm text-orange-700 dark:text-orange-400">
                  Bloquear <strong>{leadEmail}</strong> y eliminar este lead. Los futuros emails de esta direccion no crearan leads.
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      startTransition(async () => {
                        await blockEmailAndDeleteLead(leadId, leadEmail, "Bloqueado manualmente");
                      });
                    }}
                    disabled={isPending}
                    className="bg-orange-600 text-white hover:bg-orange-700"
                  >
                    Bloquear y eliminar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowBlock(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {!showDelete ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDelete(true)}
            className="text-destructive hover:text-destructive"
          >
            Eliminar lead
          </Button>
        ) : (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">
              Esto eliminara el lead y todo su historial.
            </p>
            <div className="mt-2 flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isPending}
              >
                Confirmar eliminacion
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDelete(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
