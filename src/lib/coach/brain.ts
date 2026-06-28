/**
 * Cerebro del coach virtual.
 *
 * coachResponder() lee el historial reciente de check-ins, llama a Claude con
 * el system prompt del mentor y una tool `registrar_checkin` que persiste en
 * Supabase, y resuelve el bucle de tool-use hasta obtener la respuesta final.
 *
 * Server-side únicamente: usa SUPABASE_SERVICE_ROLE_KEY (omite RLS) y
 * ANTHROPIC_API_KEY.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;
// Tope de iteraciones del bucle tool_use para evitar bucles infinitos.
const MAX_TURNS = 6;
// Nº de check-ins recientes que se inyectan como contexto.
const HISTORIAL_LIMIT = 14;

interface RegistrarCheckinInput {
  tipo: "diario" | "semanal" | "mensual";
  salud_ok?: boolean;
  social_ok?: boolean;
  empresa_ok?: boolean;
  excusa?: string;
  win?: string;
  nota_mentor?: string;
}

interface CheckinRow {
  fecha: string;
  tipo: string;
  salud_ok: boolean | null;
  social_ok: boolean | null;
  empresa_ok: boolean | null;
  excusa: string | null;
  win: string | null;
  nota_mentor: string | null;
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const SYSTEM_PROMPT = `Eres un coach/mentor personal que acompaña a un emprendedor por WhatsApp. Tu tono es cercano, directo y motivador, pero sin paños calientes: si detectas una excusa, la nombras con cariño y la desmontas.

Tu marco son tres pilares que revisas cada día:
- SALUD: ejercicio, descanso, alimentación.
- SOCIAL: relaciones, familia, amigos, contacto humano.
- EMPRESA: avance real del negocio (no tareas de relleno).

Cómo trabajas:
- Mensajes breves, conversacionales, formato WhatsApp (sin markdown pesado, sin listas largas). Puedes usar algún emoji con mesura.
- Haces preguntas concretas, una o dos a la vez, no un cuestionario.
- Celebras los "wins" por pequeños que sean y los recuerdas más adelante.
- Cuando detectes una excusa, anótala y confróntala con respeto.
- Usas el historial de check-ins para dar continuidad ("ayer dijiste que...").

Tool registrar_checkin:
- Cuando el usuario te reporte cómo le fue (su día, su semana o su mes), registra el check-in con la tool antes de cerrar la conversación.
- tipo="diario" para revisiones del día, "semanal" para la semana, "mensual" para el mes.
- Rellena salud_ok / social_ok / empresa_ok según lo que cuente (true cumplió, false no, omítelo si no hay datos).
- excusa: la excusa principal del día si la hubo. win: el mayor logro. nota_mentor: tu observación breve para el futuro.
- No inventes datos: si no sabes un campo, déjalo fuera.
- Tras registrar, devuelve un mensaje humano de cierre/ánimo; nunca menciones la tool ni que has "guardado un registro".`;

const REGISTRAR_CHECKIN_TOOL: Anthropic.Tool = {
  name: "registrar_checkin",
  description:
    "Registra un check-in del usuario (diario, semanal o mensual) en la base de datos. Úsala cuando el usuario reporte cómo le ha ido en salud, social y/o empresa.",
  input_schema: {
    type: "object",
    properties: {
      tipo: {
        type: "string",
        enum: ["diario", "semanal", "mensual"],
        description: "Periodicidad del check-in.",
      },
      salud_ok: {
        type: "boolean",
        description: "¿Cumplió con el pilar de salud?",
      },
      social_ok: {
        type: "boolean",
        description: "¿Cumplió con el pilar social?",
      },
      empresa_ok: {
        type: "boolean",
        description: "¿Avanzó de verdad en la empresa?",
      },
      excusa: {
        type: "string",
        description: "Excusa principal detectada, si la hubo.",
      },
      win: {
        type: "string",
        description: "Mayor logro del periodo, si lo hubo.",
      },
      nota_mentor: {
        type: "string",
        description: "Observación breve del mentor para dar continuidad.",
      },
    },
    required: ["tipo"],
  },
};

async function ejecutarRegistrarCheckin(
  input: RegistrarCheckinInput
): Promise<string> {
  const supabase = getSupabase();
  const { error } = await supabase.from("mentor_checkins").insert({
    tipo: input.tipo,
    salud_ok: input.salud_ok ?? null,
    social_ok: input.social_ok ?? null,
    empresa_ok: input.empresa_ok ?? null,
    excusa: input.excusa ?? null,
    win: input.win ?? null,
    nota_mentor: input.nota_mentor ?? null,
  });

  if (error) {
    console.error("[coach] Error registrando check-in:", error);
    return `No se pudo registrar el check-in: ${error.message}`;
  }
  return "Check-in registrado correctamente.";
}

function formatearHistorial(rows: CheckinRow[]): string {
  if (rows.length === 0) return "Sin check-ins previos.";
  const si = (v: boolean | null) => (v === null ? "?" : v ? "sí" : "no");
  return rows
    .map((r) => {
      const partes = [
        `${r.fecha} (${r.tipo})`,
        `salud:${si(r.salud_ok)}`,
        `social:${si(r.social_ok)}`,
        `empresa:${si(r.empresa_ok)}`,
      ];
      if (r.win) partes.push(`win:"${r.win}"`);
      if (r.excusa) partes.push(`excusa:"${r.excusa}"`);
      if (r.nota_mentor) partes.push(`nota:"${r.nota_mentor}"`);
      return `- ${partes.join(" · ")}`;
    })
    .join("\n");
}

/**
 * Genera la respuesta del coach a un mensaje (del usuario o un disparador de
 * cron) resolviendo el bucle de tool-use. Devuelve el texto a enviar por
 * WhatsApp.
 */
