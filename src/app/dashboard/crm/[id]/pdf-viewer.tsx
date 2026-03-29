"use client";

import { useState } from "react";
import { getLeadDocumentPdf } from "../actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

const DOC_LABELS = {
  estimate: "Presupuesto",
  proform: "Proforma",
  invoice: "Factura",
} as const;

export function PdfPreviewButton({
  leadId,
  docType,
  variant = "secondary",
  size = "sm",
  className,
}: {
  leadId: string;
  docType: "estimate" | "proform" | "invoice";
  variant?: "default" | "secondary" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const label = DOC_LABELS[docType];

  const handleOpen = async () => {
    if (pdfUrl) {
      setOpen(true);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await getLeadDocumentPdf(leadId, docType);
    setLoading(false);
    if (result.success && result.base64) {
      const url = `data:application/pdf;base64,${result.base64}`;
      setPdfUrl(url);
      setOpen(true);
    } else {
      setError(result.error || "Error al cargar el PDF");
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleOpen}
        disabled={loading}
        className={className}
      >
        {loading ? (
          <>
            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Cargando...
          </>
        ) : (
          <>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Ver {label}
          </>
        )}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[90vh] max-w-[90vw] w-[900px] flex-col gap-0 p-0 overflow-hidden">
          <div className="flex shrink-0 items-center justify-between border-b px-5 py-3">
            <DialogTitle className="text-base font-semibold">{label}</DialogTitle>
          </div>
          {pdfUrl && (
            <iframe
              src={pdfUrl}
              className="min-h-0 flex-1 border-0"
              title={label}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
