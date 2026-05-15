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
import { updateDesiredDeliveryDate } from "./actions";

interface DeliveryDateModalProps {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: string | null;
}

const inputClass =
  "block w-full rounded-md border border-zinc-300 bg-white px-2.5 py-2 text-sm tabular-nums text-zinc-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-zinc-700 dark:bg-zinc-800 dark:text-white";

export function DeliveryDateModal({
  leadId,
  open,
  onOpenChange,
  initialDate,
}: DeliveryDateModalProps) {
  const router = useRouter();
  const [date, setDate] = useState<string>(() => {
    if (!initialDate) return "";
    return initialDate.slice(0, 10);
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSave = () => {
    if (!date) {
      setError("Selecciona una fecha");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateDesiredDeliveryDate(leadId, date);
      if (result.success) {
        onOpenChange(false);
        router.refresh();
      } else {
        setError(result.error || "Error al guardar");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Fecha de entrega</DialogTitle>
          <DialogDescription>
            Necesaria para planificar producción y envío.
          </DialogDescription>
        </DialogHeader>

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass}
          autoFocus
        />

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={pending}
            className="bg-brand text-white hover:bg-brand-dark"
          >
            {pending ? "Guardando..." : "Guardar fecha"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
