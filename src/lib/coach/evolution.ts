/**
 * Envío de mensajes de WhatsApp para el coach virtual vía Evolution API.
 *
 * Usa una instancia dedicada (EVOLUTION_INSTANCE) y soporta tanto Evolution
 * API v1 como v2: el cuerpo de la petición de /message/sendText cambia entre
 * versiones, así que se selecciona con EVOLUTION_API_VERSION.
 *
 * Variables de entorno requeridas:
 *   EVOLUTION_API_URL       base URL de la instancia (sin barra final)
 *   EVOLUTION_API_KEY       apikey global / de instancia
 *   EVOLUTION_INSTANCE_NAME nombre de la instancia (compartida con el negocio)
 *   EVOLUTION_API_VERSION   "v1" | "v2" (por defecto v2)
 */

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE =
  process.env.EVOLUTION_INSTANCE_NAME ?? process.env.EVOLUTION_INSTANCE;
const EVOLUTION_API_VERSION =
  process.env.EVOLUTION_API_VERSION === "v1" ? "v1" : "v2";

/**
 * Envía un mensaje de texto a `numero` (formato internacional sin "+",
 * p. ej. "34612345678") usando la instancia dedicada del coach.
 */
export async function enviarWhatsApp(
  numero: string,
  texto: string
): Promise<unknown> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
    throw new Error(
      "Evolution API no configurada: faltan EVOLUTION_API_URL, EVOLUTION_API_KEY o EVOLUTION_INSTANCE_NAME"
    );
  }

  // v1 anida el texto en `textMessage` y usa `options`; v2 lo aplana.
  const body =
    EVOLUTION_API_VERSION === "v1"
      ? {
          number: numero,
          options: { delay: 800, presence: "composing" },
          textMessage: { text: texto },
        }
      : {
          number: numero,
          text: texto,
        };

  const res = await fetch(
    `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const detalle = await res.text();
    throw new Error(`Evolution API error ${res.status}: ${detalle}`);
  }

  return res.json();
}
