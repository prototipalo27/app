"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getRecurringClients, createRepeatOrder, type RecurringClient, type ClientProduct } from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SelectedProduct = ClientProduct & { selected: boolean; units: number };

export function NewOrderModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [clients, setClients] = useState<RecurringClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<RecurringClient | null>(null);
  const [products, setProducts] = useState<SelectedProduct[]>([]);
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      getRecurringClients().then((c) => {
        setClients(c);
        setLoading(false);
      });
    } else {
      setSelectedClient(null);
      setProducts([]);
      setMessage("");
      setSearch("");
    }
  }, [open]);

  const filtered = clients.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [c.fullName, c.company, c.email, c.taxId].filter(Boolean).join(" ").toLowerCase().includes(q);
  });

  const selectClient = (client: RecurringClient) => {
    setSelectedClient(client);
    setProducts(
      client.products.map((p) => ({ ...p, selected: false, units: p.lastUnits }))
    );
  };

  const toggleProduct = (idx: number) => {
    setProducts((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, selected: !p.selected } : p))
    );
  };

  const updateUnits = (idx: number, units: number) => {
    setProducts((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, units: Math.max(1, units) } : p))
    );
  };

  const selectedItems = products.filter((p) => p.selected);
  const total = selectedItems.reduce((s, p) => s + p.price * p.units, 0);

  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!selectedClient) return;
    setCreating(true);
    setCreateError(null);
    const items = selectedItems.map((p) => ({
      concept: p.concept,
      price: p.price,
      units: p.units,
      tax: p.tax,
    }));
    try {
      const result = await createRepeatOrder(
        selectedClient.id,
        {
          fullName: selectedClient.fullName,
          company: selectedClient.company,
          email: selectedClient.email,
          phone: selectedClient.phone,
          holdedContactId: selectedClient.holdedContactId,
        },
        items,
        message,
      );
      setCreating(false);
      if (result.success && result.leadId) {
        onClose();
        router.push(`/dashboard/crm/${result.leadId}`);
      } else {
        setCreateError(result.error || "Error al crear el pedido");
      }
    } catch (e) {
      setCreating(false);
      setCreateError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const sourceBadge = (source: RecurringClient["source"]) => {
    if (source === "both") return <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-[10px]">CRM + Holded</Badge>;
    if (source === "holded") return <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px]">Holded</Badge>;
    return <Badge variant="secondary" className="text-[10px]">CRM</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nuevo pedido · Cliente existente</DialogTitle>
        </DialogHeader>

        {!selectedClient ? (
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, empresa, email o NIF..."
              autoFocus
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />

            <div className="max-h-80 space-y-1 overflow-y-auto">
              {loading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Cargando clientes...</p>
              ) : filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {search ? "Sin resultados" : "No hay clientes"}
                </p>
              ) : (
                filtered.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => selectClient(client)}
                    className="flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-foreground">{client.fullName}</p>
                        {sourceBadge(client.source)}
                      </div>
                      {client.company && <p className="text-xs text-muted-foreground">{client.company}</p>}
                      {client.email && <p className="text-[11px] text-muted-foreground/70">{client.email}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {client.products.length > 0 && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          {client.products.length} producto{client.products.length !== 1 && "s"}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <button
              onClick={() => { setSelectedClient(null); setProducts([]); }}
              className="self-start text-xs text-muted-foreground hover:text-foreground"
            >
              &larr; Cambiar cliente
            </button>

            <div className="rounded-lg border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium">{selectedClient.fullName}</p>
                {sourceBadge(selectedClient.source)}
              </div>
              {selectedClient.company && <p className="text-xs text-muted-foreground">{selectedClient.company}</p>}
              <div className="mt-0.5 flex gap-3 text-[11px] text-muted-foreground/70">
                {selectedClient.email && <span>{selectedClient.email}</span>}
                {selectedClient.taxId && <span>NIF: {selectedClient.taxId}</span>}
              </div>
            </div>

            {products.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Productos anteriores — selecciona y ajusta unidades
                </p>
                <div className="max-h-52 space-y-1.5 overflow-y-auto">
                  {products.map((prod, idx) => (
                    <div
                      key={idx}
                      onClick={() => toggleProduct(idx)}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                        prod.selected
                          ? "border-brand bg-brand/5 ring-1 ring-brand/30"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={prod.selected}
                        onChange={() => toggleProduct(idx)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 shrink-0 rounded border-gray-300 accent-brand"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground">{prod.concept}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {prod.price.toLocaleString("es-ES", { minimumFractionDigits: 2 })} € / ud · IVA {prod.tax}%
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => updateUnits(idx, prod.units - 1)}
                          className="flex h-6 w-6 items-center justify-center rounded border text-xs hover:bg-muted"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={prod.units}
                          onChange={(e) => updateUnits(idx, parseInt(e.target.value) || 1)}
                          className="h-6 w-14 rounded border bg-background px-1 text-center text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <button
                          onClick={() => updateUnits(idx, prod.units + 1)}
                          className="flex h-6 w-6 items-center justify-center rounded border text-xs hover:bg-muted"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {selectedItems.length > 0 && (
                  <div className="mt-2 flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-sm">
                    <span className="text-muted-foreground">{selectedItems.length} producto{selectedItems.length !== 1 && "s"}</span>
                    <span className="font-semibold tabular-nums">{total.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No hay productos de facturas anteriores
              </p>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Descripcion del pedido (opcional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ej: Mismo pedido que la vez anterior, pero 200 unidades..."
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <Button
              onClick={handleCreate}
              disabled={creating}
              className="bg-brand text-white hover:bg-brand-dark"
            >
              {creating ? "Creando..." : selectedItems.length > 0
                ? `Crear pedido (${selectedItems.length} producto${selectedItems.length !== 1 ? "s" : ""})`
                : "Crear pedido sin productos"}
            </Button>
            {createError && (
              <p className="text-xs text-red-500">{createError}</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
