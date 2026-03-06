"use client";

import { useState, useTransition } from "react";
import {
  saveQuoteItems,
  sendQuoteToClient,
  type ProformaLineItem,
} from "../actions";
import {
  QUANTITY_RANGES,
  COMPLEXITY_OPTIONS,
  URGENCY_OPTIONS,
  type EstimatedQuantity,
  type EstimatedComplexity,
  type EstimatedUrgency,
} from "@/lib/crm-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TAX_OPTIONS = [
  { value: 0, label: "0%" },
  { value: 4, label: "4%" },
  { value: 10, label: "10%" },
  { value: 21, label: "21%" },
];

function emptyLine(): ProformaLineItem {
  return { concept: "", price: 0, units: 1, tax: 21 };
}

const DEFAULT_BASE_PRICE = 40;

function estimatedLine(
  projectTypeTag: string | null,
  quantity: EstimatedQuantity,
  complexity: EstimatedComplexity,
  urgency: EstimatedUrgency,
  exactQuantity: number | null,
  basePrices: Record<string, number>,
): ProformaLineItem {
  const basePrice = basePrices[projectTypeTag || ""] ?? DEFAULT_BASE_PRICE;
  const complexityFactor = COMPLEXITY_OPTIONS.find((o) => o.value === complexity)?.factor ?? 1;
  const urgencyFactor = URGENCY_OPTIONS.find((o) => o.value === urgency)?.factor ?? 1;
  const midpoint = QUANTITY_RANGES.find((r) => r.value === quantity)?.midpoint ?? 1;

  return {
    concept: projectTypeTag || "Impresion 3D",
    price: Math.round(basePrice * complexityFactor * urgencyFactor * 100) / 100,
    units: exactQuantity && exactQuantity > 0 ? exactQuantity : midpoint,
    tax: 21,
  };
}

interface ProformaEditorProps {
  leadId: string;
  existingItems: ProformaLineItem[] | null;
  existingNotes: string | null;
  quoteStatus: string | null;
  projectTypeTag?: string | null;
  estimatedQuantity?: string | null;
  estimatedComplexity?: string | null;
  estimatedUrgency?: string | null;
  estimatedExactQuantity?: number | null;
  basePrices: Record<string, number>;
}

