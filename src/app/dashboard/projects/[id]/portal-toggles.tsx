"use client";

import { useState, useTransition } from "react";
import { togglePortalVisibility, revokeApproval } from "../actions";

interface PortalTogglesProps {
  projectId: string;
  designVisible: boolean;
  designApprovedAt: string | null;
  deliverableVisible: boolean;
  deliverableApprovedAt: string | null;
  paymentConfirmedAt: string | null;
}

export default function PortalToggles({
  projectId,
  designVisible: initialDesignVisible,
  designApprovedAt: initialDesignApprovedAt,
  deliverableVisible: initialDeliverableVisible,
  deliverableApprovedAt: initialDeliverableApprovedAt,
  paymentConfirmedAt: initialPaymentConfirmedAt,
}: PortalTogglesProps) {
  const [designVisible, setDesignVisible] = useState(initialDesignVisible);
  const [deliverableVisible, setDeliverableVisible] = useState(initialDeliverableVisible);
  const [designApprovedAt, setDesignApprovedAt] = useState(initialDesignApprovedAt);
  const [deliverableApprovedAt, setDeliverableApprovedAt] = useState(initialDeliverableApprovedAt);
  const [paymentConfirmedAt, setPaymentConfirmedAt] = useState(initialPaymentConfirmedAt);
  const [isPending, startTransition] = useTransition();

  const handleRevoke = (field: "design_approved_at" | "deliverable_approved_at" | "payment_confirmed_at") => {
    startTransition(async () => {
      const result = await revokeApproval(projectId, field);
      if (result.success) {
        if (field === "design_approved_at") setDesignApprovedAt(null);
        else if (field === "deliverable_approved_at") setDeliverableApprovedAt(null);
        else setPaymentConfirmedAt(null);
      }
    });
  };

  const handleToggle = (field: "design_visible" | "deliverable_visible", value: boolean) => {
    if (field === "design_visible") setDesignVisible(value);
    else setDeliverableVisible(value);

    startTransition(async () => {
      const result = await togglePortalVisibility(projectId, field, value);
      if (!result.success) {
        // Revert on error
        if (field === "design_visible") setDesignVisible(!value);
        else setDeliverableVisible(!value);
      }
    });
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">Portal de cliente</h2>

      <div className="space-y-4">
        {/* Design toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-700 dark:text-zinc-300">Diseño visible</span>
            {designApprovedAt && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Aprobado por cliente
                <button
                  onClick={() => handleRevoke("design_approved_at")}
                  disabled={isPending}
                  className="ml-1 rounded-full p-0.5 text-green-600 hover:bg-green-200 hover:text-green-800 disabled:opacity-50 dark:hover:bg-green-800/50 dark:hover:text-green-300"
                  title="Revocar aprobación"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
          </div>
          <button
            onClick={() => handleToggle("design_visible", !designVisible)}
            disabled={isPending}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-zinc-900 ${
              designVisible ? "bg-brand" : "bg-zinc-200 dark:bg-zinc-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                designVisible ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Deliverable toggle */}
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-zinc-700 dark:text-zinc-300">Entregable visible</span>
            {deliverableApprovedAt && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Aprobado
                <button
                  onClick={() => handleRevoke("deliverable_approved_at")}
                  disabled={isPending}
                  className="ml-1 rounded-full p-0.5 text-green-600 hover:bg-green-200 hover:text-green-800 disabled:opacity-50 dark:hover:bg-green-800/50 dark:hover:text-green-300"
                  title="Revocar aprobación"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {paymentConfirmedAt && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                Pago confirmado
                <button
                  onClick={() => handleRevoke("payment_confirmed_at")}
                  disabled={isPending}
                  className="ml-1 rounded-full p-0.5 text-blue-600 hover:bg-blue-200 hover:text-blue-800 disabled:opacity-50 dark:hover:bg-blue-800/50 dark:hover:text-blue-300"
                  title="Revocar confirmación de pago"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
          </div>
          <button
            onClick={() => handleToggle("deliverable_visible", !deliverableVisible)}
            disabled={isPending}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-zinc-900 ${
              deliverableVisible ? "bg-brand" : "bg-zinc-200 dark:bg-zinc-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                deliverableVisible ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
