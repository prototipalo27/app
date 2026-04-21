"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { DragDropProvider } from "@dnd-kit/react";
import { useDroppable } from "@dnd-kit/react";
import { LEAD_COLUMNS, type LeadStatus } from "@/lib/crm-config";
import { CrmCard, agingClasses, tagClasses, type LeadWithAssignee } from "./crm-card";
import { SwipeableLeadCard } from "./swipeable-lead-card";
import { updateLeadStatus, dismissLead, getLeadEmails, bulkDismissLeads, togglePreWon } from "./actions";
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
import type { CommissionPreview } from "./actions";

interface CrmKanbanProps {
  initialLeads: LeadWithAssignee[];
  managers: { id: string; name: string }[];
  owners: { id: string; name: string }[];
  myCommission?: CommissionPreview | null;
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "…";
}

function CrmColumn({
  column,
  leads,
  commissionRate,
  onTogglePreWon,
}: {
  column: (typeof LEAD_COLUMNS)[number];
  leads: LeadWithAssignee[];
  commissionRate?: number;
  onTogglePreWon?: (leadId: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const { ref, isDropTarget } = useDroppable({ id: column.id });

  const totalValue = leads.reduce((sum, l) => sum + (l.estimated_value ?? 0), 0);

  const preWon = column.id === "quoted" ? leads.filter((l) => l.is_pre_won) : [];
  const rest = column.id === "quoted" ? leads.filter((l) => !l.is_pre_won) : leads;

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
        <div suppressHydrationWarning className="px-3 pb-1">
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
        {preWon.length > 0 && (
          <>
            <div className="flex items-center gap-1.5 px-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.1 10.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.673z" />
              </svg>
              Preganados
              <span className="ml-auto text-muted-foreground">{preWon.length}/3</span>
            </div>
            {preWon.map((lead) => (
              <CrmCard key={lead.id} lead={lead} commissionRate={commissionRate} onTogglePreWon={onTogglePreWon} />
            ))}
            {rest.length > 0 && (
              <div className="my-1 border-t border-dashed border-zinc-300 dark:border-zinc-700" />
            )}
          </>
        )}
        {rest.map((lead) => (
          <CrmCard key={lead.id} lead={lead} commissionRate={commissionRate} onTogglePreWon={onTogglePreWon} />
        ))}
      </div>
    </div>
  );
}

function LostSection({
  column,
  leads,
}: {
  column: (typeof LEAD_COLUMNS)[number];
  leads: LeadWithAssignee[];
}) {
  const [open, setOpen] = useState(false);
  const { ref, isDropTarget } = useDroppable({ id: column.id });

  if (leads.length === 0 && !isDropTarget) return null;

  return (
    <div className="mt-2 shrink-0 rounded-xl bg-muted/60">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <span className={`h-2 w-2 rounded-full ${column.accent}`} />
        <span className="text-sm font-medium text-muted-foreground">
          {column.label}
        </span>
        <Badge variant="secondary" className={`${column.badge}`}>
          {leads.length}
        </Badge>
        <svg
          className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          ref={ref}
          className={`grid grid-cols-2 gap-2 px-3 pb-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 ${
            isDropTarget ? "rounded-b-xl ring-2 ring-brand/50 ring-inset" : ""
          }`}
        >
          {leads.map((lead) => (
            <CrmCard key={lead.id} lead={lead} />
          ))}
        </div>
      )}

      {/* Hidden drop zone when collapsed */}
      {!open && (
        <div
          ref={ref}
          className={`h-1 ${isDropTarget ? "rounded-b-xl ring-2 ring-brand/50 ring-inset" : ""}`}
        />
      )}
    </div>
  );
}

// Default owner for filter
const DEFAULT_OWNER = "gonzalo";

