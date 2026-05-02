"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signNda } from "./actions";
import {
  REUNIDOS_EMPRESA,
  reunidosReceptor,
  EXPONEN_TEXT,
  NDA_CLAUSES,
  CLOSING_TEXT,
  type NdaSignerData,
} from "@/lib/nda-text";
import {
  buildPrototipaloIntro,
  buildCounterpartyIntro,
  buildRecitalI,
  RECITAL_II,
  RECITAL_III,
  PARTIES_INTRO_PARAGRAPH,
  NOW_THEREFORE,
  STUDIO_NDA_CLAUSES,
  CLOSING_PARAGRAPH,
  type StudioNdaSigner,
} from "@/lib/studio-nda-text";

interface NdaFormProps {
  token: string;
  kind?: "lead" | "studio";
  projectDescription?: string | null;
}

const LEAD_LABELS = {
  agreementSection: "Texto del acuerdo",
  readingTime: "~2 minutos de lectura",
  preview_hint:
    "Tus datos sustituirán a los placeholders ([Nombre o empresa firmante]…) cuando los rellenes abajo. Al firmar verás el contrato definitivo con tu información antes de enviarlo.",
  acceptCheckbox: "He leído los términos del acuerdo de confidencialidad mostrado arriba y acepto su contenido.",
  yourData: "Tus datos",
  fullName: "Nombre completo",
  fullNamePlaceholder: "Juan García López",
  company: "Empresa",
  companyPlaceholder: "Nombre de la empresa (opcional)",
  position: "Cargo",
  positionPlaceholder: "CEO, CTO, Founder…",
  taxId: "NIF / CIF",
  taxIdPlaceholder: "12345678A o B12345678",
  address: "Dirección",
  addressPlaceholder: "Calle, número, CP, ciudad",
  email: "Email",
  emailHint: "Recibirás una copia firmada en este email.",
  continueToSign: "Continuar a la firma",
  finalAgreement: "Acuerdo definitivo",
  signerData: "Datos del firmante",
  edit: "Editar",
  signature: "Firma",
  signatureHint: "Dibuja tu firma con el dedo o el ratón en el recuadro.",
  clearSignature: "Borrar firma",
  signatureLegal:
    "Al firmar, aceptas los términos del acuerdo de confidencialidad mostrado anteriormente. Se registrará tu IP y la fecha de firma como prueba de aceptación.",
  signCta: "Firmar acuerdo",
  signing: "Firmando...",
  errorAllRequired: "Todos los campos son obligatorios",
  errorAcceptTerms: "Debes confirmar que has leído los términos del acuerdo",
  errorMustSign: "Debes firmar en el recuadro",
  errorSignFailed: "Error al firmar",
} as const;

const STUDIO_LABELS = {
  agreementSection: "Agreement text",
  readingTime: "~5 minute read",
  preview_hint:
    "Your details will replace the placeholders ([COUNTERPARTY LEGAL NAME]…) once you fill in the form below. Before signing you'll see the final agreement populated with your information.",
  acceptCheckbox:
    "I have read the terms of the non-disclosure agreement above and accept its contents.",
  yourData: "Your details",
  fullName: "Full name",
  fullNamePlaceholder: "John Doe",
  company: "Legal entity",
  companyPlaceholder: "Company / individual name",
  position: "Position",
  positionPlaceholder: "CEO, CTO, Founder…",
  taxId: "VAT / Tax ID",
  taxIdPlaceholder: "B12345678 / VAT number",
  address: "Registered address",
  addressPlaceholder: "Street, number, postcode, city, country",
  email: "Email",
  emailHint: "We'll email you a signed copy at this address.",
  continueToSign: "Continue to signature",
  finalAgreement: "Final agreement",
  signerData: "Signer details",
  edit: "Edit",
  signature: "Signature",
  signatureHint: "Draw your signature with your finger or the mouse.",
  clearSignature: "Clear signature",
  signatureLegal:
    "By signing, you accept the terms of the non-disclosure agreement shown above. Your IP address and signing timestamp will be recorded as proof of acceptance.",
  signCta: "Sign agreement",
  signing: "Signing...",
  errorAllRequired: "All fields are required",
  errorAcceptTerms: "You must confirm you've read the terms of the agreement",
  errorMustSign: "You must sign in the box",
  errorSignFailed: "Error signing",
} as const;

function LeadContractText({ data }: { data: NdaSignerData | null }) {
  return (
    <article className="space-y-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-900 dark:text-white">
          Reunidos
        </h3>
        <p className="mb-2">{REUNIDOS_EMPRESA}</p>
        <p>{reunidosReceptor(data)}</p>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-900 dark:text-white">
          Exponen
        </h3>
        <p>{EXPONEN_TEXT}</p>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-900 dark:text-white">
          Acuerdan
        </h3>
        <ol className="space-y-3">
          {NDA_CLAUSES.map(([title, body], i) => (
            <li key={i}>
              <span className="font-semibold text-zinc-900 dark:text-white">
                {i + 1}. {title}
              </span>{" "}
              {body}
            </li>
          ))}
        </ol>
      </section>

      <p className="pt-2 italic text-zinc-500 dark:text-zinc-400">{CLOSING_TEXT}</p>
    </article>
  );
}

