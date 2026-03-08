"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DragDropProvider } from "@dnd-kit/react";
import { useDroppable } from "@dnd-kit/react";
import { LEAD_COLUMNS, QUALIFICATION_LEVELS, type LeadStatus } from "@/lib/crm-config";
import { CrmCard, agingClasses, tagClasses, type LeadWithAssignee } from "./crm-card";
import { updateLeadStatus, dismissLead, getLeadEmails } from "./actions";
import { ContactModal } from "./contact-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface CrmKanbanProps {
  initialLeads: LeadWithAssignee[];
  managers: { id: string; name: string }[];
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "…";
}

function CrmColumn({
  column,
  leads,
}: {
  column: (typeof LEAD_COLUMNS)[number];
  leads: LeadWithAssignee[];
}) {
  const { ref, isDropTarget } = useDroppable({ id: column.id });

  const totalValue = leads.reduce((sum, l) => sum + (l.estimated_value ?? 0), 0);

  return (
    <div className="flex min-w-0 flex-col rounded-xl bg-muted">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className={`h-2.5 w-2.5 rounded-full ${column.accent}`} />
        <h3 className="text-sm font-semibold text-foreground">
          {column.label}
        </h3>
        <Badge variant="secondary" className={`ml-auto ${column.badge}`}>
          {leads.length}
        </Badge>
      </div>
      {totalValue > 0 && (
        <div className="px-3 pb-1">
          <span className="text-[11px] font-medium text-green-600 dark:text-green-400">
            {totalValue.toLocaleString("es-ES")} €
          </span>
        </div>
      )}

      <div
        ref={ref}
        className={`flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2 transition-colors ${
          isDropTarget
            ? "rounded-b-xl ring-2 ring-brand/50 ring-inset"
            : ""
        }`}
      >
        {leads.map((lead) => (
          <CrmCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  );
}

export function CrmKanban({ initialLeads, managers }: CrmKanbanProps) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [filterManager, setFilterManager] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("qualification");
  const [lostModal, setLostModal] = useState<{
    leadId: string;
    previousStatus: string;
  } | null>(null);
  const [lostReason, setLostReason] = useState("");

  const handleDragEnd = useCallback(
    (event: {
      operation: {
        source: { id: string | number } | null;
        target: { id: string | number } | null;
      };
    }) => {
      const { source, target } = event.operation;
      if (!source || !target) return;

      const leadId = String(source.id);
      const newStatus = String(target.id) as LeadStatus;

      const lead = leads.find((l) => l.id === leadId);
      if (!lead || lead.status === newStatus) return;
      if (!LEAD_COLUMNS.some((col) => col.id === newStatus)) return;

      const previousStatus = lead.status;

      if (newStatus === "lost") {
        setLostModal({ leadId, previousStatus });
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId ? { ...l, status: newStatus } : l
          )
        );
        return;
      }

      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, status: newStatus } : l
        )
      );

      updateLeadStatus(leadId, newStatus).catch(() => {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId ? { ...l, status: previousStatus } : l
          )
        );
      });
    },
    [leads]
  );

  const handleLostConfirm = () => {
    if (!lostModal) return;
    updateLeadStatus(lostModal.leadId, "lost", lostReason || undefined).catch(
      () => {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === lostModal.leadId
              ? { ...l, status: lostModal.previousStatus }
              : l
          )
        );
      }
    );
    setLostModal(null);
    setLostReason("");
  };

  const handleLostCancel = () => {
    if (!lostModal) return;
    setLeads((prev) =>
      prev.map((l) =>
        l.id === lostModal.leadId
          ? { ...l, status: lostModal.previousStatus }
          : l
      )
    );
    setLostModal(null);
    setLostReason("");
  };

  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [contactModal, setContactModal] = useState<{
    leadId: string;
    leadName: string;
    leadEmail: string | null;
    leadCompany: string | null;
    emailSubjectTag: string | null;
    leadNumber: number | null;
    holdedProformaId: string | null;
    activities: Array<{
      id: string;
      activity_type: string;
      content: string | null;
      metadata: unknown;
      thread_id: string | null;
      created_at: string;
      created_by: string | null;
    }>;
  } | null>(null);
  const [loadingContactId, setLoadingContactId] = useState<string | null>(null);

  const handleContact = async (lead: LeadWithAssignee) => {
    setLoadingContactId(lead.id);
    const result = await getLeadEmails(lead.id);
    if (result.success) {
      setContactModal({
        leadId: lead.id,
        leadName: lead.full_name,
        leadEmail: result.lead.email,
        leadCompany: result.lead.company,
        emailSubjectTag: result.lead.email_subject_tag,
        leadNumber: result.lead.lead_number,
        holdedProformaId: result.holdedProformaId,
        activities: result.activities,
      });
    }
    setLoadingContactId(null);
  };

  const handleDismiss = async (lead: LeadWithAssignee) => {
    if (!confirm(lead.email ? `Bloquear ${lead.email} y eliminar este lead?` : "Eliminar este lead?")) return;
    setDismissingId(lead.id);
    const result = await dismissLead(lead.id, lead.email);
    if (result.success) {
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    }
    setDismissingId(null);
  };

  const uniqueTags = [...new Set(leads.map((l) => l.project_type_tag).filter(Boolean))] as string[];

  const filteredLeads = leads.filter((l) => {
    if (filterManager !== "all") {
      if (filterManager === "unassigned" && l.assigned_to) return false;
      if (filterManager !== "unassigned" && l.assigned_to !== filterManager) return false;
    }
    if (filterType !== "all") {
      if (filterType === "none" && l.project_type_tag) return false;
      if (filterType !== "none" && l.project_type_tag !== filterType) return false;
    }
    if (filterLevel !== "all") {
      const lvl = Number(filterLevel);
      if (l.qualification_level !== lvl) return false;
    }
    return true;
  });

  const sortFn = (a: LeadWithAssignee, b: LeadWithAssignee) => {
    if (sortBy === "price_desc") return (b.estimated_value ?? 0) - (a.estimated_value ?? 0);
    if (sortBy === "price_asc") return (a.estimated_value ?? 0) - (b.estimated_value ?? 0);
    if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return (b.qualification_level ?? 0) - (a.qualification_level ?? 0);
  };

  const newLeads = filteredLeads
    .filter((l) => l.status === "new")
    .sort(sortFn);
  const kanbanColumns = LEAD_COLUMNS.filter((col) => col.id !== "new");

  return (
    <>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2 md:gap-3">
        <Select value={filterManager} onValueChange={(v) => v && setFilterManager(v)}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="Comercial" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los comerciales</SelectItem>
            {managers.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
            <SelectItem value="unassigned">Sin asignar</SelectItem>
          </SelectContent>
        </Select>

        {uniqueTags.length > 0 && (
          <Select value={filterType} onValueChange={(v) => v && setFilterType(v)}>
            <SelectTrigger size="sm">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {uniqueTags.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
              <SelectItem value="none">Sin tipo</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Select value={filterLevel} onValueChange={(v) => v && setFilterLevel(v)}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="Nivel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los niveles</SelectItem>
            {QUALIFICATION_LEVELS.map((q) => (
              <SelectItem key={q.level} value={String(q.level)}>
                {"★".repeat(q.level)} {q.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => v && setSortBy(v)}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="qualification">Nivel (mayor primero)</SelectItem>
            <SelectItem value="price_desc">Precio estimado ↓</SelectItem>
            <SelectItem value="price_asc">Precio estimado ↑</SelectItem>
            <SelectItem value="newest">Mas recientes</SelectItem>
            <SelectItem value="oldest">Mas antiguos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* New leads strip */}
      {newLeads.length > 0 && (
        <div className="mb-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2 px-4 py-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Nuevos</h3>
            <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
              {newLeads.length}
            </span>
          </div>
          {/* Mobile: card layout */}
          <div className="grid grid-cols-1 gap-3 p-3 md:hidden">
            {newLeads.map((lead) => {
              const aging = (() => {
                const diff = Date.now() - new Date(lead.created_at).getTime();
                const mins = Math.floor(diff / 60000);
                if (mins < 60) return `${mins}m`;
                const hours = Math.floor(mins / 60);
                if (hours < 24) return `${hours}h`;
                return `${Math.floor(hours / 24)}d`;
              })();
              const ql = lead.qualification_level != null ? QUALIFICATION_LEVELS.find((q) => q.level === lead.qualification_level) : null;
              return (
                <div
                  key={lead.id}
                  className="rounded-lg border border-zinc-200 bg-white p-3.5 transition-colors active:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:active:bg-zinc-700"
                  onClick={() => router.push(`/dashboard/crm/${lead.id}`)}
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

                  {/* Row 2: Tags */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {lead.project_type_tag && (
                      <Badge variant="secondary" className={tagClasses(lead.project_type_tag)}>
                        {lead.project_type_tag}
                      </Badge>
                    )}
                    {ql && (
                      <Badge variant="secondary" className={ql.badge}>
                        {"★".repeat(ql.level)}
                      </Badge>
                    )}
                    {lead.assignee_email && (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                        {lead.assignee_email.split("@")[0]}
                      </span>
                    )}
                    {lead.attachments && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        Adjuntos
                      </span>
                    )}
                  </div>

                  {/* Row 3: Actions */}
                  <div className="mt-3 flex items-center gap-2">
                    {lead.phone ? (
                      <a
                        href={`tel:${lead.phone}`}
                        className="flex items-center gap-1 rounded-md bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        Llamar
                      </a>
                    ) : null}
                    <div className="ml-auto flex items-center gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleDismiss(lead); }}
                        disabled={dismissingId === lead.id}
                      >
                        {dismissingId === lead.id ? "..." : "Descartar"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (lead.email) {
                            handleContact(lead);
                          } else {
                            router.push(`/dashboard/crm/${lead.id}`);
                          }
                        }}
                        disabled={loadingContactId === lead.id}
                        className="bg-blue-600 text-white hover:bg-blue-700"
                      >
                        {loadingContactId === lead.id ? "..." : lead.email ? "Contactar" : "Ver"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: table rows */}
          <div className="hidden divide-y divide-zinc-100 md:block dark:divide-zinc-800/50">
            {newLeads.map((lead) => (
              <div
                key={lead.id}
                className="group flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
                onClick={() => router.push(`/dashboard/crm/${lead.id}`)}
              >
                {/* Owner badge */}
                <div className="shrink-0 w-8 text-center">
                  {lead.assignee_email ? (
                    <span
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold uppercase text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                      title={lead.assignee_email.split("@")[0]}
                    >
                      {lead.assignee_email.split("@")[0].slice(0, 2)}
                    </span>
                  ) : (
                    <span
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[11px] text-muted-foreground"
                      title="Sin asignar"
                    >
                      —
                    </span>
                  )}
                </div>

                {/* Name + company + aging */}
                <div className="min-w-0 shrink-0 basis-44">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {lead.full_name}
                    <span className={`ml-1.5 text-[11px] font-normal ${agingClasses(lead.created_at)}`}>
                      {(() => {
                        const diff = Date.now() - new Date(lead.created_at).getTime();
                        const mins = Math.floor(diff / 60000);
                        if (mins < 60) return `${mins}m`;
                        const hours = Math.floor(mins / 60);
                        if (hours < 24) return `${hours}h`;
                        return `${Math.floor(hours / 24)}d`;
                      })()}
                    </span>
                  </p>
                  {lead.company && (
                    <p className="truncate text-xs text-muted-foreground">
                      {lead.company}
                    </p>
                  )}
                </div>

                {/* Message */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {lead.message ? truncateWords(lead.message, 30) : "—"}
                  </p>
                  {lead.attachments && (
                    <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      Archivos adjuntos
                    </span>
                  )}
                </div>

                {/* Type tag */}
                {lead.project_type_tag && (
                  <Badge variant="secondary" className={tagClasses(lead.project_type_tag)}>
                    {lead.project_type_tag}
                  </Badge>
                )}

                {/* Estimated value */}
                {lead.estimated_value != null && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    {lead.estimated_value.toLocaleString("es-ES")} €
                  </Badge>
                )}

                {/* Qualification level */}
                {lead.qualification_level != null && (() => {
                  const ql = QUALIFICATION_LEVELS.find((q) => q.level === lead.qualification_level);
                  if (!ql) return null;
                  return (
                    <Badge variant="secondary" className={ql.badge} title={`Nivel ${ql.level}: ${ql.label}`}>
                      {"★".repeat(ql.level)}
                    </Badge>
                  );
                })()}

                {/* Phone */}
                {lead.phone ? (
                  <a
                    href={`tel:${lead.phone}`}
                    className="shrink-0 text-xs text-muted-foreground/70 hover:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {lead.phone}
                  </a>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground/40">
                    Sin tel.
                  </span>
                )}

                {/* Action buttons — visible on hover */}
                <div className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleDismiss(lead); }}
                    disabled={dismissingId === lead.id}
                    title={lead.email ? `Bloquear ${lead.email} y eliminar` : "Eliminar lead"}
                  >
                    {dismissingId === lead.id ? "..." : "Descartar"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (lead.email) {
                        handleContact(lead);
                      } else {
                        router.push(`/dashboard/crm/${lead.id}`);
                      }
                    }}
                    disabled={loadingContactId === lead.id}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {loadingContactId === lead.id
                      ? "..."
                      : lead.email
                        ? "Contactar"
                        : "Ver lead"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kanban */}
      <DragDropProvider onDragEnd={handleDragEnd}>
        <div className="grid min-h-0 flex-1 auto-cols-[200px] grid-flow-col gap-3 overflow-x-auto pb-4 md:grid-cols-4 md:auto-cols-auto md:gap-4">
          {kanbanColumns.map((column) => (
            <CrmColumn
              key={column.id}
              column={column}
              leads={filteredLeads.filter((l) => l.status === column.id).sort(sortFn)}
            />
          ))}
        </div>
      </DragDropProvider>

      {/* Contact modal */}
      {contactModal && (
        <ContactModal
          leadId={contactModal.leadId}
          leadName={contactModal.leadName}
          leadEmail={contactModal.leadEmail}
          leadCompany={contactModal.leadCompany}
          emailSubjectTag={contactModal.emailSubjectTag}
          leadNumber={contactModal.leadNumber}
          holdedProformaId={contactModal.holdedProformaId}
          activities={contactModal.activities}
          onClose={() => setContactModal(null)}
        />
      )}

      {/* Lost reason modal */}
      <Dialog open={!!lostModal} onOpenChange={(open) => { if (!open) handleLostCancel(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Motivo de perdida</DialogTitle>
            <DialogDescription>
              Opcional: indica por que se perdio este lead.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            placeholder="Ej: Presupuesto demasiado alto, eligio competidor..."
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={handleLostCancel}>
              Cancelar
            </Button>
            <Button
              onClick={handleLostConfirm}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Marcar como perdido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
