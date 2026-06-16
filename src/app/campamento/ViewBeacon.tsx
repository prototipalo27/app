"use client";

import { useEffect } from "react";

// Registra una visita a la landing una sola vez por sesión de navegador.
// No renderiza nada.
export function ViewBeacon() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("camp_viewed") === "1") return;
      sessionStorage.setItem("camp_viewed", "1");
    } catch {
      // sessionStorage no disponible (modo privado, etc.): registramos igual.
    }
    fetch("/api/campamento/view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ referrer: document.referrer || null }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  return null;
}