export function CrmKanban({ initialLeads, managers, owners, myCommission }: CrmKanbanProps) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);

  // Sync leads when server data changes (e.g. after pull-to-refresh)
  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  const handleTogglePreWon = useCallback(
    async (leadId: string) => {
      const target = leads.find((l) => l.id === leadId);
      if (!target) return { success: false, error: "Lead no encontrado" };
      const willPin = !target.is_pre_won;
      // Optimistic update
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, is_pre_won: willPin } : l)),
      );
      const result = await togglePreWon(leadId);
      if (!result.success) {
        // Revert on failure
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, is_pre_won: !willPin } : l)),
        );
      } else {
        router.refresh();
      }
      return result;
    },
    [leads, router],
  );

  // Pull-to-refresh (mobile)
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullStartY = useRef(0);
  const pulling = useRef(false);
  const PULL_THRESHOLD = 80;

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      if (window.scrollY > 0) return;
      pullStartY.current = e.touches[0].clientY;
      pulling.current = true;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current || refreshing) return;
      const dy = e.touches[0].clientY - pullStartY.current;
      if (dy < 0) { setPullDistance(0); return; }
      setPullDistance(Math.min(dy * 0.45, 110));
    };
    const onTouchEnd = () => {
      if (!pulling.current) return;
      pulling.current = false;
      if (pullDistance >= PULL_THRESHOLD) {
        setRefreshing(true);
        setPullDistance(40);
        router.refresh();
        setTimeout(() => { setRefreshing(false); setPullDistance(0); }, 1200);
      } else {
        setPullDistance(0);
      }
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [refreshing, pullDistance, router]);

  const [search, setSearch] = useState("");
  const [spamMode, setSpamMode] = useState(false);
  const [spamSelected, setSpamSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [filterManager, setFilterManager] = useState(() => localStorage.getItem("crm_filterManager") || "all");
  const [filterOwner, setFilterOwner] = useState(() => {
    const stored = localStorage.getItem("crm_filterOwner");
    if (stored) return stored;
    const gonzalo = owners.find((o) => o.name.toLowerCase() === DEFAULT_OWNER);
    return gonzalo ? gonzalo.id : "all";
  });
  const [filterType, setFilterType] = useState(() => localStorage.getItem("crm_filterType") || "all");
  const [sortBy, setSortBy] = useState(() => localStorage.getItem("crm_sortBy") || "newest");
  const [filterTime, setFilterTime] = useState(() => localStorage.getItem("crm_filterTime") || "all");
  const [customFrom, setCustomFrom] = useState(() => localStorage.getItem("crm_customFrom") || "");
  const [customTo, setCustomTo] = useState(() => localStorage.getItem("crm_customTo") || "");

  // Persist filters to localStorage
  useEffect(() => {
    localStorage.setItem("crm_filterManager", filterManager);
    localStorage.setItem("crm_filterOwner", filterOwner);
    localStorage.setItem("crm_filterType", filterType);
    localStorage.setItem("crm_sortBy", sortBy);
    localStorage.setItem("crm_filterTime", filterTime);
    localStorage.setItem("crm_customFrom", customFrom);
    localStorage.setItem("crm_customTo", customTo);
  }, [filterManager, filterOwner, filterType, sortBy, filterTime, customFrom, customTo]);
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

  const getTimeFilterRange = useCallback((): { from: Date; to: Date } | null => {
    const now = new Date();
    if (filterTime === "today") {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { from, to: now };
    }
    if (filterTime === "week") {
      const from = new Date(now);
      from.setDate(from.getDate() - 7);
      return { from, to: now };
    }
    if (filterTime === "month") {
      const from = new Date(now);
      from.setMonth(from.getMonth() - 1);
      return { from, to: now };
    }
    if (filterTime === "custom") {
      if (!customFrom && !customTo) return null;
      const from = customFrom ? new Date(customFrom) : new Date(0);
      const to = customTo ? new Date(customTo + "T23:59:59") : now;
      return { from, to };
    }
    return null;
  }, [filterTime, customFrom, customTo]);

  const filteredLeads = leads.filter((l) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const searchable = [l.full_name, l.company, l.email, l.phone, l.message, l.project_type_tag, l.assignee_email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    if (filterManager !== "all") {
      if (filterManager === "unassigned" && l.assigned_to) return false;
      if (filterManager !== "unassigned" && l.assigned_to !== filterManager) return false;
    }
    if (filterOwner !== "all") {
      if (!l.owned_by || l.owned_by !== filterOwner) return false;
    }
    if (filterType !== "all") {
      if (filterType === "none" && l.project_type_tag) return false;
      if (filterType !== "none" && l.project_type_tag !== filterType) return false;
    }
    const range = getTimeFilterRange();
    if (range) {
      const created = new Date(l.created_at);
      if (created < range.from || created > range.to) return false;
    }
    return true;
  });

  const sortFn = (a: LeadWithAssignee, b: LeadWithAssignee) => {
    if (sortBy === "price_desc") return (b.estimated_value ?? 0) - (a.estimated_value ?? 0);
    if (sortBy === "price_asc") return (a.estimated_value ?? 0) - (b.estimated_value ?? 0);
    if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  };

  const newLeads = filteredLeads
    .filter((l) => l.status === "new")
    .sort(sortFn);
  const kanbanColumns = LEAD_COLUMNS.filter((col) => col.id !== "new" && col.id !== "lost");
  const lostColumn = LEAD_COLUMNS.find((col) => col.id === "lost")!;

  return (
    <>
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out md:hidden"
          style={{ height: pullDistance }}
        >
          <div className={`flex items-center gap-2 text-sm text-muted-foreground ${refreshing ? "animate-pulse" : ""}`}>
            <svg
              className="h-5 w-5"
              style={{ transform: `rotate(${Math.min(pullDistance / PULL_THRESHOLD, 1) * 360}deg)` }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? "Actualizando…" : pullDistance >= PULL_THRESHOLD ? "Suelta para refrescar" : ""}
          </div>
        </div>
      )}

      {/* Pipeline summary */}
      {(() => {
        const phases = LEAD_COLUMNS
          .filter((col) => col.id !== "lost")
          .map((col) => {
            const phaseLeads = filteredLeads.filter((l) => l.status === col.id);
            const total = phaseLeads.reduce((s, l) => s + (l.estimated_value ?? 0), 0);
            return { ...col, count: phaseLeads.length, total };
          });
        const grandTotal = phases.reduce((s, p) => s + p.total, 0);
        return (
          <div className="mb-4 grid grid-cols-5 gap-1.5 md:gap-3">
            {phases.map((p) => (
              <div key={p.id} className="rounded-lg bg-muted/60 px-2 py-2 text-center md:px-3 md:py-2.5">
                <div className="flex items-center justify-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${p.accent}`} />
                  <span className="text-[11px] font-medium text-muted-foreground md:text-xs">{p.label}</span>
                </div>
                <p suppressHydrationWarning className="mt-1 whitespace-nowrap text-sm font-bold tabular-nums text-green-600 dark:text-green-400 md:text-xl">
                  {p.total > 0 ? `${Math.round(p.total).toLocaleString("es-ES")}\u00A0€` : "—"}
                </p>
                <p suppressHydrationWarning className="text-[11px] font-medium tabular-nums text-muted-foreground md:text-xs">
                  {p.count} {p.count === 1 ? "lead" : "leads"}
                </p>
              </div>
            ))}
          </div>
        );
      })()}


      {/* Search + Filters */}
      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar lead..."
          className="h-8 w-40 shrink-0 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring md:w-52"
        />

        <Select value={filterManager} onValueChange={(v) => v && setFilterManager(v)}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="Comercial">
              {filterManager === "all"
                ? "Todos los comerciales"
                : filterManager === "unassigned"
                  ? "Sin asignar"
                  : managers.find((m) => m.id === filterManager)?.name ?? "Comercial"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los comerciales</SelectItem>
            {managers.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
            <SelectItem value="unassigned">Sin asignar</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterOwner} onValueChange={(v) => v && setFilterOwner(v)}>
          <SelectTrigger size="sm" suppressHydrationWarning>
            <SelectValue placeholder="Captador" suppressHydrationWarning>
              {filterOwner === "all"
                ? "Todos los captadores"
                : owners.find((o) => o.id === filterOwner)?.name ?? "Captador"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los captadores</SelectItem>
            {owners.map((o) => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
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

        <Select value={filterTime} onValueChange={(v) => { if (v) { setFilterTime(v); if (v !== "custom") { setCustomFrom(""); setCustomTo(""); } } }}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo el tiempo</SelectItem>
            <SelectItem value="today">Hoy</SelectItem>
            <SelectItem value="week">Ultima semana</SelectItem>
            <SelectItem value="month">Ultimo mes</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => v && setSortBy(v)}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="price_desc">Precio estimado ↓</SelectItem>
            <SelectItem value="price_asc">Precio estimado ↑</SelectItem>
            <SelectItem value="newest">Mas recientes</SelectItem>
            <SelectItem value="oldest">Mas antiguos</SelectItem>
          </SelectContent>
        </Select>

        {filterTime === "custom" && (
          <div className="flex shrink-0 items-center gap-1.5">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            />
            <span className="text-xs text-muted-foreground">—</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            />
          </div>
        )}
      </div>

      {/* New leads strip */}
      {newLeads.length > 0 && (
        <div className="mb-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2 px-4 py-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Nuevos</h3>
            <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
              {newLeads.length}
            </span>
            <div className="ml-auto flex items-center gap-2">
              {spamMode && spamSelected.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={bulkDeleting}
                  onClick={async () => {
                    if (!confirm(`Bloquear y eliminar ${spamSelected.size} lead${spamSelected.size > 1 ? "s" : ""}?`)) return;
                    setBulkDeleting(true);
                    const result = await bulkDismissLeads([...spamSelected]);
                    if (result.success) {
                      setLeads((prev) => prev.filter((l) => !spamSelected.has(l.id)));
                      setSpamSelected(new Set());
                      setSpamMode(false);
                    }
                    setBulkDeleting(false);
                  }}
                >
                  {bulkDeleting ? "Eliminando..." : `Eliminar ${spamSelected.size} seleccionados`}
                </Button>
              )}
              {spamMode && newLeads.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (spamSelected.size === newLeads.length) {
                      setSpamSelected(new Set());
                    } else {
                      setSpamSelected(new Set(newLeads.map((l) => l.id)));
                    }
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {spamSelected.size === newLeads.length ? "Deseleccionar todo" : "Seleccionar todo"}
                </button>
              )}
              <button
                type="button"
                onClick={() => { setSpamMode(!spamMode); setSpamSelected(new Set()); }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  spamMode
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {spamMode ? "Salir limpieza" : "Limpiar spam"}
              </button>
            </div>
          </div>
          {/* Mobile: swipeable card layout */}
          <div className="flex flex-col gap-2 px-2 pb-2 md:hidden">
            {newLeads.map((lead) => (
              spamMode ? (
                <div
                  key={lead.id}
                  className={`flex items-center gap-2 rounded-lg border p-3 ${spamSelected.has(lead.id) ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/10" : "border-border"}`}
                  onClick={() => setSpamSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(lead.id)) next.delete(lead.id);
                    else next.add(lead.id);
                    return next;
                  })}
                >
                  <input
                    type="checkbox"
                    checked={spamSelected.has(lead.id)}
                    onChange={() => {}}
                    className="h-4 w-4 shrink-0 rounded border-zinc-300 text-red-600 focus:ring-red-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{lead.full_name}</p>
                    {lead.company && <p className="truncate text-xs text-muted-foreground">{lead.company}</p>}
                    {lead.email && <p className="truncate text-xs text-muted-foreground">{lead.email}</p>}
                  </div>
                </div>
              ) : (
                <SwipeableLeadCard
                  key={lead.id}
                  lead={lead}
                  onDismiss={handleDismiss}
                  onContact={(l) => {
                    if (l.email) {
                      handleContact(l);
                    } else {
                      router.push(`/dashboard/crm/${l.id}`);
                    }
                  }}
                  dismissingId={dismissingId}
                  loadingContactId={loadingContactId}
                />
              )
            ))}
          </div>

          {/* Desktop: table rows */}
          <div className="hidden divide-y divide-zinc-100 md:block dark:divide-zinc-800/50">
            {newLeads.map((lead) => (
              <div
                key={lead.id}
                className={`group flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50 ${spamMode && spamSelected.has(lead.id) ? "bg-red-50 dark:bg-red-900/10" : ""}`}
                onClick={() => {
                  if (spamMode) {
                    setSpamSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(lead.id)) next.delete(lead.id);
                      else next.add(lead.id);
                      return next;
                    });
                  } else {
                    router.push(`/dashboard/crm/${lead.id}`);
                  }
                }}
              >
                {/* Spam checkbox */}
                {spamMode && (
                  <input
                    type="checkbox"
                    checked={spamSelected.has(lead.id)}
                    onChange={() => {}}
                    className="h-4 w-4 shrink-0 rounded border-zinc-300 text-red-600 focus:ring-red-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}

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
                    <span className={`ml-1.5 text-[11px] font-normal ${agingClasses(lead.last_activity_at || lead.created_at)}`}>
                      {(() => {
                        const diff = Date.now() - new Date(lead.last_activity_at || lead.created_at).getTime();
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
                    <svg className="mt-0.5 h-3.5 w-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
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
              commissionRate={column.id !== "won" && column.id !== "paid" ? myCommission?.currentRate : undefined}
              onTogglePreWon={handleTogglePreWon}
            />
          ))}
        </div>

        {/* Perdidos — separate section below kanban */}
        {(() => {
          const lostLeads = filteredLeads.filter((l) => l.status === "lost").sort(sortFn);
          return (
            <LostSection column={lostColumn} leads={lostLeads} />
          );
        })()}
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
