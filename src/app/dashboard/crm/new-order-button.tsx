"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NewOrderModal } from "./new-order-modal";

export function NewOrderButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline" className="border-brand/30 text-brand hover:bg-brand/5">
        + Nuevo pedido
      </Button>
      <NewOrderModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
