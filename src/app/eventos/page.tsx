import type { Metadata } from "next";
import { LeadForm } from "./LeadForm";

export const metadata: Metadata = {
  title: "Tú lo sueñas, yo te lo hago — Prototipalo",
  description:
    "Diseñamos y fabricamos en 3D lo que necesites para tu evento o torneo. Madrid, plazos rápidos, exclusividad y envíos en 1 día.",
  robots: { index: true, follow: true },
};

type Props = {
  searchParams: Promise<{ src?: string }>;
};

export default async function EventosLanding({ searchParams }: Props) {
  const { src } = await searchParams;
  const source = typeof src === "string" ? src : null;

  return (
    <main className="min-h-svh bg-neutral-950 text-neutral-100 selection:bg-[#fdc52c] selection:text-neutral-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(0,158,220,0.35),transparent_60%)]"
      />

      <section className="relative mx-auto flex max-w-xl flex-col px-5 pt-10 pb-16 sm:max-w-2xl sm:px-8 sm:pt-16">
        <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium tracking-wide text-white/80 uppercase backdrop-blur">
          <span className="size-1.5 rounded-full bg-[#fdc52c]" />
          Producción 3D · Madrid
        </span>

        <h1 className="text-4xl leading-[1.05] font-bold tracking-tight sm:text-6xl">
          Tú lo sueñas,{" "}
          <span className="bg-gradient-to-r from-[#fdc52c] to-[#ffe082] bg-clip-text text-transparent">
            yo te lo hago.
          </span>
        </h1>

        <p className="mt-5 max-w-lg text-base leading-relaxed text-white/70 sm:text-lg">
          La frase podría ser de un gigoló o de un productor 3D. Por ahora,
          soy lo segundo. Si alguna vez has necesitado algo para tu evento o
          torneo, diseñamos y fabricamos todo lo que se te ocurra.
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur sm:p-6">
          <p className="text-sm font-medium text-white/90">
            Déjame tu correo y te enseño lo que hacemos.
          </p>
          <p className="mt-1 text-xs text-white/55">
            Cada día, ideas para vender más y mejor en tus eventos. Y de regalo,
            un diseño 3D personalizado al suscribirte.
          </p>
          <div className="mt-4">
            <LeadForm source={source} />
          </div>
        </div>

        <ul className="mt-10 grid gap-3 text-sm sm:grid-cols-2">
          <Bullet title="Sin aduanas">
            Las impresoras están en nuestra oficina del centro de Madrid. Nada
            traído de China.
          </Bullet>
          <Bullet title="Exclusividad real">
            Si traes diseño, lo hacemos. Si no, te asignamos un diseñador y es
            tuyo en exclusiva.
          </Bullet>
          <Bullet title="Plazos express">
            Como producimos en casa, atendemos urgencias en pocos días.
          </Bullet>
          <Bullet title="El color que quieras">
            Gama amplia de colores. Si necesitas uno concreto, danos el código.
          </Bullet>
          <Bullet title="Hasta 1 m³">
            La última vez que miré, la única máquina de venta al público en
            España capaz de eso.
          </Bullet>
          <Bullet title="Envíos en 1 día">
            Nada de logística mala. Sale de la impresora y al día siguiente lo
            tienes.
          </Bullet>
          <Bullet title="Con luces y mecánica">
            Mi compañero es ingeniero. Si lo quieres con luces, motores o que
            te dé los buenos días, se hace.
          </Bullet>
          <Bullet title="3D + metacrilato">
            Trabajamos los mejores materiales. Cuando te suscribas te enseño
            piezas combinando los dos.
          </Bullet>
        </ul>

        <p className="mt-10 text-xs text-white/45">
          P.D: A los diseñadores el regalo no les hace mucha gracia y puede que
          me hagan quitarlo. Por ahora, ahí está.
        </p>
      </section>
    </main>
  );
}

function Bullet({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
      <span
        aria-hidden
        className="mt-1 size-2 shrink-0 rounded-full bg-[#009edc] shadow-[0_0_12px_rgba(0,158,220,0.6)]"
      />
      <div>
        <div className="text-sm font-semibold text-white">{title}</div>
        <div className="mt-0.5 text-[13px] leading-snug text-white/65">
          {children}
        </div>
      </div>
    </li>
  );
}
