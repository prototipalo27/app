"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  assignLead,
  updateLeadOwner,
  updateLeadContactInfo,
  updateLeadPaidAt,
} from "../actions";

export type CommercialOption = { id: string; name: string };

export type BreakdownRowData = {
  leadId: string;
  fullName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  closerId: string | null;
  ownerId: string | null;
  closerRate: number | null;
  captadorRate: number | null;
  isReturning: boolean;
  quoteTotal: number;
  paidAt: string | null;
};

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

const inputClass =
  "h-8 w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm outline-none transition hover:border-input focus:border-ring focus:ring-2 focus:ring-ring/40 disabled:cursor-default disabled:opacity-100 disabled:hover:border-transparent";

const selectClass = inputClass + " appearance-none";

export function BreakdownRow({
  row,
  comerciales,
  canEdit,
}: {
  row: BreakdownRowData;
  comerciales: CommercialOption[];
  canEdit: boolean;
}) {
  const [, startTransition] = useTransition();
  const [fullName, setFullName] = useState(row.fullName);
  const [company, setCompany] = useState(row.company ?? "");
  const [closerId, setCloserId] = useState(row.closerId ?? "");
  const [ownerId, setOwnerId] = useState(row.ownerId ?? "");
  const [paidAt, setPaidAt] = useState(toDateInputValue(row.paidAt));
  const [error, setError] = useState<string | null>(null);

  function flash(msg: string | null) {
    setError(msg);
    if (msg) setTimeout(() => setError(null), 3000);
  }

  function saveContact() {
    if (fullName === row.fullName && company === (row.company ?? "")) return;
    startTransition(async () => {
      const res = await updateLeadContactInfo(row.leadId, {
        full_name: fullName,
        email: row.email,
        phone: row.phone,
        company: company || null,
      });
      if (!res.success) flash(res.error || "Error al guardar");
    });
  }

  function saveCloser(value: string) {
    setCloserId(value);
    startTransition(async () => {
      const res = await assignLead(row.leadId, value || null);
      if (!res.success) flash(res.error || "Error al guardar");
    });
  }

  function saveOwner(value: string) {
    setOwnerId(value);
    startTransition(async () => {
      const res = await updateLeadOwner(row.leadId, value || null);
      if (!res.success) flash(res.error || "Error al guardar");
    });
  }

  function savePaidAt(value: string) {
    setPaidAt(value);
    if (!value) return;
    startTransition(async () => {
      const iso = new Date(value + "T12:00:00").toISOString();
      const res = await updateLeadPaidAt(row.leadId, iso);
      if (!res.success) flash(res.error || "Error al guardar");
    });
  }

  return (
    <TableRow>
      <TableCell className="min-w-[260px]">
        <div className="flex flex-col gap-0.5">
          {canEdit ? (
            <>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onBlur={saveContact}
                className={inputClass + " font-medium"}
              />
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                onBlur={saveContact}
                placeholder="empresa"
                className={inputClass + " text-xs text-muted-foreground"}
              />
            </>
          ) : (
            <>
              <Link
                href={`/dashboard/crm/${row.leadId}`}
                className="px-2 font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                {row.fullName}
              </Link>
              {row.company && (
                <span className="px-2 text-xs text-muted-foreground">{row.company}</span>
              )}
            </>
          )}
          {error && <span className="px-2 text-[10px] text-red-600">{error}</span>}
        </div>
      </TableCell>
      <TableCell>
        <select
          value={closerId}
          onChange={(e) => saveCloser(e.target.value)}
          disabled={!canEdit}
          className={selectClass}
        >
          <option value="">—</option>
          {comerciales.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {row.closerRate !== null && (
          <div className="px-2 text-xs tabular-nums text-muted-foreground">
            {(row.closerRate * 100).toFixed(1)}%
          </div>
        )}
      </TableCell>
      <TableCell>
        <select
          value={ownerId}
          onChange={(e) => saveOwner(e.target.value)}
          disabled={!canEdit}
          className={selectClass}
        >
          <option value="">—</option>
          {comerciales.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {row.captadorRate !== null && (
          <div className="px-2 text-xs tabular-nums text-muted-foreground">
            {(row.captadorRate * 100).toFixed(1)}%
          </div>
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant="secondary"
          className={
            row.isReturning
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          }
        >
          {row.isReturning ? "Recurrente" : "Nuevo"}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">
        <Link
          href={`/dashboard/crm/${row.leadId}`}
          className="hover:underline"
          title="Editar precio en la ficha del lead"
        >
          {row.quoteTotal.toFixed(2)} &euro;
        </Link>
      </TableCell>
      <TableCell>
        <input
          type="date"
          value={paidAt}
          onChange={(e) => savePaidAt(e.target.value)}
          disabled={!canEdit}
          className={inputClass + " tabular-nums"}
        />
      </TableCell>
    </TableRow>
  );
}
