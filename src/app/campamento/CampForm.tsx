"use client";

import { useState, useTransition } from "react";

type Status = "idle" | "error" | "full";

export function CampForm({ soldOut }: { soldOut: boolean }) {
  const [payerName, setPayerName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  const [childName, setChildName] = useState("");
  const [extendedHours, setExtendedHours] = useState(false);
  const [company, setCompany] = useState(""); // honeypot
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;

    startTransition(async () => {
      try {
        const res = await fetch("/api/campamento", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            payerName,
            payerEmail,
            payerPhone,
            childName,
            extendedHours,
            company,
          }),
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data?.url) {
          // Redirigimos al pago de la señal en Stripe.
          window.location.href = data.url as string;
          return;
        }

        if (res.status === 409 || data?.error === "full") {
          setStatus("full");
          return;
        }

        setStatus("error");
        setMessage(
          {
            invalid_name: "Revisa el nombre del responsable.",
            invalid_email: "Ese correo no parece válido.",
            invalid_phone: "Ese teléfono no parece válido.",
            invalid_child: "Revisa el nombre del niño/a.",
          }[data?.error as string] ?? "No hemos podido procesarlo. Inténtalo otra vez.",
        );
      } catch {
        setStatus("error");
        setMessage("No hemos podido procesarlo. Inténtalo otra vez.");
      }
    });
  }

  if (soldOut || status === "full") {
    return (
      <div className="rounded-xl border border-white/15 bg-white/[0.04] p-5 text-sm">
        <div className="font-semibold text-white">Plazas agotadas</div>
        <p className="mt-1 text-white/70">
          Las plazas están completas. Escríbenos a{" "}
          <a className="text-[#fdc52c] underline" href="mailto:hola@prototipalo.com">
            hola@prototipalo.com
          </a>{" "}
          y te avisamos si se libera alguna o abrimos otra semana.
        </p>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-lg border border-white/15 bg-neutral-900/80 px-4 py-3 text-base text-white placeholder:text-white/40 outline-none focus:border-[#009edc] focus:ring-2 focus:ring-[#009edc]/40";

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <input
        type="text"
        name="company"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-white/70">Tu nombre</span>
          <input
            type="text"
            name="payerName"
            autoComplete="name"
            required
            placeholder="Nombre y apellidos"
            value={payerName}
            onChange={(e) => setPayerName(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-white/70">Nombre del niño/a</span>
          <input
            type="text"
            name="childName"
            required
            placeholder="Nombre del participante"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-white/70">Correo</span>
          <input
            type="email"
            name="payerEmail"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="tu@correo.com"
            value={payerEmail}
            onChange={(e) => setPayerEmail(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-white/70">Teléfono</span>
          <input
            type="tel"
            name="payerPhone"
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder="600 000 000"
            value={payerPhone}
            onChange={(e) => setPayerPhone(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3.5">
        <input
          type="checkbox"
          checked={extendedHours}
          onChange={(e) => setExtendedHours(e.target.checked)}
          className="mt-0.5 size-4 accent-[#fdc52c]"
        />
        <span className="text-sm text-white/80">
          Me interesa la <strong className="text-white">hora extra hasta las 15:00</strong>{" "}
          <span className="text-white/50">(gratuita)</span>
        </span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-lg bg-[#fdc52c] px-5 py-3.5 text-base font-semibold text-neutral-900 transition hover:bg-[#ffd24d] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Redirigiendo al pago…" : "Reservar plaza · señal 50 €"}
      </button>

      <p className="text-center text-xs text-white/45">
        Pagas 50 € ahora para reservar la plaza. Los 250 € restantes, en efectivo
        el primer día.
      </p>

      {status === "error" && (
        <p className="text-center text-xs text-red-300">{message}</p>
      )}
    </form>
  );
}