export default function ProformaEditor({
  leadId,
  existingItems,
  existingNotes,
  quoteStatus,
  projectTypeTag,
  estimatedQuantity,
  estimatedComplexity,
  estimatedUrgency,
  estimatedExactQuantity,
  basePrices,
}: ProformaEditorProps) {
  const [isPending, startTransition] = useTransition();

  const initialLines = (): ProformaLineItem[] => {
    if (existingItems && existingItems.length > 0) return existingItems;
    if (estimatedQuantity && estimatedComplexity && estimatedUrgency) {
      return [estimatedLine(
        projectTypeTag ?? null,
        estimatedQuantity as EstimatedQuantity,
        estimatedComplexity as EstimatedComplexity,
        estimatedUrgency as EstimatedUrgency,
        estimatedExactQuantity ?? null,
        basePrices,
      )];
    }
    return [emptyLine()];
  };

  const [lines, setLines] = useState<ProformaLineItem[]>(initialLines);
  const [notes, setNotes] = useState(existingNotes || "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(!!existingItems && existingItems.length > 0);
  const [sent, setSent] = useState(quoteStatus === "quote_sent");

  const selectClass =
    "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

  const updateLine = (index: number, field: keyof ProformaLineItem, value: string | number) => {
    setLines((prev) =>
      prev.map((line, i) =>
        i === index ? { ...line, [field]: value } : line,
      ),
    );
    setSaved(false);
  };

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine()]);
    setSaved(false);
  };
  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  };

  const subtotal = lines.reduce((sum, l) => sum + l.price * l.units, 0);
  const taxBreakdown = lines.reduce<Record<number, number>>((acc, l) => {
    const taxAmount = l.price * l.units * (l.tax / 100);
    acc[l.tax] = (acc[l.tax] || 0) + taxAmount;
    return acc;
  }, {});
  const totalTax = Object.values(taxBreakdown).reduce((s, v) => s + v, 0);
  const total = subtotal + totalTax;

  const handleSave = () => {
    setError(null);
    const validLines = lines.filter((l) => l.concept.trim() && l.price > 0);
    if (validLines.length === 0) {
      setError("Anade al menos una linea con concepto y precio");
      return;
    }
    startTransition(async () => {
      const result = await saveQuoteItems(leadId, validLines, notes || undefined);
      if (result.success) {
        setSaved(true);
      } else {
        setError(result.error || "Error al guardar");
      }
    });
  };

  const handleSend = () => {
    setError(null);
    startTransition(async () => {
      if (!saved) {
        const validLines = lines.filter((l) => l.concept.trim() && l.price > 0);
        if (validLines.length === 0) {
          setError("Anade al menos una linea con concepto y precio");
          return;
        }
        const saveResult = await saveQuoteItems(leadId, validLines, notes || undefined);
        if (!saveResult.success) {
          setError(saveResult.error || "Error al guardar");
          return;
        }
        setSaved(true);
      }

      const result = await sendQuoteToClient(leadId);
      if (result.success) {
        setSent(true);
      } else {
        setError(result.error || "Error al enviar el presupuesto");
      }
    });
  };

  if (sent) {
    return (
      <Card>
        <CardContent>
          <h2 className="mb-3 text-sm font-semibold text-card-foreground">Presupuesto</h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Enviado
            </Badge>
            <span className="text-xs text-muted-foreground">
              Presupuesto enviado por email al cliente
            </span>
          </div>
          <Button
            variant="link"
            onClick={() => setSent(false)}
            className="mt-3 px-0 text-brand hover:text-brand-dark"
          >
            Editar presupuesto
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <h2 className="mb-4 text-sm font-semibold text-card-foreground">Presupuesto</h2>

        {/* Lines */}
        <div className="space-y-3">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_60px_80px_32px] gap-2 items-end">
              <div>
                {i === 0 && (
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Concepto</label>
                )}
                <Input
                  type="text"
                  value={line.concept}
                  onChange={(e) => updateLine(i, "concept", e.target.value)}
                  placeholder="Descripcion"
                />
              </div>
              <div>
                {i === 0 && (
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Precio</label>
                )}
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={line.price || ""}
                  onChange={(e) => updateLine(i, "price", parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
              <div>
                {i === 0 && (
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Uds</label>
                )}
                <Input
                  type="number"
                  min="1"
                  value={line.units}
                  onChange={(e) => updateLine(i, "units", parseInt(e.target.value) || 1)}
                />
              </div>
              <div>
                {i === 0 && (
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">IVA</label>
                )}
                <select
                  value={line.tax}
                  onChange={(e) => updateLine(i, "tax", parseInt(e.target.value))}
                  className={selectClass}
                >
                  {TAX_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                {lines.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeLine(i)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <Button
          variant="link"
          onClick={addLine}
          className="mt-3 px-0 text-brand hover:text-brand-dark"
        >
          + Anadir linea
        </Button>

        {/* Notes */}
        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Notas</label>
          <Textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
            rows={2}
            placeholder="Notas adicionales (opcional)"
          />
        </div>

        {/* Totals */}
        <div className="mt-4 rounded-lg bg-muted p-3">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span>{subtotal.toFixed(2)} €</span>
          </div>
          {Object.entries(taxBreakdown)
            .filter(([, amount]) => amount > 0)
            .map(([rate, amount]) => (
              <div key={rate} className="flex justify-between text-sm text-muted-foreground">
                <span>IVA {rate}%</span>
                <span>{amount.toFixed(2)} €</span>
              </div>
            ))}
          <div className="mt-1 flex justify-between border-t pt-1 text-sm font-semibold text-foreground">
            <span>Total</span>
            <span>{total.toFixed(2)} €</span>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <div className="mt-4 flex gap-3">
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? "Guardando..." : saved ? "Guardado" : "Guardar presupuesto"}
          </Button>
          <Button
            onClick={handleSend}
            disabled={isPending}
            className="flex-1 bg-brand text-white hover:bg-brand-dark"
          >
            {isPending ? "Enviando..." : "Enviar presupuesto al cliente"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
