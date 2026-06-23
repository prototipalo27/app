import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { createOneTimePaymentLink } from "@/lib/stripe/payment-links";

// Sin tope automático de aforo: se gestiona a mano cortando los anuncios cuando
// se llena (mantener en sync con la landing). Señal que se cobra por Stripe (el
// resto, 250 €, se abona en efectivo el primer día).
const MAX_SLOTS = 9999;
const DEPOSIT_CENTS = 5000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Teléfono ES flexible: dígitos, espacios, +, guiones y paréntesis.
const PHONE_RE = /^[+\d][\d\s().-]{6,19}$/;

function hashIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip");
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

/**
 * Plazas ocupadas: inscripciones pagadas + reservas 'pending' de las últimas 2
 * horas (señales en curso que aún no han completado el pago). Las pending más
 * antiguas se consideran abandonadas y liberan su plaza.
 */
async function takenSlots(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<number> {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("camp_registrations")
    .select("id", { count: "exact", head: true })
    .or(`status.eq.paid,and(status.eq.pending,created_at.gte.${cutoff})`);
  return count ?? 0;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const data = (body ?? {}) as Record<string, unknown>;
  const payerName = typeof data.payerName === "string" ? data.payerName.trim() : "";
  const payerEmail =
    typeof data.payerEmail === "string" ? data.payerEmail.trim().toLowerCase() : "";
  const payerPhone = typeof data.payerPhone === "string" ? data.payerPhone.trim() : "";
  const childName = typeof data.childName === "string" ? data.childName.trim() : "";
  const extendedHours = data.extendedHours === true;
  const honeypot = typeof data.company === "string" ? data.company : "";

  // Honeypot anti-bots: campo oculto que solo rellenan los bots.
  if (honeypot) {
    return NextResponse.json({ error: "full" }, { status: 409 });
  }

  if (!payerName || payerName.length > 120) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }
  if (!payerEmail || !EMAIL_RE.test(payerEmail) || payerEmail.length > 200) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (!payerPhone || !PHONE_RE.test(payerPhone)) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }
  if (!childName || childName.length > 120) {
    return NextResponse.json({ error: "invalid_child" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Control de aforo antes de reservar.
  if ((await takenSlots(supabase)) >= MAX_SLOTS) {
    return NextResponse.json({ error: "full" }, { status: 409 });
  }

  // 1) Creamos la inscripción 'pending' (reserva la plaza durante el pago).
  const { data: reg, error: insertErr } = await supabase
    .from("camp_registrations")
    .insert({
      payer_name: payerName,
      payer_email: payerEmail,
      payer_phone: payerPhone,
      child_name: childName,
      extended_hours: extendedHours,
      deposit_amount_cents: DEPOSIT_CENTS,
      user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      ip_hash: hashIp(req),
    })
    .select("id")
    .single();

  if (insertErr || !reg) {
    console.error("[api/campamento] insert failed", insertErr);
    return NextResponse.json({ error: "store_failed" }, { status: 500 });
  }

  // 2) Re-chequeo de aforo: si entre el conteo y el insert se llenó, anulamos.
  if ((await takenSlots(supabase)) > MAX_SLOTS) {
    await supabase
      .from("camp_registrations")
      .update({ status: "cancelled" })
      .eq("id", reg.id);
    return NextResponse.json({ error: "full" }, { status: 409 });
  }

  // 3) Link de pago de Stripe para la señal de 50 €.
  try {
    const { id: linkId, url } = await createOneTimePaymentLink({
      label: "Señal campamento 3D · 29 jun – 3 jul",
      amountCents: DEPOSIT_CENTS,
      metadata: {
        payment_type: "camp_deposit",
        camp_registration_id: reg.id,
        child_name: childName,
      },
      successPath: "/campamento/gracias?session_id={CHECKOUT_SESSION_ID}",
    });

    await supabase
      .from("camp_registrations")
      .update({ stripe_payment_link_id: linkId })
      .eq("id", reg.id);

    return NextResponse.json({ url });
  } catch (e) {
    console.error("[api/campamento] payment link failed", e);
    await supabase
      .from("camp_registrations")
      .update({ status: "cancelled" })
      .eq("id", reg.id);
    return NextResponse.json({ error: "payment_failed" }, { status: 500 });
  }
}
