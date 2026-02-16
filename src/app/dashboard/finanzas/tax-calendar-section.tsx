"use client";

import { useState } from "react";
import { updateTaxPayment, ensureTaxCalendar } from "./actions";
import { getModelName } from "@/lib/finance/tax-calendar";

interface TaxPayment {
  id: string;
  model: string;
  period: string;
  amount: number | null;
  status: string;
  due_date: string;
  paid_date: string | null;
  notes: string | null;
}

function formatEur(n: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

export default function TaxCalendarSection({
  taxPayments: initialPayments,
}: {
  taxPayments: TaxPayment[];
}) {
  const [payments, setPayments] = useState(initialPayments);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const now = new Date();
  const currentYear = now.getFullYear();

  // Group by year
  const years = [...new Set(payments.map((p) => {
    const match = p.period.match(/^(\d{4})/);
    return match ? parseInt(match[1]) : currentYear;
  }))].sort((a, b) => b - a);

  const handleMarkPaid = async (id: string) => {
    setLoading(true);
    const result = await updateTaxPayment(id, {
      status: "paid",
      amount: payAmount ? parseFloat(payAmount) : undefined,
      paid_date: new Date().toISOString().split("T")[0],
    });
    if (result.success) {
      setPayments((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, status: "paid", amount: payAmount ? parseFloat(payAmount) : p.amount, paid_date: new Date().toISOString().split("T")[0] }
            : p
        )
      );
    }
    setPayingId(null);
    setPayAmount("");
    setLoading(false);
  };

  const handleEnsureYear = async (year: number) => {
    setLoading(true);
    await ensureTaxCalendar(year);
    setLoading(false);
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Calendario fiscal</h2>
        <button
          onClick={() => handleEnsureYear(currentYear + 1)}
          disabled={loading}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Generar {currentYear + 1}
        </button>
      </div>

      {years.map((year) => {
        const yearPayments = payments
          .filter((p) => p.period.startsWith(String(year)))
          .sort((a, b) => a.due_date.localeCompare(b.due_date));

        if (yearPayments.length === 0) return null;

        // Group by quarter
        const quarters = ["Q1", "Q2", "Q3", "Q4"];

        return (
          <div key={year} className="mb-6 last:mb-0">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">{year}</h3>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {quarters.map((q) => {
                const qPayments = yearPayments.filter((p) => p.period.includes(q));
                // Also include annual (200) in Q3 (July deadline)
                const annualPayment = yearPayments.find((p) => p.period === String(year) && p.model === "200");

                const allInQ = q === "Q3" && annualPayment
                  ? [...qPayments, annualPayment]
                  : qPayments;

                if (allInQ.length === 0) return <div key={q} />;

                return (
                  <div key={q} className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                    <p className="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">{q}</p>
                    <div className="space-y-2">
                      {allInQ.map((p) => {
                        const dueDate = new Date(p.due_date);
                        const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                        const isPast = daysLeft < 0;

                        return (
                          <div key={p.id} className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium text-zinc-900 dark:text-white">
                                Mod. {p.model}
                              </p>
                              <p className="text-[10px] text-zinc-400">
                                {dueDate.toLocaleDateString("es-ES")}
                              </p>
                            </div>
                            {p.status === "paid" ? (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                {p.amount != null ? formatEur(p.amount) : "Pagado"}
                              </span>
                            ) : payingId === p.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="Importe"
                                  value={payAmount}
                                  onChange={(e) => setPayAmount(e.target.value)}
                                  className="w-20 rounded border border-zinc-300 px-1.5 py-0.5 text-[10px] dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleMarkPaid(p.id)}
                                  disabled={loading}
                                  className="rounded bg-green-600 px-1.5 py-0.5 text-[10px] text-white hover:bg-green-700"
                                >
                                  OK
                                </button>
                                <button
                                  onClick={() => { setPayingId(null); setPayAmount(""); }}
                                  className="text-[10px] text-zinc-400 hover:text-zinc-600"
                                >
                                  X
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setPayingId(p.id)}
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  isPast
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                    : daysLeft <= 30
                                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                                }`}
                              >
                                Pendiente
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
