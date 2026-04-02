"use client";

import { useState } from "react";
import { updateLeadContactInfo } from "../actions";

interface Props {
  leadId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
}

export default function EditableContactInfo({ leadId, fullName, email, phone, company }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState({ fullName, email: email || "", phone: phone || "", company: company || "" });

  const hasChanges =
    values.fullName !== fullName ||
    values.email !== (email || "") ||
    values.phone !== (phone || "") ||
    values.company !== (company || "");

  const save = async () => {
    setSaving(true);
    await updateLeadContactInfo(leadId, {
      full_name: values.fullName.trim(),
      email: values.email.trim() || null,
      phone: values.phone.trim() || null,
      company: values.company.trim() || null,
    });
    setSaving(false);
    setEditing(false);
  };

  const cancel = () => {
    setValues({ fullName, email: email || "", phone: phone || "", company: company || "" });
    setEditing(false);
  };

  const inputClass = "w-full rounded-md border border-input bg-background px-2 py-1 text-sm";

  if (!editing) {
    return (
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-card-foreground">{fullName}</h1>
          <button
            onClick={() => setEditing(true)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Editar datos de contacto"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>

        {company && <p className="mt-1 text-sm text-muted-foreground">{company}</p>}

        <div className="mt-4 space-y-2">
          {email && (
            <div className="flex items-center gap-2 text-sm">
              <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              <a href={`mailto:${email}`} className="text-blue-600 hover:underline dark:text-blue-400">{email}</a>
            </div>
          )}
          {phone && (
            <div className="flex items-center gap-2 text-sm">
              <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              <a href={`tel:${phone}`} className="text-foreground hover:underline">{phone}</a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Nombre</label>
        <input
          type="text"
          value={values.fullName}
          onChange={(e) => setValues((v) => ({ ...v, fullName: e.target.value }))}
          className={inputClass}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Empresa</label>
        <input
          type="text"
          value={values.company}
          onChange={(e) => setValues((v) => ({ ...v, company: e.target.value }))}
          className={inputClass}
          placeholder="Empresa S.L."
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
        <input
          type="email"
          value={values.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          className={inputClass}
          placeholder="email@ejemplo.com"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Telefono</label>
        <input
          type="tel"
          value={values.phone}
          onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
          className={inputClass}
          placeholder="+34 600 000 000"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving || !hasChanges || !values.fullName.trim()}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button
          onClick={cancel}
          className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
