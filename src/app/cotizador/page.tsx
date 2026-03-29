import { QuoteCalculator } from "./quote-calculator";

export const metadata = {
  title: "Cotizador 3D — Prototipalo",
  description: "Calcula el precio de imprimir tu pieza en 3D al instante",
};

export default function CotizadorPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
            Cotizador de impresion 3D
          </h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">
            Sube tu archivo STL y obtendras un precio estimado al instante
          </p>
        </div>

        <QuoteCalculator />

        <p className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
          Precio orientativo basado en PLA, 15% relleno, 0.2mm capa.
          El presupuesto final puede variar segun complejidad, material y acabados.
        </p>
      </div>
    </div>
  );
}
