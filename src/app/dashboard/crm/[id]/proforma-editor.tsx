"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
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

// Cada línea lleva un id estable solo-cliente (_uid) para keys de React y para
// el drag-to-reorder. Se quita antes de guardar (cleanLines) para no ensuciar
// el JSON que persiste en quote_requests.items.
type EditorLine = ProformaLineItem & { _uid: string };

// Contador determinista: el inicializador de useState corre en server (SSR) y
// luego en cliente (hidratación); empezar siempre en 0 garantiza los mismos
// ids en ambos (las keys no salen al DOM, pero así evitamos cualquier desfase).
let uidCounter = 0;
const nextUid = () => `line-${uidCounter++}`;

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function emptyLine(): EditorLine {
  return { _uid: nextUid(), concept: "", price: 0, units: 1, tax: 21 };
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
  holdedEstimateId?: string | null;
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
  holdedEstimateId,
  projectTypeTag,
  estimatedQuantity,
  estimatedComplexity,
  estimatedUrgency,
  estimatedExactQuantity,
  basePrices,
}: ProformaEditorProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const initialLines = (): EditorLine[] => {
    if (existingItems && existingItems.length > 0) {
      return existingItems.map((it) => ({ ...it, _uid: nextUid() }));
    }
    if (estimatedQuantity && estimatedComplexity && estimatedUrgency) {
      return [{
        ...estimatedLine(
          projectTypeTag ?? null,
          estimatedQuantity as EstimatedQuantity,
          estimatedComplexity as EstimatedComplexity,
          estimatedUrgency as EstimatedUrgency,
          estimatedExactQuantity ?? null,
          basePrices,
        ),
        _uid: nextUid(),
      }];
    }
    return [emptyLine()];
  };

  const [lines, setLines] = useState<EditorLine[]>(initialLines);
  const [notes, setNotes] = useState(existingNotes || "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(!!existingItems && existingItems.length > 0);
  const [sent, setSent] = useState(quoteStatus === "quote_sent");
  const [estimateId, setEstimateId] = useState<string | null>(holdedEstimateId || null);

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

  const handleReorder = (event: {
    operation: {
      source: { id: string | number } | null;
      target: { id: string | number } | null;
    };
  }) => {
    const { source, target } = event.operation;
    if (!source || !target || source.id === target.id) return;
    setLines((prev) => {
      const from = prev.findIndex((l) => l._uid === source.id);
      const to = prev.findIndex((l) => l._uid === target.id);
      if (from === -1 || to === -1) return prev;
      return arrayMove(prev, from, to);
    });
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

  // Líneas válidas, sin el _uid solo-cliente (se persiste como JSON).
  const cleanLines = (): ProformaLineItem[] =>
    lines
      .filter((l) => l.concept.trim() && l.price > 0)
      .map(({ concept, price, units, tax }) => ({ concept, price, units, tax }));

  const handleSave = () => {
    setError(null);
    const validLines = cleanLines();
    if (validLines.length === 0) {
      setError("Anade al menos una linea con concepto y precio");
      return;
    }
    startTransition(async () => {
      const result = await saveQuoteItems(leadId, validLines, notes || undefined);
      if (result.success) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.error || "Error al guardar");
      }
    });
  };

  const handleSend = () => {
    setError(null);
    startTransition(async () => {
      if (!saved) {
        const validLines = cleanLines();
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
        if (result.holdedEstimateId) setEstimateId(result.holdedEstimateId);
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
          <div className="mt-3 flex items-center gap-3">
            {estimateId && (
              <a
                href={`https://app.holded.com/documents/estimate/${estimateId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-brand hover:text-brand-dark hover:underline"
              >
                Ver en Holded &rarr;
              </a>
            )}
            <Button
              variant="link"
              onClick={() => setSent(false)}
              className="px-0 text-brand hover:text-brand-dark"
            >
              Editar presupuesto
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <h2 className="mb-4 text-sm font-semibold text-card-foreground">Presupuesto</h2>

        {/* Lines — arrastrables por el icono de la izquierda para reordenar */}
        <DragDropProvider onDragEnd={handleReorder}>
          <div className="space-y-3">
            {lines.map((line, i) => (
              <SortableLineRow
                key={line._uid}
                line={line}
                index={i}
                isFirst={i === 0}
                canRemove={lines.length > 1}
                selectClass={selectClass}
                onUpdate={updateLine}
                onRemove={removeLine}
              />
            ))}
          </div>
        </DragDropProvider>

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

interface SortableLineRowProps {
  line: EditorLine;
  index: number;
  isFirst: boolean;
  canRemove: boolean;
  selectClass: string;
  onUpdate: (index: number, field: keyof ProformaLineItem, value: string | number) => void;
  onRemove: (index: number) => void;
}

function SortableLineRow({
  line,
  index,
  isFirst,
  canRemove,
  selectClass,
  onUpdate,
  onRemove,
}: SortableLineRowProps) {
  const { ref, handleRef, isDragging } = useSortable({ id: line._uid, index });

  return (
    <div
      ref={ref}
      className={`grid grid-cols-[20px_1fr_80px_60px_80px_32px] gap-2 items-end ${
        isDragging ? "relative z-10 opacity-80" : ""
      }`}
    >
      <button
        ref={handleRef}
        type="button"
        aria-label="Arrastrar para reordenar"
        title="Arrastrar para reordenar"
        className="flex h-9 w-5 cursor-grab touch-none items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm9-12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
        </svg>
      </button>
      <div>
        {isFirst && (
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Concepto</label>
        )}
        <Input
          type="text"
          value={line.concept}
          onChange={(e) => onUpdate(index, "concept", e.target.value)}
          placeholder="Descripcion"
        />
      </div>
      <div>
        {isFirst && (
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Precio</label>
        )}
        <Input
          type="number"
          step="0.01"
          min="0"
          value={line.price || ""}
          onChange={(e) => onUpdate(index, "price", parseFloat(e.target.value) || 0)}
          placeholder="0.00"
        />
      </div>
      <div>
        {isFirst && (
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Uds</label>
        )}
        <Input
          type="number"
          min="1"
          value={line.units}
          onChange={(e) => onUpdate(index, "units", parseInt(e.target.value) || 1)}
        />
      </div>
      <div>
        {isFirst && (
          <label className="mb-1 block text-xs font-medium text-muted-foreground">IVA</label>
        )}
        <select
          value={line.tax}
          onChange={(e) => onUpdate(index, "tax", parseInt(e.target.value))}
          className={selectClass}
        >
          {TAX_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div>
        {canRemove && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onRemove(index)}
            className="text-muted-foreground hover:text-destructive"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        )}
      </div>
    </div>
  );
}
