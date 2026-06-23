"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

// Empuja el evento de conversión a dataLayer cuando Stripe ha confirmado el
// pago de la señal. GTM lo recoge para disparar las conversiones de Google/Meta
// Ads. Incluimos el id de sesión como transaction_id para que la plataforma de
// anuncios pueda deduplicar si el usuario recarga la página de gracias.
export function ConversionBeacon({ transactionId }: { transactionId?: string }) {
  useEffect(() => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "reserva_pagada",
      value: 50,
      currency: "EUR",
      transaction_id: transactionId,
    });
  }, [transactionId]);

  return null;
}
