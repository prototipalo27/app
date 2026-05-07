"use client";

import { useState, useTransition } from "react";

type Status = "idle" | "ok" | "error";

export function LeadForm({ source }: { source: string | null }) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || status === "ok") return;

    startTransition(async () => {
      try {
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, company, source }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setStatus("error");
          setMessage(
            data?.error === "invalid_email"
              ? "Ese correo no parece válido."
              : "No hemos podido guardarlo. Inténtalo otra vez."
          );
          return;
        }
        setStatus("ok");
        setMessage("");
      } catch {
        setStatus("error");
        setMessage("No hemos podido guardarlo. Inténtalo otra vez.");
      }
    });
  }

  if (status === "ok") {
    return (
      <div className="rounded-xl border border-[#fdc52c]/40 bg-[#fdc52c]/10 p-4 text-sm">
        <div className="font-semibold text-[#fdc52c]">¡Apuntado!</div>
        <p className="mt-1 text-white/80">
          Mira el correo en los próximos minutos. Te llegan las instrucciones
          para tu diseño 3D de regalo.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
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

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="tu@correo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded-lg border border-white/15 bg-neutral-900/80 px-4 py-3 text-base text-white placeholder:text-white/40 outline-none focus:border-[#009edc] focus:ring-2 focus:ring-[#009edc]/40"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[#fdc52c] px-5 py-3 text-base font-semibold text-neutral-900 transition hover:bg-[#ffd24d] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Enviando…" : "Quiero entrar"}
        </button>
      </div>

      {status === "error" && (
        <p className="mt-2 text-xs text-red-300">{message}</p>
      )}
    </form>
  );
}
