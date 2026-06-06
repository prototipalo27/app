"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  updateLeadStatus,
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
  approveInvoiceForLead,
  createStripeCheckout,
  markAsPaid,
  requestSecondPayment,
  setPickupInPerson,
  searchHoldedInvoices,
  linkInvoiceToLead,
  sendQuoteToClient,
  sendNdaToClient,
  updateQuoteCcEmails,
  requestSampleShipment,
  cancelSampleRequest,
  type SampleRequestStatus,
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
import LeadBillingEditor from "./lead-billing-editor";
import { formatDate, formatDateMedium } from "@/lib/dates";

interface LeadActionsProps {
  leadId: string;
  leadEmail: string | null;
  currentStatus: LeadStatus;
  managers: { id: string; email: string }[];
  quoteRequest: Tables<"quote_requests"> | null;
  paymentCondition: string | null;
  projectTypeTag: string | null;
  projectTemplateTags: string[];
  estimatedQuantity: string | null;
  estimatedComplexity: string | null;
  estimatedUrgency: string | null;
  estimatedValue: number | null;
  desiredDeliveryDate: string | null;
  commission: {
    isReturning: boolean;
    rate: number;
    quoteTotal: number;
    commission: number;
    prepaidBonus: number;
  } | null;
  ndaStatus: "none" | "pending" | "signed";
  ndaId?: string;
  ndaSignedAt?: string;
  ndaSignerName?: string;
  sampleRequest: SampleRequestStatus;
  shipmentSummary?: {
    hasProject: boolean;
    projectId: string | null;
    projectStatus: string | null;
    pickupInPerson: boolean;
    shipments: Array<{
      id: string;
      carrier: string | null;
      tracking: string | null;
      status: string | null;
      shipped_at: string | null;
      title: string | null;
      is_orphan: boolean;
      destination: string | null;
    }>;
  };
}

