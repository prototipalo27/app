"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateLeadStatus,
  assignLead,
  addNote,
  deleteLead,
  blockEmailAndDeleteLead,
  updatePaymentCondition,
  updateLeadTag,
  updateQualificationLevel,
  updateEstimationField,
  updateEstimatedValue,
  getProformaDetails,
  createLeadProforma,
  updateLeadOwner,
  sendQuoteToClient,
} from "../actions";
import type { Tables } from "@/lib/supabase/database.types";
import type { HoldedDocument } from "@/lib/holded/types";
import {
  LEAD_COLUMNS,
  STATUS_LABELS,
  QUANTITY_RANGES,
  COMPLEXITY_OPTIONS,
  URGENCY_OPTIONS,
  QUALIFICATION_LEVELS,
  type LeadStatus,
} from "@/lib/crm-config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

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
  qualificationLevel: number | null;
  nextId: string | null;
  ownedBy: string | null;
  commission: {
    isReturning: boolean;
    rate: number;
    quoteTotal: number;
    commission: number;
  } | null;
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
  qualificationLevel,
  nextId,
  ownedBy,
  commission,
}: LeadActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [note, setNote] = useState("");
  const [showLostReason, setShowLostReason] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [proformaOpen, setProformaOpen] = useState(false);
  const [proformaLoading, setProformaLoading] = useState(false);
  const [proformaData, setProformaData] = useState<HoldedDocument | null>(null);
  const [proformaError, setProformaError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [editedValue, setEditedValue] = useState(estimatedValue?.toString() ?? "");

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

  const handleViewProforma = async () => {
    if (proformaData) {
      setProformaOpen(!proformaOpen);
      return;
    }
    setProformaLoading(true);
    setProformaError(null);
    const result = await getProformaDetails(leadId);
    setProformaLoading(false);
    if (result.success && result.proforma) {
      setProformaData(result.proforma);
      setProformaOpen(true);
    } else {
      setProformaError(result.error || "Error al cargar la proforma");
    }
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

        {commission && (
          <div className="mt-2 space-y-1">
            <Badge
              variant="secondary"
              className={
                commission.isReturning
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              }
            >
              {commission.isReturning ? "Recurrente 7.5%" : "Nuevo 15%"}
            </Badge>
            <p className="text-xs text-muted-foreground">
              Comision: <span className="font-semibold text-foreground">{commission.commission.toFixed(2)} €</span>
              <span className="ml-1 text-muted-foreground/70">(sobre {commission.quoteTotal.toFixed(2)} €)</span>
            </p>
          </div>
        )}
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

      {/* Qualification level */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-card-foreground">
          Nivel de cualificacion
        </h3>
        <div className="flex gap-1">
          {QUALIFICATION_LEVELS.map((q) => (
            <button
              key={q.level}
              onClick={() => {
                startTransition(async () => {
                  await updateQualificationLevel(leadId, q.level);
                  router.refresh();
                });
              }}
              disabled={isPending}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border text-sm transition-colors ${
                qualificationLevel === q.level
                  ? `${q.badge} border-current font-bold`
                  : "border-input text-muted-foreground hover:bg-muted"
              }`}
              title={`Nivel ${q.level}: ${q.label}`}
            >
              {q.level}
            </button>
          ))}
        </div>
        {qualificationLevel != null && (
          <p className="mt-1 text-xs text-muted-foreground">
            {"★".repeat(qualificationLevel)} {QUALIFICATION_LEVELS.find((q) => q.level === qualificationLevel)?.label}
          </p>
        )}
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
                  <p><strong>Razón social:</strong> {quoteRequest.billing_name}</p>
                  <p><strong>NIF:</strong> {quoteRequest.tax_id}</p>
                </div>

                {!quoteRequest.holded_proforma_id && quoteRequest.holded_contact_id && (
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

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleViewProforma}
                      disabled={proformaLoading}
                    >
                      {proformaLoading ? (
                        <>
                          <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Cargando...
                        </>
                      ) : (
                        <>
                          <svg className={`h-3 w-3 transition-transform ${proformaOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          {proformaOpen ? "Ocultar proforma" : "Ver proforma"}
                        </>
                      )}
                    </Button>

                    {proformaError && (
                      <p className="text-xs text-destructive">{proformaError}</p>
                    )}

                    {proformaOpen && proformaData && (
                      <div className="rounded-lg border bg-muted/50 p-3">
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-foreground">
                            Proforma {proformaData.docNumber}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(proformaData.date * 1000).toLocaleDateString("es-ES", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </p>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[11px]">
                            <thead>
                              <tr className="border-b text-muted-foreground">
                                <th className="pb-1.5 pr-2 font-medium">Producto</th>
                                <th className="pb-1.5 pr-2 text-right font-medium">Uds</th>
                                <th className="pb-1.5 pr-2 text-right font-medium">Precio</th>
                                <th className="pb-1.5 text-right font-medium">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="text-foreground">
                              {proformaData.products.map((p, i) => {
                                const lineSubtotal = p.units * p.price * (1 - p.discount / 100);
                                return (
                                  <tr key={i} className="border-b border-border/50">
                                    <td className="py-1.5 pr-2">
                                      <span className="font-medium">{p.name}</span>
                                      {p.desc && (
                                        <span className="block text-[10px] text-muted-foreground">{p.desc}</span>
                                      )}
                                    </td>
                                    <td className="py-1.5 pr-2 text-right tabular-nums">{p.units}</td>
                                    <td className="py-1.5 pr-2 text-right tabular-nums">{p.price.toFixed(2)} €</td>
                                    <td className="py-1.5 text-right tabular-nums">{lineSubtotal.toFixed(2)} €</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className="mt-3 space-y-1 border-t pt-2 text-[11px]">
                          <div className="flex justify-between text-muted-foreground">
                            <span>Subtotal</span>
                            <span className="tabular-nums">{proformaData.subtotal.toFixed(2)} €</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>IVA</span>
                            <span className="tabular-nums">{proformaData.tax.toFixed(2)} €</span>
                          </div>
                          <div className="flex justify-between text-sm font-semibold text-foreground">
                            <span>Total</span>
                            <span className="tabular-nums">{proformaData.total.toFixed(2)} €</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {quoteError && (
                  <p className="text-xs text-destructive">{quoteError}</p>
                )}
              </div>
            );
          }

          return null;
        })()}
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
