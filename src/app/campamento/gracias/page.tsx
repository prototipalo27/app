import { Suspense } from "react";
import { ConversionBeacon } from "./ConversionBeacon";

export const metadata = {
  title: "Inscripción confirmada · Campamento 3D | Prototipalo",
  robots: { index: false, follow: false },
};

export default function CampamentoGraciasPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  return (
    <main className="relative flex min-h-svh items-center justify-center bg-neutral-950 px-5 text-neutral-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(0,158,220,0.35),transparent_60%)]"
      />
      <Suspense fallback={<Fallback />}>
        <Status searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Status({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  // Verificamos el estado real en Stripe: una sesión puede revisitarse sin
  // estar pagada, así que solo confirmamos si payment_status === "paid".
  let paid = false;
  if (session_id) {
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      const session = await stripe.checkout.sessions.retrieve(session_id);
      paid = session.payment_status === "paid";
    } catch {
      paid = false;
    }
  }

  if (paid) {
    return (
      <div className="relative mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur">
        <ConversionBeacon transactionId={session_id} />
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-[#fdc52c]/15">
          <svg
            className="size-8 text-[#fdc52c]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mb-2 text-xl font-bold text-white">¡Plaza reservada!</h1>
        <p className="text-sm leading-relaxed text-white/70">
          Hemos recibido la señal de 50 €. Te escribiremos por correo con los
          últimos detalles del campamento (29 jun – 3 jul, 10:00–14:00). Recuerda
          traer los <strong className="text-white/90">250 € restantes en efectivo</strong>{" "}
          el primer día.
        </p>
        <a
          href="https://prototipalo.com"
          className="mt-6 inline-block rounded-lg bg-[#fdc52c] px-6 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-[#ffd24d]"
        >
          Volver a Prototipalo
        </a>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur">
      <h1 className="mb-2 text-xl font-bold text-white">Pago no confirmado</h1>
      <p className="text-sm leading-relaxed text-white/70">
        No hemos podido confirmar el pago de la señal. Si crees que es un error,
        escríbenos a{" "}
        <a className="text-[#fdc52c] underline" href="mailto:info@prototipalo.com">
          info@prototipalo.com
        </a>
        .
      </p>
      <a
        href="/campamento"
        className="mt-6 inline-block rounded-lg border border-white/15 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-white/5"
      >
        Volver a intentarlo
      </a>
    </div>
  );
}

function Fallback() {
  return (
    <div className="relative mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur">
      <div className="mx-auto h-6 w-40 animate-pulse rounded bg-white/10" />
      <div className="mx-auto mt-4 h-3 w-full animate-pulse rounded bg-white/5" />
    </div>
  );
}
