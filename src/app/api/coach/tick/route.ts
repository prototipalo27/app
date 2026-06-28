/**
 * GET /api/coach/tick?slot=<manana|noche|semanal|mensual>
 *
 * Disparador proactivo del coach, invocado por un cron externo (VPS Hetzner).
 * Protegido por COACH_CRON_SECRET, aceptado vía header Authorization: Bearer
 * <secret> o query param ?secret=<secret>.
 *
 * Cada slot inyecta un mensaje-disparador interno; el coach genera el saludo
 * proactivo y lo envía por WhatsApp a COACH_TARGET_NUMBER.
 */

import { NextRequest, NextResponse } from "next/server";
import { coachResponder } from "@/lib/coach/brain";
import { enviarWhatsApp } from "@/lib/coach/evolution";

type Slot = "manana" | "noche" | "semanal" | "mensual";

const SLOT_PROMPTS: Record<Slot, string> = {
  manana:
    "[Disparador interno: arranque de la mañana] Salúdale para empezar el día. Pregúntale, en corto, qué se propone hoy en salud, social y empresa. Tono motivador. No registres ningún check-in todavía.",
  noche:
    "[Disparador interno: cierre de la noche] Es hora del check-in diario. Pregúntale cómo le fue el día en los tres pilares (salud, social, empresa), si hubo alguna excusa y cuál fue su mayor win. Cuando te responda registra el check-in diario.",
  semanal:
    "[Disparador interno: revisión semanal] Haz la revisión de la semana: balance de los tres pilares, patrón de excusas y los wins de la semana. Cuando te responda registra el check-in semanal.",
  mensual:
    "[Disparador interno: revisión mensual] Haz la revisión del mes: visión global de salud, social y empresa, aprendizajes y el gran win del mes. Cuando te responda registra el check-in mensual.",
};

const SLOTS = Object.keys(SLOT_PROMPTS) as Slot[];

function isSlot(value: string | null): value is Slot {
  return value !== null && (SLOTS as string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const secret = process.env.COACH_CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "COACH_CRON_SECRET no configurada" },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const authHeader = request.headers.get("authorization");
  const querySecret = url.searchParams.get("secret");
  const autorizado =
    authHeader === `Bearer ${secret}` || querySecret === secret;
  if (!autorizado) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slot = url.searchParams.get("slot");
  if (!isSlot(slot)) {
    return NextResponse.json(
      { error: `slot inválido; usa uno de: ${SLOTS.join(", ")}` },
      { status: 400 }
    );
  }

  const target = process.env.COACH_TARGET_NUMBER;
  if (!target) {
    return NextResponse.json(
      { error: "COACH_TARGET_NUMBER no configurada" },
      { status: 500 }
    );
  }

  try {
    const respuesta = await coachResponder(SLOT_PROMPTS[slot]);
    await enviarWhatsApp(target, respuesta);
  } catch (err) {
    console.error(`[coach] Error en tick slot=${slot}:`, err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, slot });
}
