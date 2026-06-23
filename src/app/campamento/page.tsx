import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { connection } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { CampForm } from "./CampForm";
import { ViewBeacon } from "./ViewBeacon";

export const metadata: Metadata = {
  title: "Campamento de impresión 3D para niños · 29 jun – 3 jul | Prototipalo",
  description:
    "Una semana creando con impresoras 3D en el centro de Madrid (Calle Viriato 27, junto al metro Iglesia). Del 29 de junio al 3 de julio, de 10:00 a 14:00. Edades 11–12 años. Plazas limitadas.",
  robots: { index: true, follow: true },
};

// Tope real de inscripciones (control interno de aforo).
const MAX_SLOTS = 6;

const FACTS = [
  { k: "Fechas", v: "29 jun – 3 jul" },
  { k: "Horario", v: "10:00 – 14:00" },
  { k: "Edades", v: "11 – 12 años" },
  { k: "Plazas", v: "Limitadas" },
];

const LEARN = [
  {
    title: "Diseñan en 3D",
    body: "Aprenden a modelar sus propias piezas desde cero con software real de diseño.",
  },
  {
    title: "Imprimen de verdad",
    body: "Cada idea sale de la impresora. Se llevan a casa lo que crean durante la semana.",
  },
  {
    title: "Grupo muy reducido",
    body: "Solo 6 alumnos y cada uno con su propia impresora: atención directa y su propio proyecto.",
  },
  {
    title: "Junto al metro Iglesia",
    body: "En nuestro taller de Calle Viriato 27, con las mismas máquinas con las que producimos a diario.",
  },
];

async function takenSlots(): Promise<number> {
  // Opt-in a render dinámico: la cuenta de plazas debe ser siempre fresca y
  // usamos la hora actual para el corte de reservas abandonadas.
  await connection();
  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("camp_registrations")
    .select("id", { count: "exact", head: true })
    .or(`status.eq.paid,and(status.eq.pending,created_at.gte.${cutoff})`);
  return count ?? 0;
}

async function Registration() {
  const taken = await takenSlots();
  const remaining = Math.max(0, MAX_SLOTS - taken);
  const soldOut = remaining <= 0;
  // Mensaje cualitativo de urgencia: sin número de plazas, solo escasez.
  const urgency = remaining <= 2 ? "¡Última plaza!" : "¡Quedan pocas plazas!";

  return (
    <div className="rounded-2xl border border-[#fdc52c]/25 bg-white/[0.03] p-5 shadow-[0_0_40px_-12px_rgba(253,197,44,0.35)] backdrop-blur sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">Reserva la plaza de tu hijo/a</p>
        {!soldOut && (
          <span className="inline-flex shrink-0 animate-pulse items-center gap-1.5 rounded-full border border-[#fdc52c]/40 bg-[#fdc52c]/10 px-2.5 py-1 text-[11px] font-semibold text-[#fdc52c]">
            <span className="size-1.5 rounded-full bg-[#fdc52c]" />
            {urgency}
          </span>
        )}
      </div>
      <p className="mt-1 mb-4 text-xs text-white/55">
        300 € la semana completa. Reservas con 50 € por tarjeta y pagas los 250 €
        restantes en efectivo el primer día. Las plazas se asignan por orden de pago.
      </p>
      <CampForm soldOut={soldOut} />
    </div>
  );
}

function RegistrationFallback() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur sm:p-6">
      <div className="h-5 w-48 animate-pulse rounded bg-white/10" />
      <div className="mt-3 h-3 w-full animate-pulse rounded bg-white/5" />
      <div className="mt-5 h-44 animate-pulse rounded-lg bg-white/5" />
    </div>
  );
}

