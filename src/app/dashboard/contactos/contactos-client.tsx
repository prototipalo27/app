"use client";

import { useState, useRef, useCallback } from "react";
import { searchContactos, updateContacto, refreshContactCache, type CachedContact } from "./actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ContactosClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CachedContact[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<CachedContact | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const data = await searchContactos(q);
      setResults(data);
    } catch {
      setResults([]);
    }
    setSearching(false);
  }, []);

  function handleQueryChange(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q), 300);
  }

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
      // Update local state
      const updated = { ...selected, ...fields } as CachedContact;
      setSelected(updated);
      setResults((prev) => prev.map((r) => r.holded_id === updated.holded_id ? updated : r));
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
      if (query.length >= 2) doSearch(query);
    } else {
      setMessage({ type: "err", text: result.error || "Error al sincronizar" });
    }
    setSyncing(false);
  }

  const inputClass =
    "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Contactos Holded</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="text-xs"
        >
          {syncing ? "Sincronizando..." : "Sincronizar cache"}
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Buscar por nombre, email, NIF, teléfono..."
          className="h-10 w-full rounded-lg border border-input bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {message && (
        <div className={`mb-4 rounded-md px-3 py-2 text-sm ${message.type === "ok" ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
          {message.text}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[1fr,1.2fr]">
        {/* Results list */}
        <Card className="h-fit">
          <CardHeader className="border-b py-3">
            <CardTitle className="text-sm">
              {searching ? "Buscando..." : results.length > 0 ? `${results.length} resultados` : query.length >= 2 ? "Sin resultados" : "Escribe para buscar"}
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[60vh] overflow-y-auto p-0">
            {results.map((c) => (
              <button
                key={c.holded_id}
                type="button"
                onClick={() => selectContact(c)}
                className={`w-full border-b border-input px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/50 ${selected?.holded_id === c.holded_id ? "bg-brand/5" : ""}`}
              >
                <div className="text-sm font-medium text-foreground">{c.name}</div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  {c.code && <span>{c.code}</span>}
                  {c.email && <span>{c.email}</span>}
                  {(c.phone || c.mobile) && <span>{c.phone || c.mobile}</span>}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Detail / Edit panel */}
        {selected && (
          <Card>
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
                        {saving ? "Guardando..." : "Guardar"}
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
            <CardContent className="space-y-4 pt-4">
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
