"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveLeadBillingData, type LeadBillingInput } from "../actions";

interface Props {
  leadId: string;
  billing: {
    billing_name: string | null;
    tax_id: string | null;
    billing_address: string | null;
    billing_city: string | null;
    billing_postal_code: string | null;
    billing_province: string | null;
    billing_country: string | null;
  };
}

const inputClass =
  "w-full rounded-md border border-input bg-background px-2 py-1 text-sm";

export default function LeadBillingEditor({ leadId, billing }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initial: LeadBillingInput = {
    billing_name: billing.billing_name || "",
    tax_id: billing.tax_id || "",
    billing_address: billing.billing_address || "",
    billing_city: billing.billing_city || "",
    billing_postal_code: billing.billing_postal_code || "",
    billing_province: billing.billing_province || "",
    billing_country: billing.billing_country || "España",
  };
  const [values, setValues] = useState<LeadBillingInput>(initial);

  const complete = Boolean(billing.tax_id?.trim() && billing.billing_name?.trim());

  const save = async () => {
    setSaving(true);
    setError(null);
    const result = await saveLeadBillingData(leadId, {
      ...values,
      billing_name: values.billing_name.trim(),
      tax_id: values.tax_id.trim(),
    });
    setSaving(false);
    if (result.success) {
      setEditing(false);
      router.refresh();
    } else {
      setError(result.error || "Error al guardar");
    }
  };

  const cancel = () => {
    setValues(initial);
    setError(null);
    setEditing(false);
  };

  const field = (
    label: string,
    key: keyof LeadBillingInput,
    placeholder?: string,
  ) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        type="text"
        value={values[key]}
        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
        className={inputClass}
        placeholder={placeholder}
      />
    </div>
  );

  if (!editing) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-card-foreground">
            Datos de facturación
          </h4>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            {complete ? "Editar" : "Añadir"}
          </button>
        </div>
        {complete ? (
          <div className="text-xs text-muted-foreground">
            <p><strong>Razón social:</strong> {billing.billing_name}</p>
            <p><strong>NIF:</strong> {billing.tax_id}</p>
            {billing.billing_address && (
              <p>
                {billing.billing_address}
                {billing.billing_postal_code ? `, ${billing.billing_postal_code}` : ""}
                {billing.billing_city ? ` ${billing.billing_city}` : ""}
                {billing.billing_province ? ` (${billing.billing_province})` : ""}
              </p>
            )}
          </div>
        ) : (
          <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            Faltan los datos de facturación (NIF). Añádelos aquí o envía el
            formulario al cliente para poder emitir la factura.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <h4 className="text-xs font-semibold text-card-foreground">
        Datos de facturación
      </h4>
      {field("Razón social *", "billing_name", "Empresa S.L. / Nombre completo")}
      {field("NIF / CIF *", "tax_id", "B12345678")}
      {field("Dirección", "billing_address", "Calle y número")}
      <div className="grid grid-cols-2 gap-2">
        {field("Código postal", "billing_postal_code", "28001")}
        {field("Ciudad", "billing_city", "Madrid")}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {field("Provincia", "billing_province", "Madrid")}
        {field("País", "billing_country", "España")}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving || !values.billing_name.trim() || !values.tax_id.trim()}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar y sincronizar con Holded"}
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