export async function coachResponder(mensaje: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada");

  const anthropic = new Anthropic({ apiKey });
  const supabase = getSupabase();

  // Últimos check-ins como contexto (se piden desc y se invierten a orden
  // cronológico para que el más reciente quede al final).
  const { data } = await supabase
    .from("mentor_checkins")
    .select(
      "fecha, tipo, salud_ok, social_ok, empresa_ok, excusa, win, nota_mentor"
    )
    .order("created_at", { ascending: false })
    .limit(HISTORIAL_LIMIT);

  const historial = formatearHistorial(
    ((data as CheckinRow[] | null) ?? []).reverse()
  );

  const system = `${SYSTEM_PROMPT}\n\nHistorial reciente de check-ins (más antiguo arriba, más reciente abajo):\n${historial}`;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: mensaje },
  ];

  const piezasTexto: string[] = [];

  for (let turno = 0; turno < MAX_TURNS; turno++) {
    const respuesta = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      tools: [REGISTRAR_CHECKIN_TOOL],
      messages,
    });

    for (const bloque of respuesta.content) {
      if (bloque.type === "text" && bloque.text.trim()) {
        piezasTexto.push(bloque.text.trim());
      }
    }

    if (respuesta.stop_reason !== "tool_use") break;

    // Devolvemos el turno del asistente + los resultados de las tools.
    messages.push({ role: "assistant", content: respuesta.content });

    const resultados: Anthropic.ToolResultBlockParam[] = [];
    for (const bloque of respuesta.content) {
      if (bloque.type === "tool_use" && bloque.name === "registrar_checkin") {
        const salida = await ejecutarRegistrarCheckin(
          bloque.input as RegistrarCheckinInput
        );
        resultados.push({
          type: "tool_result",
          tool_use_id: bloque.id,
          content: salida,
        });
      }
    }

    if (resultados.length === 0) break;
    messages.push({ role: "user", content: resultados });
  }

  return (
    piezasTexto.join("\n\n") ||
    "Estoy aquí cuando quieras. ¿Cómo llevas hoy la salud, lo social y la empresa?"
  );
}