export default function LeadActions({
  leadId,
  leadEmail,
  currentStatus,
  quoteRequest,
  paymentCondition,
  projectTypeTag,
  projectTemplateTags,
  estimatedQuantity,
  estimatedComplexity,
  estimatedUrgency,
  estimatedValue,
  desiredDeliveryDate,
  commission,
  ndaStatus,
  ndaId,
  ndaSignedAt,
  ndaSignerName,
  sampleRequest,
  shipmentSummary,
}: LeadActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Estado local del date picker: evita que router.refresh() resetee
  // el valor controlado mientras el popup nativo sigue abierto (flicker).
  const [localDeliveryDate, setLocalDeliveryDate] = useState(desiredDeliveryDate || "");
  useEffect(() => {
    setLocalDeliveryDate(desiredDeliveryDate || "");
  }, [desiredDeliveryDate]);

  const [note, setNote] = useState("");
  const [showLostReason, setShowLostReason] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sendingProforma, setSendingProforma] = useState(false);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [approvingInvoice, setApprovingInvoice] = useState(false);
  const [docSent, setDocSent] = useState<string | null>(null);
  const [generatingPayLink, setGeneratingPayLink] = useState(false);
  const [markingPaid, setMarkingPaid] = useState<null | "first_half" | "second_half" | "full">(null);
  const [paidDate, setPaidDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [requestingSecond, setRequestingSecond] = useState(false);
  const [secondLink, setSecondLink] = useState<string | null>(null);
  const [togglingPickup, setTogglingPickup] = useState(false);
  const [showInvoiceSearch, setShowInvoiceSearch] = useState(false);
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [invoiceResults, setInvoiceResults] = useState<{ id: string; docNumber: string; contactName: string; total: number; date: number }[]>([]);
  const [searchingInvoices, setSearchingInvoices] = useState(false);
  const [linkingInvoice, setLinkingInvoice] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [editedValue, setEditedValue] = useState(estimatedValue?.toString() ?? "");
  useEffect(() => {
    setEditedValue(estimatedValue?.toString() ?? "");
  }, [estimatedValue]);
  const [ndaError, setNdaError] = useState<string | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [sampleLinkCopied, setSampleLinkCopied] = useState(false);

  const selectClass =
    "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

  const handleStatusChange = (newStatus: LeadStatus) => {
    if (newStatus === "lost") {
      setShowLostReason(true);
      return;
    }
    startTransition(async () => {
      await updateLeadStatus(leadId, newStatus);
      router.refresh();
    });
  };

  const handleLostConfirm = () => {
    startTransition(async () => {
      await updateLeadStatus(leadId, "lost", lostReason || undefined);
      setShowLostReason(false);
      setLostReason("");
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
        <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
          {nextStatuses.map((col) => (
            <button
              key={col.id}
              type="button"
              onClick={() => handleStatusChange(col.id)}
              disabled={isPending}
              className={`rounded-md px-2 py-1.5 text-xs font-medium disabled:opacity-50 sm:px-3 sm:text-sm ${col.badge}`}
            >
              {col.label}
            </button>
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
              {ndaSignedAt && formatDateMedium(ndaSignedAt)}
            </p>
            {ndaId && (
              <a
                href={`/api/admin/regen-nda?id=${ndaId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Descargar PDF
              </a>
            )}
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

      {/* Envío de muestra */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-card-foreground">
          Envío de muestra
        </h3>
        {sampleRequest.status === "none" ? (
          <div className="space-y-2">
            {leadEmail ? (
              <Button
                size="sm"
                onClick={() => {
                  setSampleError(null);
                  startTransition(async () => {
                    const result = await requestSampleShipment(leadId);
                    if (!result.success) {
                      setSampleError(result.error || "Error al pedir la dirección");
                    }
                    router.refresh();
                  });
                }}
                disabled={isPending}
                className="block bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
              >
                {isPending ? "Enviando..." : "Pedir dirección al cliente"}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                El lead necesita un email para enviar la petición.
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Le enviaremos un enlace para que rellene su dirección de envío.
            </p>
          </div>
        ) : sampleRequest.status === "pending" ? (
          <div className="space-y-2">
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
              Esperando datos del cliente
            </Badge>
            <p className="text-xs text-muted-foreground">
              Petición enviada el {formatDateMedium(sampleRequest.created_at)}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const baseUrl = window.location.origin;
                  navigator.clipboard.writeText(`${baseUrl}/sample/${sampleRequest.token}`);
                  setSampleLinkCopied(true);
                  setTimeout(() => setSampleLinkCopied(false), 2000);
                }}
                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                {sampleLinkCopied ? "Copiado!" : "Copiar enlace"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSampleError(null);
                  startTransition(async () => {
                    const result = await cancelSampleRequest(leadId, sampleRequest.id);
                    if (!result.success) {
                      setSampleError(result.error || "Error al cancelar");
                    }
                    router.refresh();
                  });
                }}
                disabled={isPending}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Badge variant="secondary" className={
              sampleRequest.status === "shipped"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            }>
              {sampleRequest.status === "shipped" ? "Muestra enviada" : "Datos recibidos"}
            </Badge>
            {(sampleRequest.street || sampleRequest.city) && (
              <div className="rounded-md border bg-muted/30 px-2.5 py-2 text-xs text-muted-foreground">
                {sampleRequest.recipient_name && <p className="font-medium text-foreground">{sampleRequest.recipient_name}</p>}
                {sampleRequest.street && <p>{sampleRequest.street}</p>}
                <p>
                  {[sampleRequest.postal_code, sampleRequest.city, sampleRequest.province].filter(Boolean).join(", ")}
                </p>
                {sampleRequest.country && <p>{sampleRequest.country}</p>}
                {sampleRequest.recipient_phone && <p className="mt-1">Tel: {sampleRequest.recipient_phone}</p>}
              </div>
            )}
            {sampleRequest.status === "submitted" && (
              <Button
                size="sm"
                onClick={() => {
                  const params = new URLSearchParams({
                    leadId,
                    sampleRequestId: sampleRequest.id,
                    title: `Muestra para ${sampleRequest.recipient_name || ""}`.trim(),
                    recipientName: sampleRequest.recipient_name || "",
                    recipientEmail: sampleRequest.recipient_email || "",
                    recipientPhone: sampleRequest.recipient_phone || "",
                    street: sampleRequest.street || "",
                    city: sampleRequest.city || "",
                    postalCode: sampleRequest.postal_code || "",
                    country: sampleRequest.country === "España" || sampleRequest.country === "Spain" ? "ES" : (sampleRequest.country || "ES"),
                  });
                  router.push(`/dashboard/shipments/new?${params.toString()}`);
                }}
                disabled={isPending}
                className="block bg-cyan-600 text-white hover:bg-cyan-700"
              >
                Crear envío
              </Button>
            )}
          </div>
        )}
        {sampleError && (
          <p className="mt-1 text-xs text-destructive">{sampleError}</p>
        )}
      </div>

      {/* Atributos — todos los selectores compactos en una sola grid */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-card-foreground">Atributos</h3>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <Field label="Pago">
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
              <option value="50-50">50-50</option>
              <option value="100-5">100% (-5%)</option>
              <option value="cash">Efectivo</option>
            </select>
          </Field>

          <Field label="Entrega">
            <input
              type="date"
              value={localDeliveryDate}
              onChange={(e) => {
                const value = e.target.value;
                setLocalDeliveryDate(value);
                // Fire-and-forget: el estado local ya muestra la fecha al instante.
                // El servidor ya hace revalidatePath; la próxima navegación trae datos frescos.
                updateDesiredDeliveryDate(leadId, value || null).catch(() => {
                  setLocalDeliveryDate(desiredDeliveryDate || "");
                });
              }}
              className={selectClass}
            />
          </Field>

          <Field label="Tipo" className="col-span-2">
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
          </Field>

          <Field label="Cantidad">
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
              <option value="">—</option>
              {QUANTITY_RANGES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Complejidad">
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
              <option value="">—</option>
              {COMPLEXITY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Urgencia">
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
              <option value="">—</option>
              {URGENCY_OPTIONS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Valor estimado">
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editedValue}
                  onChange={(e) => setEditedValue(e.target.value)}
                  placeholder="0"
                  disabled={isPending}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 pr-7 text-sm tabular-nums text-green-700 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:text-green-400"
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
          </Field>
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

        {/* Datos de facturación — editables a mano para leads sin formulario web */}
        {quoteRequest && (
          <div className="border-t pt-3 mt-3">
            <LeadBillingEditor
              leadId={leadId}
              billing={{
                billing_name: quoteRequest.billing_name ?? null,
                tax_id: quoteRequest.tax_id ?? null,
                billing_address: quoteRequest.billing_address ?? null,
                billing_city: quoteRequest.billing_city ?? null,
                billing_postal_code: quoteRequest.billing_postal_code ?? null,
                billing_province: quoteRequest.billing_province ?? null,
                billing_country: quoteRequest.billing_country ?? null,
              }}
            />
          </div>
        )}

        {/* CC Emails — emails adicionales para envíos */}
        {quoteRequest && (
          <CcEmailsEditor
            quoteRequestId={quoteRequest.id}
            initialEmails={(quoteRequest as any).cc_emails || []}
          />
        )}

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

                {quoteRequest.holded_proforma_doc_number && (
                  <ProformaCodeBadge code={quoteRequest.holded_proforma_doc_number} />
                )}

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
                  {!quoteRequest.invoice_doc_number && (
                    <div className="rounded-md bg-amber-50 p-2 dark:bg-amber-900/20">
                      <p className="mb-1.5 text-xs text-amber-700 dark:text-amber-400">
                        ⚠ Esta factura está en <strong>borrador</strong> (sin número fiscal).
                      </p>
                      <Button
                        size="sm"
                        onClick={async () => {
                          setApprovingInvoice(true);
                          setQuoteError(null);
                          setDocSent(null);
                          const result = await approveInvoiceForLead(leadId);
                          setApprovingInvoice(false);
                          if (result.success) {
                            setDocSent("factura-aprobada");
                            router.refresh();
                          } else {
                            setQuoteError(result.error || "Error al aprobar la factura");
                          }
                        }}
                        disabled={approvingInvoice}
                        className="bg-amber-600 text-white hover:bg-amber-700"
                      >
                        {approvingInvoice ? "Aprobando..." : "Aprobar factura (emitir definitiva)"}
                      </Button>
                    </div>
                  )}
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
                {docSent === "proforma"
                  ? "Proforma enviada"
                  : docSent === "factura-aprobada"
                    ? "Factura emitida (definitiva)"
                    : "Factura enviada"}{" "}
                correctamente
              </p>
            )}

            {quoteError && (
              <p className="text-xs text-destructive">{quoteError}</p>
            )}
          </div>
        )}
      </div>

      {/* Payment section */}
      {quoteRequest && Array.isArray(quoteRequest.items) && (quoteRequest.items as unknown[]).length > 0 && quoteRequest.holded_proforma_id && (() => {
        const isSplit = quoteRequest.payment_option === "split";
        const fmt = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const items = (quoteRequest.items as unknown as { price: number; units: number; tax: number }[]) || [];
        const discount = quoteRequest.payment_option === "full" ? 0.95 : 1;
        const subtotal = items.reduce((s, i) => s + i.price * i.units * discount, 0);
        const taxTotal = items.reduce((s, i) => s + i.price * i.units * discount * (i.tax / 100), 0);
        const grandTotal = subtotal + taxTotal;
        const halfTotal = grandTotal * 0.5;

        const firstPaidAmount = quoteRequest.first_paid_amount != null ? Number(quoteRequest.first_paid_amount) : null;
        const firstFee = quoteRequest.first_stripe_fee_amount != null ? Number(quoteRequest.first_stripe_fee_amount) : null;
        const secondPaidAmount = quoteRequest.second_paid_amount != null ? Number(quoteRequest.second_paid_amount) : null;
        const secondFee = quoteRequest.second_stripe_fee_amount != null ? Number(quoteRequest.second_stripe_fee_amount) : null;
        const secondRequested = quoteRequest.second_payment_requested_at;

        // SPLIT — dos filas (primer 50% / segundo 50%)
        if (isSplit) {
          return (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-card-foreground">Pago (50% + 50%)</h3>
              <div className="space-y-3">
                {/* Primer 50% */}
                <div className="rounded-md border border-border bg-card/50 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-card-foreground">Primer 50%</span>
                    {firstPaidAmount ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Pagado
                        {quoteRequest.first_paid_at && <span className="ml-1 font-normal">{formatDate(quoteRequest.first_paid_at)}</span>}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        Pendiente
                      </Badge>
                    )}
                  </div>
                  {firstPaidAmount ? (
                    <div className="text-xs text-muted-foreground">
                      <p>{fmt(firstPaidAmount)} €</p>
                      {firstFee != null && (
                        <p className="mt-0.5 text-[11px]">
                          <span className="text-zinc-500">Comisión Stripe </span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">{fmt(firstFee)} €</span>
                          <span className="text-zinc-500"> · neto </span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">{fmt(firstPaidAmount - firstFee)} €</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Importe: <span className="font-medium text-card-foreground">{fmt(halfTotal)} €</span></p>
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
                          {generatingPayLink ? "Generando..." : paymentLink ? "Link copiado!" : "Link pago tarjeta"}
                        </Button>
                        <input
                          type="date"
                          value={paidDate}
                          onChange={(e) => setPaidDate(e.target.value)}
                          disabled={markingPaid !== null}
                          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                          title="Fecha de pago"
                        />
                        <Button
                          size="sm"
                          onClick={async () => {
                            setMarkingPaid("first_half");
                            setQuoteError(null);
                            const iso = paidDate ? new Date(paidDate + "T12:00:00").toISOString() : undefined;
                            const result = await markAsPaid(leadId, iso, "first_half");
                            setMarkingPaid(null);
                            if (result.success) {
                              router.refresh();
                            } else {
                              setQuoteError(result.error || "Error");
                            }
                          }}
                          disabled={markingPaid !== null}
                          className="bg-green-600 text-white hover:bg-green-700"
                        >
                          {markingPaid === "first_half" ? "Procesando..." : "Marcar 1º como pagado"}
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
                    </div>
                  )}
                </div>

                {/* Segundo 50% */}
                <div className="rounded-md border border-border bg-card/50 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-card-foreground">Segundo 50%</span>
                    {secondPaidAmount ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Pagado
                        {quoteRequest.second_paid_at && <span className="ml-1 font-normal">{formatDate(quoteRequest.second_paid_at)}</span>}
                      </Badge>
                    ) : secondRequested ? (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        Solicitado {formatDate(secondRequested)}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        Pendiente
                      </Badge>
                    )}
                  </div>
                  {secondPaidAmount ? (
                    <div className="text-xs text-muted-foreground">
                      <p>{fmt(secondPaidAmount)} €</p>
                      {secondFee != null && (
                        <p className="mt-0.5 text-[11px]">
                          <span className="text-zinc-500">Comisión Stripe </span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">{fmt(secondFee)} €</span>
                          <span className="text-zinc-500"> · neto </span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">{fmt(secondPaidAmount - secondFee)} €</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Importe: <span className="font-medium text-card-foreground">{fmt(halfTotal)} €</span></p>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={async () => {
                            setRequestingSecond(true);
                            setQuoteError(null);
                            const result = await requestSecondPayment(leadId);
                            setRequestingSecond(false);
                            if (result.success) {
                              if (result.url) {
                                setSecondLink(result.url);
                                navigator.clipboard.writeText(result.url);
                              }
                              router.refresh();
                            } else {
                              setQuoteError(result.error || "Error");
                            }
                          }}
                          disabled={requestingSecond || !firstPaidAmount}
                          className="bg-brand text-white hover:bg-brand-dark"
                          title={!firstPaidAmount ? "Aún no se ha cobrado el primer 50%" : undefined}
                        >
                          {requestingSecond
                            ? "Enviando..."
                            : secondRequested
                              ? "Reenviar solicitud"
                              : "Solicitar segundo pago"}
                        </Button>
                        <input
                          type="date"
                          value={paidDate}
                          onChange={(e) => setPaidDate(e.target.value)}
                          disabled={markingPaid !== null}
                          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                          title="Fecha de pago"
                        />
                        <Button
                          size="sm"
                          onClick={async () => {
                            setMarkingPaid("second_half");
                            setQuoteError(null);
                            const iso = paidDate ? new Date(paidDate + "T12:00:00").toISOString() : undefined;
                            const result = await markAsPaid(leadId, iso, "second_half");
                            setMarkingPaid(null);
                            if (result.success) {
                              router.refresh();
                            } else {
                              setQuoteError(result.error || "Error");
                            }
                          }}
                          disabled={markingPaid !== null || !firstPaidAmount}
                          className="bg-green-600 text-white hover:bg-green-700"
                          title={!firstPaidAmount ? "Aún no se ha cobrado el primer 50%" : undefined}
                        >
                          {markingPaid === "second_half" ? "Procesando..." : "Marcar 2º como pagado"}
                        </Button>
                      </div>
                      {secondLink && (
                        <input
                          readOnly
                          value={secondLink}
                          onClick={(e) => {
                            (e.target as HTMLInputElement).select();
                            navigator.clipboard.writeText(secondLink);
                          }}
                          className="w-full rounded-md border bg-muted px-2 py-1 text-xs text-muted-foreground cursor-pointer"
                        />
                      )}
                    </div>
                  )}
                </div>
                {quoteError && <p className="text-xs text-destructive">{quoteError}</p>}
              </div>
            </div>
          );
        }

        // FULL o sin payment_option — UI clásica de una sola fila
        return (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-card-foreground">Pago</h3>
            <div className="space-y-2">
              {quoteRequest.payment_status === "paid" ? (
                <div className="space-y-1">
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Pagado
                    {quoteRequest.paid_at && (
                      <span className="ml-1 font-normal">
                        {formatDate(quoteRequest.paid_at)}
                      </span>
                    )}
                  </Badge>
                  {quoteRequest.paid_amount && (() => {
                    const paid = Number(quoteRequest.paid_amount);
                    const fee = quoteRequest.stripe_fee_amount != null
                      ? Number(quoteRequest.stripe_fee_amount)
                      : null;
                    const net = fee != null ? paid - fee : null;
                    return (
                      <div className="text-xs text-muted-foreground">
                        <p>{fmt(paid)} €</p>
                        {fee != null && net != null && (
                          <p className="mt-0.5 text-[11px]">
                            <span className="text-zinc-500">Comisión Stripe </span>
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">{fmt(fee)} €</span>
                            <span className="text-zinc-500"> · neto al banco </span>
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">{fmt(net)} €</span>
                          </p>
                        )}
                      </div>
                    );
                  })()}
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
                      {generatingPayLink ? "Generando..." : paymentLink ? "Link copiado!" : "Link pago tarjeta"}
                    </Button>

                    <input
                      type="date"
                      value={paidDate}
                      onChange={(e) => setPaidDate(e.target.value)}
                      disabled={markingPaid !== null}
                      className="h-9 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                      title="Fecha de pago"
                    />

                    <Button
                      size="sm"
                      onClick={async () => {
                        setMarkingPaid("full");
                        setQuoteError(null);
                        const iso = paidDate ? new Date(paidDate + "T12:00:00").toISOString() : undefined;
                        const result = await markAsPaid(leadId, iso, "full");
                        setMarkingPaid(null);
                        if (result.success) {
                          setDocSent("pago");
                          router.refresh();
                        } else {
                          setQuoteError(result.error || "Error");
                        }
                      }}
                      disabled={markingPaid !== null}
                      className="bg-green-600 text-white hover:bg-green-700"
                    >
                      {markingPaid === "full" ? "Procesando..." : "Marcar como pagado"}
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
                  {quoteError && <p className="text-xs text-destructive">{quoteError}</p>}
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Logística: recogida en persona silencia la alerta de "falta dirección" */}
      {quoteRequest && (
        <div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(quoteRequest.pickup_in_person)}
              disabled={togglingPickup}
              onChange={async (e) => {
                const next = e.target.checked;
                setTogglingPickup(true);
                const result = await setPickupInPerson(leadId, next);
                setTogglingPickup(false);
                if (result.success) router.refresh();
              }}
              className="rounded border-zinc-300 text-brand focus:ring-brand-blue dark:border-zinc-700"
            />
            <span>Recogida en persona <span className="text-muted-foreground/70">(no necesita envío)</span></span>
          </label>
        </div>
      )}

      {/* Envío — read-only para comercial; Mery prepara los envíos */}
      {quoteRequest && shipmentSummary && (() => {
        const { hasProject, pickupInPerson, shipments } = shipmentSummary;
        const carrierLabel = (c: string | null) => {
          if (!c) return "Envío";
          const u = c.toUpperCase();
          if (u === "MRW" || u === "GLS") return u;
          if (u.includes("CABIFY")) return "Cabify";
          if (u.includes("PACKLINK")) return "Packlink";
          return c;
        };
        const statusLabel = (s: string | null) => {
          if (!s) return "—";
          const l = s.toLowerCase();
          if (l === "delivered") return "Entregado";
          if (l.includes("transit") || l === "in_transit") return "En tránsito";
          if (l === "pending") return "Pendiente";
          return s;
        };
        const statusClass = (s: string | null) => {
          const l = (s ?? "").toLowerCase();
          if (l === "delivered") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
          if (l.includes("transit") || l === "in_transit") return "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400";
          return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
        };

        return (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-card-foreground">Envío</h3>
            {pickupInPerson ? (
              <p className="text-xs text-muted-foreground">
                Recogida en persona — el cliente lo recoge en mano. No hay envío que preparar.
              </p>
            ) : shipments.length === 0 ? (
              <div className="rounded-md border border-dashed border-zinc-300 bg-muted/30 p-2.5 dark:border-zinc-700">
                <p className="text-xs text-muted-foreground">
                  {hasProject
                    ? "Pendiente de preparar (lo hace Mery desde el proyecto)."
                    : "Aún no hay proyecto creado. El envío se preparará cuando entre el pago."}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {shipments.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-card/50 px-2.5 py-1.5"
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {carrierLabel(s.carrier)}
                      </span>
                      {s.is_orphan && (
                        <span
                          className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                          title="Envío sin proyecto vinculado — típicamente muestra previa"
                        >
                          Muestra
                        </span>
                      )}
                      {s.tracking && (
                        <span className="truncate font-mono text-[11px] text-muted-foreground">
                          {s.tracking}
                        </span>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass(s.status)}`}>
                      {statusLabel(s.status)}
                    </span>
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground/70">
                  Los envíos los prepara Mery desde el proyecto. Esto es solo informativo.
                </p>
              </div>
            )}
          </div>
        );
      })()}

      {/* Link Holded invoice */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-card-foreground">Vincular factura</h3>
        {!showInvoiceSearch ? (
          <button
            onClick={() => setShowInvoiceSearch(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Buscar factura en Holded
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={invoiceQuery}
                onChange={(e) => setInvoiceQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && invoiceQuery.trim()) {
                    setSearchingInvoices(true);
                    searchHoldedInvoices(invoiceQuery.trim()).then((results) => {
                      setInvoiceResults(results);
                      setSearchingInvoices(false);
                    });
                  }
                }}
                placeholder="Numero o nombre..."
                className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                autoFocus
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (!invoiceQuery.trim()) return;
                  setSearchingInvoices(true);
                  searchHoldedInvoices(invoiceQuery.trim()).then((results) => {
                    setInvoiceResults(results);
                    setSearchingInvoices(false);
                  });
                }}
                disabled={searchingInvoices || !invoiceQuery.trim()}
              >
                {searchingInvoices ? "..." : "Buscar"}
              </Button>
              <button
                onClick={() => { setShowInvoiceSearch(false); setInvoiceResults([]); setInvoiceQuery(""); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
            </div>

            {invoiceResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-md border">
                {invoiceResults.map((inv) => (
                  <button
                    key={inv.id}
                    onClick={async () => {
                      setLinkingInvoice(true);
                      const result = await linkInvoiceToLead(leadId, inv.id);
                      setLinkingInvoice(false);
                      if (result.success) {
                        setShowInvoiceSearch(false);
                        setInvoiceResults([]);
                        setInvoiceQuery("");
                        router.refresh();
                      } else {
                        setQuoteError(result.error || "Error");
                      }
                    }}
                    disabled={linkingInvoice}
                    className="flex w-full items-center justify-between border-b px-3 py-2 text-left last:border-0 hover:bg-muted/50 disabled:opacity-50"
                  >
                    <div>
                      <p className="text-xs font-medium text-foreground">{inv.docNumber}</p>
                      <p className="text-[11px] text-muted-foreground">{inv.contactName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold tabular-nums">{inv.total.toFixed(2)} €</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDate(new Date(inv.date * 1000))}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {invoiceResults.length === 0 && invoiceQuery && !searchingInvoices && (
              <p className="text-xs text-muted-foreground">Sin resultados</p>
            )}
          </div>
        )}
      </div>

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

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

// ── CC Emails Editor ────────────────────────────────────────────

function CcEmailsEditor({
  quoteRequestId,
  initialEmails,
}: {
  quoteRequestId: string;
  initialEmails: { email: string; label: string }[];
}) {
  const [emails, setEmails] = useState(initialEmails);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const update = (i: number, field: "email" | "label", value: string) => {
    setEmails((prev) => prev.map((e, j) => (j === i ? { ...e, [field]: value } : e)));
    setDirty(true);
  };

  const add = () => {
    setEmails((prev) => [...prev, { email: "", label: "" }]);
    setDirty(true);
  };

  const remove = (i: number) => {
    setEmails((prev) => prev.filter((_, j) => j !== i));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    const clean = emails.filter((e) => e.email.trim());
    await updateQuoteCcEmails(quoteRequestId, clean);
    setEmails(clean);
    setSaving(false);
    setDirty(false);
  };

  return (
    <div className="mt-3 border-t pt-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Emails adicionales (CC)</p>
        <button
          type="button"
          onClick={add}
          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
        >
          + Añadir
        </button>
      </div>
      {emails.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Compras, facturación u otros dptos. que reciban la documentación.
        </p>
      )}
      {emails.map((entry, i) => (
        <div key={i} className="mb-1.5 flex items-center gap-1.5">
          <input
            type="email"
            value={entry.email}
            onChange={(e) => update(i, "email", e.target.value)}
            placeholder="compras@empresa.com"
            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
          <input
            type="text"
            value={entry.label}
            onChange={(e) => update(i, "label", e.target.value)}
            placeholder="Dpto."
            className="w-20 rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      {dirty && (
        <Button size="sm" onClick={save} disabled={saving} className="mt-1.5 h-7 text-xs">
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      )}
    </div>
  );
}

function ProformaCodeBadge({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900/40">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Concepto pago</span>
      <code className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">{code}</code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="ml-auto text-xs text-blue-600 hover:underline dark:text-blue-400"
      >
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