function StudioContractText({
  data,
  projectDescription,
}: {
  data: StudioNdaSigner | null;
  projectDescription: string | null | undefined;
}) {
  return (
    <article className="space-y-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-900 dark:text-white">
          Parties
        </h3>
        <p className="mb-2">{buildPrototipaloIntro()}</p>
        <p className="mb-2 italic text-zinc-500">and</p>
        <p className="mb-2">{buildCounterpartyIntro(data)}</p>
        <p>{PARTIES_INTRO_PARAGRAPH}</p>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-900 dark:text-white">
          Recitals
        </h3>
        <p className="mb-2"><span className="font-medium">I.</span> {buildRecitalI(projectDescription)}</p>
        <p className="mb-2"><span className="font-medium">II.</span> {RECITAL_II}</p>
        <p><span className="font-medium">III.</span> {RECITAL_III}</p>
      </section>

      <p className="font-semibold text-zinc-900 dark:text-white">{NOW_THEREFORE}</p>

      <section className="space-y-4">
        {STUDIO_NDA_CLAUSES.map((c) => (
          <div key={c.number}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-900 dark:text-white">
              {c.number}. {c.title}
            </h3>
            {c.subsections?.map((s) => (
              <p key={s.number} className="mb-2">
                <span className="font-medium">{s.number}</span> {s.text}
              </p>
            ))}
            {c.body && !c.subsections && <p className="mb-2">{c.body}</p>}
            {c.letteredItems && (
              <ul className="ml-4 space-y-1">
                {c.letteredItems.map((item) => (
                  <li key={item.letter}>
                    <span className="font-medium">({item.letter})</span> {item.text}
                  </li>
                ))}
              </ul>
            )}
            {c.body && c.subsections && <p className="mt-2">{c.body}</p>}
          </div>
        ))}
      </section>

      <p className="pt-2 italic text-zinc-500 dark:text-zinc-400">{CLOSING_PARAGRAPH}</p>
    </article>
  );
}

export default function NdaForm({ token, kind = "lead", projectDescription = null }: NdaFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"data" | "sign">("data");

  const isStudio = kind === "studio";
  const t = isStudio ? STUDIO_LABELS : LEAD_LABELS;

  // Form data
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [nif, setNif] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

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
      setError(t.errorAllRequired);
      return;
    }
    if (!acceptedTerms) {
      setError(t.errorAcceptTerms);
      return;
    }
    setError(null);
    setStep("sign");
  };

  const handleSign = () => {
    if (!hasSigned) {
      setError(t.errorMustSign);
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
        signer_position: position.trim() || undefined,
        signature_data: signatureData,
      });

      if (!result.success) {
        setError(result.error || t.errorSignFailed);
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
        {/* Contrato completo */}
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t.agreementSection}
            </h2>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {t.readingTime}
            </span>
          </div>
          {isStudio ? (
            <StudioContractText data={null} projectDescription={projectDescription} />
          ) : (
            <LeadContractText data={null} />
          )}
          <p className="mt-6 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
            {t.preview_hint}
          </p>
        </div>

        {/* Data form */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t.yourData}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t.fullName} *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.fullNamePlaceholder}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t.company}
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder={t.companyPlaceholder}
                className={inputClass}
              />
            </div>

            {isStudio && (
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {t.position}
                </label>
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder={t.positionPlaceholder}
                  className={inputClass}
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t.taxId} *
              </label>
              <input
                type="text"
                value={nif}
                onChange={(e) => setNif(e.target.value)}
                placeholder={t.taxIdPlaceholder}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t.address} *
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t.addressPlaceholder}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t.email} *
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
                {t.emailHint}
              </p>
            </div>
          </div>

          <label className="mt-6 flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 p-3 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800"
            />
            <span>{t.acceptCheckbox}</span>
          </label>

          {error && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            className="mt-6 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            {t.continueToSign}
          </button>
        </div>
      </form>
    );
  }

  // Step 2: Signature
  const finalSignerData = {
    signerName: name.trim(),
    signerCompany: company.trim(),
    signerNif: nif.trim(),
    signerAddress: address.trim(),
    signerPosition: position.trim(),
  };
  return (
    <div>
      {/* Contrato definitivo con sus datos */}
      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {t.finalAgreement}
        </h2>
        {isStudio ? (
          <StudioContractText data={finalSignerData} projectDescription={projectDescription} />
        ) : (
          <LeadContractText data={finalSignerData as NdaSignerData} />
        )}
      </div>

      {/* Summary */}
      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t.signerData}
          </h2>
          <button
            type="button"
            onClick={() => setStep("data")}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            {t.edit}
          </button>
        </div>
        <div className="mt-3 grid gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <p><span className="font-medium text-zinc-900 dark:text-white">{name}</span></p>
          {company && <p>{company}</p>}
          {isStudio && position && <p>{position}</p>}
          <p>{t.taxId}: {nif}</p>
          <p>{address}</p>
          <p>{email}</p>
        </div>
      </div>

      {/* Signature canvas */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t.signature}
          </h2>
          {hasSigned && (
            <button
              type="button"
              onClick={clearSignature}
              className="text-sm text-red-600 hover:underline dark:text-red-400"
            >
              {t.clearSignature}
            </button>
          )}
        </div>
        <p className="mb-3 text-xs text-zinc-400 dark:text-zinc-500">
          {t.signatureHint}
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
            {t.signatureLegal}
          </p>
          <button
            type="button"
            onClick={handleSign}
            disabled={isPending || !hasSigned}
            className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? t.signing : t.signCta}
          </button>
        </div>
      </div>
    </div>
  );
}
