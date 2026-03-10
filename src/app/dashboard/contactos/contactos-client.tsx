"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { updateContacto, refreshContactCache, type CachedContact, type TeamMember } from "./actions";
import { Button } from "@/components/ui/button";

const COLUMNS = [
  { key: "name", label: "Nombre", defaultWidth: 200, minWidth: 100 },
  { key: "code", label: "NIF", defaultWidth: 110, minWidth: 60 },
  { key: "email", label: "Email", defaultWidth: 200, minWidth: 80 },
  { key: "phone", label: "Teléfono", defaultWidth: 120, minWidth: 80 },
  { key: "captador", label: "Captador", defaultWidth: 100, minWidth: 60 },
  { key: "owner", label: "Owner", defaultWidth: 100, minWidth: 60 },
];

export default function ContactosClient({ initialContacts, teamMembers }: { initialContacts: CachedContact[]; teamMembers: TeamMember[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CachedContact | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [colWidths, setColWidths] = useState(() => COLUMNS.map((c) => c.defaultWidth));

  const resizing = useRef<{ idx: number; startX: number; startW: number } | null>(null);

  const onResizeStart = useCallback((idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = { idx, startX: e.clientX, startW: colWidths[idx] };

    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const delta = ev.clientX - resizing.current.startX;
      const newW = Math.max(COLUMNS[resizing.current.idx].minWidth, resizing.current.startW + delta);
      setColWidths((prev) => {
        const next = [...prev];
        next[resizing.current!.idx] = newW;
        return next;
      });
    };

    const onUp = () => {
      resizing.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [colWidths]);

  const filtered = useMemo(() => {
    if (!query.trim()) return contacts;
    const q = query.toLowerCase();
    return contacts.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.trade_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.code?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.mobile?.includes(q) ||
      c.captador?.toLowerCase().includes(q) ||
      c.owner?.toLowerCase().includes(q)
    );
  }, [contacts, query]);

  function selectContact(c: CachedContact) {
    setSelected(c);
    setEditing(false);
    setMessage(null);
  }

  function startEdit() {
    if (!selected) return;
    setForm({
      name: selected.name || "",
      email: selected.email || "",
      phone: selected.phone || "",
      mobile: selected.mobile || "",
      code: selected.code || "",
      address: selected.address || "",
      city: selected.city || "",
      postal_code: selected.postal_code || "",
      province: selected.province || "",
      captador: selected.captador || "",
      owner: selected.owner || "",
    });
    setEditing(true);
    setMessage(null);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setMessage(null);

    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(form)) {
      if (value !== (selected[key as keyof CachedContact] || "")) {
        fields[key] = value;
      }
    }

    if (Object.keys(fields).length === 0) {
      setEditing(false);
      setSaving(false);
      return;
    }

    const result = await updateContacto(selected.holded_id, fields);
    if (result.success) {
      const updated = { ...selected, ...fields } as CachedContact;
      setSelected(updated);
      setContacts((prev) => prev.map((r) => r.holded_id === updated.holded_id ? updated : r));
      setEditing(false);
      setMessage({ type: "ok", text: "Guardado" });
    } else {
      setMessage({ type: "err", text: result.error || "Error al guardar" });
    }
    setSaving(false);
  }

  async function quickSetField(field: "captador" | "owner", value: string) {
    if (!selected) return;
    setSaving(true);
    const result = await updateContacto(selected.holded_id, { [field]: value });
    if (result.success) {
      const updated = { ...selected, [field]: value || null } as CachedContact;
      setSelected(updated);
      setContacts((prev) => prev.map((r) => r.holded_id === updated.holded_id ? updated : r));
    }
    setSaving(false);
  }

  async function handleSync() {
    setSyncing(true);
    setMessage(null);
    const result = await refreshContactCache();
    if (result.success) {
      setMessage({ type: "ok", text: `Cache actualizada: ${result.count} contactos` });
      window.location.reload();
    } else {
      setMessage({ type: "err", text: result.error || "Error al sincronizar" });
    }
    setSyncing(false);
  }

  const inputClass =
    "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring";
  const selectClass =
    "h-7 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] flex-col">
      {/* Header */}
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-bold text-foreground">Contactos</h1>
          <span className="text-xs text-muted-foreground">{contacts.length} en Holded</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSync} disabled={syncing} className="text-xs">
          {syncing ? "Sincronizando..." : "Sincronizar"}
        </Button>
      </div>

      {/* Search */}
      <div className="mb-2 shrink-0">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar por nombre, email, NIF, teléfono..."
          className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {message && (
        <div className={`mb-2 shrink-0 rounded-md px-3 py-1.5 text-xs ${message.type === "ok" ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
          {message.text}
        </div>
      )}

      {/* Main content */}
      <div className="flex min-h-0 flex-1 gap-3">
        {/* Table */}
        <div className="min-w-0 flex-1 overflow-auto rounded-lg border border-border bg-card">
          <table className="w-max min-w-full border-collapse text-sm" style={{ tableLayout: "fixed", width: colWidths.reduce((a, b) => a + b, 0) }}>
            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
              <tr>
                {COLUMNS.map((col, i) => (
                  <th
                    key={col.key}
                    className="relative select-none border-b border-border px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                    style={{ width: colWidths[i] }}
                  >
                    {col.label}
                    <div
                      onMouseDown={(e) => onResizeStart(i, e)}
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-brand/30"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="py-8 text-center text-xs text-muted-foreground">
                    {query ? "Sin resultados" : "No hay contactos en cache"}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr
                    key={c.holded_id}
                    onClick={() => selectContact(c)}
                    className={`cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/40 ${selected?.holded_id === c.holded_id ? "bg-brand/5" : ""}`}
                  >
                    <td className="truncate px-3 py-1.5" style={{ width: colWidths[0] }}>
                      <span className="font-medium text-foreground">{c.name}</span>
                      {c.trade_name && c.trade_name !== c.name && (
                        <span className="ml-1.5 text-[11px] text-muted-foreground">{c.trade_name}</span>
                      )}
                    </td>
                    <td className="truncate px-3 py-1.5 text-muted-foreground" style={{ width: colWidths[1] }}>{c.code || "—"}</td>
                    <td className="truncate px-3 py-1.5 text-muted-foreground" style={{ width: colWidths[2] }}>{c.email || "—"}</td>
                    <td className="truncate px-3 py-1.5 text-muted-foreground" style={{ width: colWidths[3] }}>{c.phone || c.mobile || "—"}</td>
                    <td className="truncate px-3 py-1.5" style={{ width: colWidths[4] }}>
                      {c.captador ? (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{c.captador}</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="truncate px-3 py-1.5" style={{ width: colWidths[5] }}>
                      {c.owner ? (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{c.owner}</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-[340px] shrink-0 overflow-auto rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-center justify-between">
                <h2 className="truncate text-sm font-semibold text-foreground">{selected.name}</h2>
                <div className="flex gap-1">
                  {!editing ? (
                    <Button size="sm" variant="ghost" onClick={startEdit} className="h-7 text-xs">
                      Editar
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7 text-xs">
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 bg-brand text-xs text-white hover:bg-brand-dark">
                        {saving ? "..." : "Guardar"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {selected.contact_type && (
                <span className="mt-1 inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {selected.contact_type}
                </span>
              )}
            </div>
            <div className="space-y-2.5 p-4">
              {/* Captador & Owner — always visible, editable inline */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">Captador</span>
                  <select
                    value={selected.captador || ""}
                    onChange={(e) => quickSetField("captador", e.target.value)}
                    disabled={saving}
                    className={selectClass}
                  >
                    <option value="">—</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">Owner</span>
                  <select
                    value={selected.owner || ""}
                    onChange={(e) => quickSetField("owner", e.target.value)}
                    disabled={saving}
                    className={selectClass}
                  >
                    <option value="">—</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {editing ? (
                <>
                  <div className="border-t border-input pt-2.5" />
                  <Field label="Nombre" value={form.name} onChange={(v) => setForm({ ...form, name: v })} inputClass={inputClass} />
                  <Field label="NIF/CIF" value={form.code} onChange={(v) => setForm({ ...form, code: v })} inputClass={inputClass} />
                  <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} inputClass={inputClass} type="email" />
                  <Field label="Teléfono" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} inputClass={inputClass} type="tel" />
                  <Field label="Móvil" value={form.mobile} onChange={(v) => setForm({ ...form, mobile: v })} inputClass={inputClass} type="tel" />
                  <div className="border-t border-input pt-2.5">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Dirección</p>
                    <div className="space-y-2.5">
                      <Field label="Calle" value={form.address} onChange={(v) => setForm({ ...form, address: v })} inputClass={inputClass} />
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Ciudad" value={form.city} onChange={(v) => setForm({ ...form, city: v })} inputClass={inputClass} />
                        <Field label="CP" value={form.postal_code} onChange={(v) => setForm({ ...form, postal_code: v })} inputClass={inputClass} />
                      </div>
                      <Field label="Provincia" value={form.province} onChange={(v) => setForm({ ...form, province: v })} inputClass={inputClass} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="border-t border-input pt-2.5" />
                  <InfoRow label="NIF/CIF" value={selected.code} />
                  <InfoRow label="Email" value={selected.email} />
                  <InfoRow label="Teléfono" value={selected.phone} />
                  <InfoRow label="Móvil" value={selected.mobile} />
                  {(selected.address || selected.city || selected.postal_code || selected.province) && (
                    <div className="border-t border-input pt-2.5">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Dirección</p>
                      <p className="text-xs text-foreground">
                        {[selected.address, [selected.postal_code, selected.city].filter(Boolean).join(" "), selected.province].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  )}
                  {selected.note && (
                    <div className="border-t border-input pt-2.5">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notas</p>
                      <p className="whitespace-pre-wrap text-xs text-muted-foreground">{selected.note}</p>
                    </div>
                  )}
                  <div className="border-t border-input pt-2.5">
                    <a
                      href={`https://app.holded.com/contacts/${selected.holded_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Ver en Holded &rarr;
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <span className="text-xs text-foreground">{value}</span>
    </div>
  );
}

function Field({ label, value, onChange, inputClass, type = "text" }: { label: string; value: string; onChange: (v: string) => void; inputClass: string; type?: string }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </div>
  );
}
