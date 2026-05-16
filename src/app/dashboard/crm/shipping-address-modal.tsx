"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AddressAutocomplete, {
  type AddressComponents,
} from "@/components/address-autocomplete";
import { updateShippingAddress, setPickupInPerson } from "./actions";

interface ShippingAddressModalProps {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPickup?: boolean;
  /** Email del lead, se usa como valor por defecto del destinatario. */
  defaultRecipientEmail?: string | null;
  /** Teléfono del lead, idem. */
  defaultRecipientPhone?: string | null;
}

const inputClass =
  "block w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500";

export function ShippingAddressModal({
  leadId,
  open,
  onOpenChange,
  initialPickup = false,
  defaultRecipientEmail,
  defaultRecipientPhone,
}: ShippingAddressModalProps) {
  const router = useRouter();
  const [pickup, setPickup] = useState(initialPickup);
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [country, setCountry] = useState("España");
  // Prefill con los datos del lead — el comercial los confirma o ajusta.
  const [recipientPhone, setRecipientPhone] = useState(defaultRecipientPhone || "");
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipientEmail || "");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleAddressSelect = (components: AddressComponents) => {
    setAddress(components.address);
    setPostalCode(components.postalCode);
    setCity(components.city);
    setProvince(components.province);
    setCountry(components.country || "España");
  };

  const handleSave = () => {
    setError(null);
    if (!pickup && !address.trim()) {
      setError("Selecciona o escribe una dirección, o marca 'Recogida en persona'");
      return;
    }

    // Cerramos optimistamente — el cambio en servidor se aplica en background
    // y router.refresh() actualiza el kanban cuando termine. Si falla mostramos
    // un alert (raro) en lugar de bloquear el popup esperando la respuesta.
    onOpenChange(false);
    startTransition(async () => {
      const result = pickup
        ? await setPickupInPerson(leadId, true)
        : await updateShippingAddress(leadId, {
            address,
            postalCode,
            city,
            province,
            country,
            recipientPhone,
            recipientEmail,
          });
      if (result.success) {
        router.refresh();
      } else {
        alert(`No se pudo guardar: ${result.error || "Error"}`);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Dirección de envío</DialogTitle>
          <DialogDescription>
            Empieza a escribir y elige una sugerencia de Google para
            autocompletar código postal, ciudad y provincia.
          </DialogDescription>
        </DialogHeader>

        <label className="flex items-center gap-2 rounded-md border border-zinc-200 bg-muted/30 px-3 py-2 text-sm cursor-pointer dark:border-zinc-700">
          <input
            type="checkbox"
            checked={pickup}
            onChange={(e) => setPickup(e.target.checked)}
            className="rounded border-zinc-300 text-brand focus:ring-brand dark:border-zinc-700"
          />
          <span>
            Recogida en persona{" "}
            <span className="text-muted-foreground">(no necesita envío)</span>
          </span>
        </label>

        <div className={`space-y-2 ${pickup ? "opacity-50 pointer-events-none" : ""}`}>
          <AddressAutocomplete
            name="shipping_address"
            className={inputClass}
            placeholder="Calle Mayor, 1"
            defaultValue={address}
            onAddressSelect={handleAddressSelect}
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="CP"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className={inputClass}
            />
            <input
              type="text"
              placeholder="Ciudad"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={inputClass}
            />
            <input
              type="text"
              placeholder="Provincia"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className={inputClass}
            />
            <input
              type="text"
              placeholder="País"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Contacto del destinatario{" "}
            <span className="text-muted-foreground/70">(confirma con el cliente)</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="tel"
              placeholder="Teléfono"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              className={inputClass}
            />
            <input
              type="email"
              placeholder="Email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            className="bg-brand text-white hover:bg-brand-dark"
          >
            {pickup ? "Guardar (recogida)" : "Guardar dirección"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
