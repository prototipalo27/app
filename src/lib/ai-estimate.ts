import Anthropic from "@anthropic-ai/sdk";

interface EstimationResult {
  quantity: string | null;
  complexity: string | null;
  urgency: string | null;
}

const VALID_QUANTITIES = ["1-10", "10-50", "50-200", "200-500", "500+"];
const VALID_COMPLEXITIES = ["low", "medium", "high"];
const VALID_URGENCIES = ["normal", "urgent"];

/**
 * Use AI to estimate quantity, complexity, and urgency from a lead message.
 * Returns null fields when the message doesn't contain enough info.
 * Non-fatal: returns all nulls on failure.
 */
export async function estimateFromMessage(
  message: string | null
): Promise<EstimationResult> {
  const empty: EstimationResult = { quantity: null, complexity: null, urgency: null };
  if (!message?.trim()) return empty;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return empty;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      system: `Eres un asistente de un taller de impresion 3D (Prototipalo). Analiza el mensaje de un cliente potencial y estima:

1. quantity: rango de unidades que probablemente necesita. Valores posibles: "1-10", "10-50", "50-200", "200-500", "500+". Si no hay pista, pon null.
2. complexity: complejidad del proyecto. Valores: "low" (piezas simples, llaveros), "medium" (piezas estandar), "high" (mecanismos, encajes, acabados especiales). Si no hay pista, pon "medium".
3. urgency: "urgent" si el mensaje menciona prisa, plazo corto, evento proximo, etc. Si no, "normal".

Responde SOLO con JSON valido: {"quantity":"...","complexity":"...","urgency":"..."}
Usa null (sin comillas) cuando no haya informacion suficiente.`,
      messages: [
        { role: "user", content: message.trim() },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const parsed = JSON.parse(text) as Record<string, string | null>;

    return {
      quantity: parsed.quantity && VALID_QUANTITIES.includes(parsed.quantity) ? parsed.quantity : null,
      complexity: parsed.complexity && VALID_COMPLEXITIES.includes(parsed.complexity) ? parsed.complexity : null,
      urgency: parsed.urgency && VALID_URGENCIES.includes(parsed.urgency) ? parsed.urgency : null,
    };
  } catch {
    return empty;
  }
}
