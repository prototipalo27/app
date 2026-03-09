"use client";

import { useState, useMemo } from "react";
import { updateContacto, refreshContactCache, type CachedContact } from "./actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";

export default function ContactosClient({ initialContacts }: { initialContacts: CachedContact[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CachedContact | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

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
      setMessage({ type: "ok", text: "Guardado en Holded" });
    } else {
      setMessage({ type: "err", text: result.error || "Error al guardar" });
    }
    setSaving(false);
  }

  async function handleSync() {
    setSyncing(true);
    setMessage(null);
    const result = await refreshContactCache();
    if (result.success) {
      setMessage({ type: "ok", text: `Cache actualizada: ${result.count} contactos` });
      // Reload page to get fresh data
      window.location.reload();
    } else {
      setMessage({ type: "err", text: result.error || "Error al sincronizar" });
    }
    setSyncing(false);
  }

  const inputClass =
    "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contactos</h1>
          <p className="text-sm text-muted-foreground">{contacts.length} contactos en Holded</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="text-xs"
        >
          {syncing ? "Sincronizando..." : "Sincronizar"}
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar por nombre, email, NIF, teléfono..."
          className="h-10 w-full rounded-lg border border-input bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {message && (
        <div className={`mb-4 rounded-md px-3 py-2 text-sm ${message.type === "ok" ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
          {message.text}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr,380px]">
        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[75vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden sm:table-cell">NIF</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="hidden md:table-cell">Teléfono</TableHead>
                    <TableHead className="hidden lg:table-cell">Captador</TableHead>
                    <TableHead className="hidden lg:table-cell">Owner</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        {query ? "Sin resultados" : "No hay contactos en cache"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((c) => (
                      <TableRow
                        key={c.holded_id}
                        onClick={() => selectContact(c)}
                        className={`cursor-pointer ${selected?.holded_id === c.holded_id ? "bg-brand/5" : ""}`}
                      >
                        <TableCell>
                          <div className="font-medium text-foreground">{c.name}</div>
                          {c.trade_name && c.trade_name !== c.name && (
                            <div className="text-xs text-muted-foreground">{c.trade_name}</div>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">{c.code || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{c.email || "—"}</TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">{c.phone || c.mobile || "—"}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {c.captador ? (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{c.captador}</span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {c.owner ? (
                            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{c.owner}</span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Detail panel */}
        {selected && (
          <Card className="h-fit lg:sticky lg:top-4">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{selected.name}</CardTitle>
                <div className="flex gap-2">
                  {!editing ? (
                    <Button size="sm" variant="ghost" onClick={startEdit}>
                      Editar
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-brand text-white hover:bg-brand-dark"
                      >
                        {saving ? "..." : "Guardar"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {selected.contact_type && (
                <span className="mt-1 inline-block rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {selected.contact_type}
                </span>
              )}
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {editing ? (
                <>
                  <Field label="Nombre" value={form.name} onChange={(v) => setForm({ ...form, name: v })} inputClass={inputClass} />
                  <Field label="NIF/CIF" value={form.code} onChange={(v) => setForm({ ...form, code: v })} inputClass={inputClass} />
                  <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} inputClass={inputClass} type="email" />
                  <Field label="Teléfono" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} inputClass={inputClass} type="tel" />
                  <Field label="Móvil" value={form.mobile} onChange={(v) => setForm({ ...form, mobile: v })} inputClass={inputClass} type="tel" />
                  <div className="border-t border-input pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dirección</p>
                    <div className="space-y-3">
                      <Field label="Calle" value={form.address} onChange={(v) => setForm({ ...form, address: v })} inputClass={inputClass} />
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Ciudad" value={form.city} onChange={(v) => setForm({ ...form, city: v })} inputClass={inputClass} />
                        <Field label="CP" value={form.postal_code} onChange={(v) => setForm({ ...form, postal_code: v })} inputClass={inputClass} />
                      </div>
                      <Field label="Provincia" value={form.province} onChange={(v) => setForm({ ...form, province: v })} inputClass={inputClass} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <InfoRow label="NIF/CIF" value={selected.code} />
                  <InfoRow label="Email" value={selected.email} />
                  <InfoRow label="Teléfono" value={selected.phone} />
                  <InfoRow label="Móvil" value={selected.mobile} />
                  {(selected.captador || selected.owner) && (
                    <div className="flex items-center gap-3 border-t border-input pt-3">
                      {selected.captador && (
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Captador</span>
                          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{selected.captador}</p>
                        </div>
                      )}
                      {selected.owner && (
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Owner</span>
                          <p className="text-sm font-medium text-blue-700 dark:text-blue-400">{selected.owner}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {(selected.address || selected.city || selected.postal_code || selected.province) && (
                    <div className="border-t border-input pt-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dirección</p>
                      <p className="text-sm text-foreground">
                        {[selected.address, [selected.postal_code, selected.city].filter(Boolean).join(" "), selected.province].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  )}
                  {selected.note && (
                    <div className="border-t border-input pt-3">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notas</p>
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{selected.note}</p>
                    </div>
                  )}
                  <div className="border-t border-input pt-3">
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
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function Field({ label, value, onChange, inputClass, type = "text" }: { label: string; value: string; onChange: (v: string) => void; inputClass: string; type?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </div>
  );
}
