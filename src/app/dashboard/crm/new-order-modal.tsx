"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getRecurringClients, createRepeatOrder, type RecurringClient, type PastDocument } from "./actions";
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
  const [clients, setClients] = useState<RecurringClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<RecurringClient | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<PastDocument | null>(null);
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
      setSelectedDoc(null);
      setMessage("");
      setSearch("");
    }
  }, [open]);

  const filtered = clients.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [c.fullName, c.company, c.email, c.taxId].filter(Boolean).join(" ").toLowerCase().includes(q);
  });

  const handleCreate = async () => {
    if (!selectedClient) return;
    setCreating(true);
    const result = await createRepeatOrder(
      selectedClient.id,
      {
        fullName: selectedClient.fullName,
        company: selectedClient.company,
        email: selectedClient.email,
        phone: selectedClient.phone,
        holdedContactId: selectedClient.holdedContactId,
      },
      selectedDoc || null,
      message,
    );
    setCreating(false);
    if (result.success && result.leadId) {
      onClose();
      router.push(`/dashboard/crm/${result.leadId}`);
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
                    onClick={() => {
                      setSelectedClient(client);
                      if (client.documents.length > 0) {
                        setSelectedDoc(client.documents[0]);
                      }
                    }}
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
                      {client.documents.length > 0 && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          {client.documents.length} doc{client.documents.length !== 1 && "s"}
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
              onClick={() => { setSelectedClient(null); setSelectedDoc(null); }}
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

            {selectedClient.documents.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Documentos anteriores — selecciona para duplicar
                </p>
                <div className="max-h-44 space-y-1.5 overflow-y-auto">
                  {selectedClient.documents.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedDoc(doc.id === selectedDoc?.id ? null : doc)}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                        selectedDoc?.id === doc.id
                          ? "border-brand bg-brand/5 ring-1 ring-brand/30"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs text-muted-foreground">
                            {new Date(doc.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                          {doc.docNumber && (
                            <span className="text-[10px] text-muted-foreground/60">{doc.docNumber}</span>
                          )}
                          <Badge variant="secondary" className={`text-[9px] ${doc.source === "holded" ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" : ""}`}>
                            {doc.source === "holded" ? "Holded" : "CRM"}
                          </Badge>
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {doc.items.slice(0, 3).map((item, i) => (
                            <span key={i} className="text-[11px] text-foreground">
                              {item.concept} (x{item.units}){i < Math.min(doc.items.length, 3) - 1 && ","}
                            </span>
                          ))}
                          {doc.items.length > 3 && (
                            <span className="text-[11px] text-muted-foreground">+{doc.items.length - 3} mas</span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums text-foreground">
                          {doc.total.toLocaleString("es-ES")} €
                        </p>
                        {selectedDoc?.id === doc.id && (
                          <span className="text-[10px] font-medium text-brand">Duplicar</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
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
              {creating ? "Creando..." : selectedDoc ? "Crear pedido con presupuesto duplicado" : "Crear pedido sin presupuesto"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
