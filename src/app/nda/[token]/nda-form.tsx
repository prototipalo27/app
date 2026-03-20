"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signNda } from "./actions";

interface NdaFormProps {
  token: string;
}

export default function NdaForm({ token }: NdaFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"data" | "sign">("data");

  // Form data
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [nif, setNif] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || step !== "sign") return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1a1a1a";
  }, [step]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSigned(true);
  };

  const stopDraw = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const handleDataSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !nif.trim() || !address.trim() || !email.trim()) {
      setError("Todos los campos son obligatorios");
      return;
    }
    setError(null);
    setStep("sign");
  };

  const handleSign = () => {
    if (!hasSigned) {
      setError("Debes firmar en el recuadro");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const signatureData = canvas.toDataURL("image/png");

    setError(null);
    startTransition(async () => {
      const result = await signNda(token, {
        signer_name: name.trim(),
        signer_company: company.trim(),
        signer_nif: nif.trim(),
        signer_address: address.trim(),
        signer_email: email.trim(),
        signature_data: signatureData,
      });

      if (!result.success) {
        setError(result.error || "Error al firmar");
      } else {
        router.refresh();
      }
    });
  };

  const inputClass =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-700";

  if (step === "data") {
    return (
      <form onSubmit={handleDataSubmit}>
        {/* NDA Preview */}
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Texto del acuerdo
          </h2>
          <div className="max-h-64 overflow-y-auto text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            <p className="mb-3">
              El presente acuerdo se celebra entre <strong>Prototipalo S.L.</strong> (CIF: B56592953),
              con domicilio en Calle Viriato 27, 28010 Madrid, y la parte firmante.
            </p>
            <p className="mb-3">
              Ambas partes acuerdan mantener en estricta confidencialidad toda la información
              intercambiada en el marco de su relación comercial, incluyendo pero no limitándose a:
              diseños, planos, modelos 3D, prototipos, procesos de fabricación, estrategias comerciales
              y datos de clientes.
            </p>
            <p className="mb-3">
              La parte receptora se compromete a no divulgar dicha información a terceros sin
              consentimiento previo por escrito, y a utilizarla únicamente para los fines de la
              relación comercial.
            </p>
            <p className="mb-3">
              Las obligaciones de confidencialidad permanecerán vigentes durante 2 años desde la
              firma, incluso tras la finalización de la relación comercial.
            </p>
            <p>
              Este acuerdo se rige por la legislación española, sometiéndose las partes a los
              juzgados y tribunales de Madrid.
            </p>
          </div>
        </div>

        {/* Data form */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Tus datos
          </h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Nombre completo *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan García López"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Empresa
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Nombre de la empresa (opcional)"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                NIF / CIF *
              </label>
              <input
                type="text"
                value={nif}
                onChange={(e) => setNif(e.target.value)}
                placeholder="12345678A o B12345678"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Dirección *
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Calle, número, CP, ciudad"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className={inputClass}
                required
              />
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                Recibirás una copia firmada en este email.
              </p>
            </div>
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            className="mt-6 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            Continuar a la firma
          </button>
        </div>
      </form>
    );
  }

  // Step 2: Signature
  return (
    <div>
      {/* Summary */}
      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Datos del firmante
          </h2>
          <button
            type="button"
            onClick={() => setStep("data")}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            Editar
          </button>
        </div>
        <div className="mt-3 grid gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <p><span className="font-medium text-zinc-900 dark:text-white">{name}</span></p>
          {company && <p>{company}</p>}
          <p>NIF: {nif}</p>
          <p>{address}</p>
          <p>{email}</p>
        </div>
      </div>

      {/* Signature canvas */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Firma
          </h2>
          {hasSigned && (
            <button
              type="button"
              onClick={clearSignature}
              className="text-sm text-red-600 hover:underline dark:text-red-400"
            >
              Borrar firma
            </button>
          )}
        </div>
        <p className="mb-3 text-xs text-zinc-400 dark:text-zinc-500">
          Dibuja tu firma con el dedo o el ratón en el recuadro.
        </p>
        <div className="overflow-hidden rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-600">
          <canvas
            ref={canvasRef}
            className="h-40 w-full cursor-crosshair bg-white touch-none dark:bg-zinc-800"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="mt-4 space-y-3">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Al firmar, aceptas los términos del acuerdo de confidencialidad mostrado anteriormente.
            Se registrará tu IP y la fecha de firma como prueba de aceptación.
          </p>
          <button
            type="button"
            onClick={handleSign}
            disabled={isPending || !hasSigned}
            className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Firmando..." : "Firmar acuerdo"}
          </button>
        </div>
      </div>
    </div>
  );
}
