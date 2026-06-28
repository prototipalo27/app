/**
 * POST /api/coach/webhook
 *
 * Webhook de Evolution API para el coach virtual. Solo procesa eventos
 * messages.upsert entrantes (no propios) del número objetivo
 * (COACH_TARGET_NUMBER); el resto se ignora silenciosamente con 200 para que
 * Evolution no reintente.
 */

import { NextRequest, NextResponse } from "next/server";
import { coachResponder } from "@/lib/coach/brain";
import { enviarWhatsApp } from "@/lib/coach/evolution";

interface EvolutionMessage {
  key?: { remoteJid?: string; fromMe?: boolean; id?: string };
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
  };
}

interface EvolutionWebhookBody {
  event?: string;
  data?: EvolutionMessage | EvolutionMessage[];
}

const ok = () => NextResponse.json({ ok: true });

export async function POST(request: NextRequest) {
  let body: EvolutionWebhookBody;
  try {
    body = (await request.json()) as EvolutionWebhookBody;
  } catch {
    return ok();
  }

  // Evolution v2 envía "messages.upsert", v1 "MESSAGES_UPSERT".
  const event = (body.event ?? "").toLowerCase().replace(/_/g, ".");
  if (event !== "messages.upsert") return ok();

  const target = process.env.COACH_TARGET_NUMBER;
  if (!target) {
    console.error("[coach] COACH_TARGET_NUMBER no configurada");
    return ok();
  }

  // data puede llegar como objeto único o como array.
  const data = Array.isArray(body.data) ? body.data[0] : body.data;
  if (!data?.key) return ok();

  // Ignora mensajes propios (enviados por el coach).
  if (data.key.fromMe) return ok();

  // Responde solo al número objetivo.
  const remoteJid = data.key.remoteJid ?? "";
  const numero = remoteJid.replace("@s.whatsapp.net", "");
  if (numero !== target) return ok();

  // Extrae el texto de conversation o extendedTextMessage.
  const texto =
    data.message?.conversation ??
    data.message?.extendedTextMessage?.text ??
    "";
  if (!texto.trim()) return ok();

  try {
    const respuesta = await coachResponder(texto.trim());
    await enviarWhatsApp(target, respuesta);
  } catch (err) {
    console.error("[coach] Error procesando mensaje:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return ok();
}