export default function CampamentoLanding() {
  return (
    <main className="relative min-h-svh bg-neutral-950 text-neutral-100 selection:bg-[#fdc52c] selection:text-neutral-900">
      <ViewBeacon />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[460px] bg-[radial-gradient(ellipse_at_top,rgba(0,158,220,0.35),transparent_60%)]"
      />

      <section className="relative mx-auto flex max-w-xl flex-col px-5 pt-10 pb-16 sm:max-w-2xl sm:px-8 sm:pt-16">
        <Image
          src="/campamento/anuncio.png"
          alt="Campamento de Diseño e Impresión 3D · del 29 de junio al 3 de julio en Chamberí, para niños de 10 a 13 años. Plazas limitadas."
          width={1733}
          height={907}
          priority
          sizes="(min-width: 640px) 42rem, 100vw"
          className="mb-8 h-auto w-full rounded-2xl border border-white/10 shadow-[0_0_50px_-12px_rgba(0,158,220,0.45)]"
        />

        <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium tracking-wide text-white/80 uppercase backdrop-blur">
          <span className="size-1.5 rounded-full bg-[#fdc52c]" />
          Campamento de verano · Madrid
        </span>

        <h1 className="text-4xl leading-[1.05] font-bold tracking-tight sm:text-6xl">
          Una semana{" "}
          <span className="bg-gradient-to-r from-[#fdc52c] to-[#ffe082] bg-clip-text text-transparent">
            imprimiendo en 3D
          </span>
        </h1>

        <p className="mt-5 max-w-lg text-base leading-relaxed text-white/70 sm:text-lg">
          Del 29 de junio al 3 de julio, tu hijo/a pasa la semana en nuestro
          taller del centro de Madrid diseñando e imprimiendo sus propias
          creaciones en 3D. Grupo reducido, de 11 a 12 años.
        </p>

        <p className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg border border-[#fdc52c]/30 bg-[#fdc52c]/10 px-3 py-1.5 text-sm font-medium text-[#fdc52c]">
          <span className="size-1.5 animate-pulse rounded-full bg-[#fdc52c]" />
          Plazas limitadas · quedan pocas
        </p>

        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FACTS.map((f) => (
            <div
              key={f.k}
              className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5"
            >
              <dt className="text-[11px] tracking-wide text-white/45 uppercase">
                {f.k}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-white">{f.v}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-sm text-white/55">
          ¿Necesitas recogerlo más tarde? Hay opción de quedarse hasta las{" "}
          <span className="font-medium text-white/80">15:00 sin coste</span>.
        </p>

        <a
          href="https://maps.google.com/?q=Calle+Viriato+27,+28010+Madrid"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5 transition hover:border-[#009edc]/40"
        >
          <span
            aria-hidden
            className="mt-1 size-2 shrink-0 rounded-full bg-[#009edc] shadow-[0_0_12px_rgba(0,158,220,0.6)]"
          />
          <div>
            <div className="text-sm font-semibold text-white">Prototipalo · Calle Viriato 27</div>
            <div className="mt-0.5 text-[13px] leading-snug text-white/65">
              28010 Madrid · justo al lado del metro Iglesia. Ver en el mapa →
            </div>
          </div>
        </a>

        <div className="mt-8">
          <Suspense fallback={<RegistrationFallback />}>
            <Registration />
          </Suspense>
        </div>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2">
          {LEARN.map((item) => (
            <li
              key={item.title}
              className="flex gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5"
            >
              <span
                aria-hidden
                className="mt-1 size-2 shrink-0 rounded-full bg-[#009edc] shadow-[0_0_12px_rgba(0,158,220,0.6)]"
              />
              <div>
                <div className="text-sm font-semibold text-white">{item.title}</div>
                <div className="mt-0.5 text-[13px] leading-snug text-white/65">
                  {item.body}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-xs text-white/45">
          ¿Dudas? Escríbenos a{" "}
          <a className="text-white/70 underline" href="mailto:info@prototipalo.com">
            info@prototipalo.com
          </a>
          . Prototipalo · Producción 3D en Madrid.
        </p>
      </section>
    </main>
  );
}
