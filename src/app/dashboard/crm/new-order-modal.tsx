"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getWonClients, createRepeatOrder, type WonClient } from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function NewOrderModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [clients, setClients] = useState<WonClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<WonClient | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      getWonClients().then((c) => {
        setClients(c);
        setLoading(false);
      });
    } else {
      setSelectedClient(null);
      setSelectedQuoteId(null);
      setMessage("");
      setSearch("");
    }
  }, [open]);

  const filtered = clients.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [c.fullName, c.company, c.email].filter(Boolean).join(" ").toLowerCase().includes(q);
  });

  const handleCreate = async () => {
    if (!selectedClient) return;
    setCreating(true);
    const result = await createRepeatOrder(
      selectedClient.leadId,
      selectedQuoteId,
      message,
    );
    setCreating(false);
    if (result.success && result.leadId) {
      onClose();
      router.push(`/dashboard/crm/${result.leadId}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nuevo pedido · Cliente recurrente</DialogTitle>
        </DialogHeader>

        {!selectedClient ? (
          // Step 1: Select client
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente..."
              autoFocus
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />

            <div className="max-h-80 space-y-1 overflow-y-auto">
              {loading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Cargando clientes...</p>
              ) : filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No hay clientes ganados</p>
              ) : (
                filtered.map((client) => (
                  <button
                    key={client.leadId}
                    onClick={() => {
                      setSelectedClient(client);
                      if (client.quotes.length > 0) {
                        setSelectedQuoteId(client.quotes[0].id);
                      }
                    }}
                    className="flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{client.fullName}</p>
                      {client.company && (
                        <p className="text-xs text-muted-foreground">{client.company}</p>
                      )}
                      {client.email && (
                        <p className="text-[11px] text-muted-foreground/70">{client.email}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {client.quotes.length > 0 && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          {client.quotes.length} {client.quotes.length === 1 ? "presupuesto" : "presupuestos"}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          // Step 2: Pick quote + description
          <div className="flex flex-col gap-4">
            <button
              onClick={() => { setSelectedClient(null); setSelectedQuoteId(null); }}
              className="self-start text-xs text-muted-foreground hover:text-foreground"
            >
              &larr; Cambiar cliente
            </button>

            <div className="rounded-lg border bg-muted/30 px-3 py-2">
              <p className="text-sm font-medium">{selectedClient.fullName}</p>
              {selectedClient.company && <p className="text-xs text-muted-foreground">{selectedClient.company}</p>}
              {selectedClient.email && <p className="text-[11px] text-muted-foreground/70">{selectedClient.email}</p>}
            </div>

            {/* Previous quotes */}
            {selectedClient.quotes.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Presupuestos anteriores
                </p>
                <div className="max-h-44 space-y-1.5 overflow-y-auto">
                  {selectedClient.quotes.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => setSelectedQuoteId(q.id === selectedQuoteId ? null : q.id)}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                        selectedQuoteId === q.id
                          ? "border-brand bg-brand/5 ring-1 ring-brand/30"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">
                          {new Date(q.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {q.items.slice(0, 3).map((item, i) => (
                            <span key={i} className="text-[11px] text-foreground">
                              {item.concept} (x{item.units})
                              {i < Math.min(q.items.length, 3) - 1 && ","}
                            </span>
                          ))}
                          {q.items.length > 3 && (
                            <span className="text-[11px] text-muted-foreground">+{q.items.length - 3} mas</span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums text-foreground">
                          {q.total.toLocaleString("es-ES")} €
                        </p>
                        {selectedQuoteId === q.id && (
                          <span className="text-[10px] font-medium text-brand">Duplicar</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
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
              {creating ? "Creando..." : selectedQuoteId ? "Crear pedido con presupuesto" : "Crear pedido"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
