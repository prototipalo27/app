"use client";

import { useState } from "react";
import { saveCommissionConfig, type CommissionConfig, type CommissionTier } from "../actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function CommissionSettings({
  configs,
  users,
}: {
  configs: CommissionConfig[];
  users: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [type, setType] = useState<"flat" | "tiered">("flat");
  const [newRate, setNewRate] = useState("15");
  const [returningRate, setReturningRate] = useState("7.5");
  const [tiers, setTiers] = useState<CommissionTier[]>([]);
  const [saving, setSaving] = useState(false);

  const configMap = new Map(configs.map((c) => [c.user_id, c]));

  function startEdit(userId: string) {
    const existing = configMap.get(userId);
    if (existing) {
      setType(existing.type);
      setNewRate(String(existing.new_rate * 100));
      setReturningRate(String(existing.returning_rate * 100));
      setTiers(existing.tiers.length > 0 ? existing.tiers : [{ min: 0, max: null, rate: 0.1 }]);
    } else {
      setType("flat");
      setNewRate("15");
      setReturningRate("7.5");
      setTiers([{ min: 0, max: null, rate: 0.1 }]);
    }
    setEditUserId(userId);
  }

  function addTier() {
    const last = tiers[tiers.length - 1];
    const newMin = last?.max ?? 0;
    setTiers([...tiers, { min: newMin, max: null, rate: 0.1 }]);
  }

  function removeTier(idx: number) {
    if (tiers.length <= 1) return;
    setTiers(tiers.filter((_, i) => i !== idx));
  }

  function updateTier(idx: number, field: keyof CommissionTier, value: string) {
    setTiers(tiers.map((t, i) => {
      if (i !== idx) return t;
      if (field === "rate") return { ...t, rate: parseFloat(value) / 100 || 0 };
      if (field === "max") return { ...t, max: value === "" ? null : parseFloat(value) || 0 };
      return { ...t, [field]: parseFloat(value) || 0 };
    }));
  }

  async function handleSave() {
    if (!editUserId) return;
    setSaving(true);
    try {
      await saveCommissionConfig(editUserId, {
        type,
        new_rate: parseFloat(newRate) / 100 || 0.15,
        returning_rate: parseFloat(returningRate) / 100 || 0.075,
        tiers: type === "tiered" ? tiers : [],
      });
      setEditUserId(null);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  }

  const inputClass =
    "h-8 w-20 rounded-md border border-input bg-background px-2 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle>Configuracion de comisiones</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
            {open ? "Cerrar" : "Ajustar"}
          </Button>
        </div>
      </CardHeader>

      {open && (
        <CardContent className="space-y-4 pt-4">
          {/* List of users with their config */}
          <div className="space-y-2">
            {users.map((user) => {
              const config = configMap.get(user.id);
              const isEditing = editUserId === user.id;

              return (
                <div key={user.id} className="rounded-lg border border-input p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{user.name}</span>
                      {config ? (
                        <Badge variant="secondary" className={
                          config.type === "tiered"
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        }>
                          {config.type === "tiered"
                            ? `Tramos (${config.tiers.length})`
                            : `${(config.new_rate * 100).toFixed(1)}% / ${(config.returning_rate * 100).toFixed(1)}%`
                          }
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Sin config</Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => isEditing ? setEditUserId(null) : startEdit(user.id)}
                    >
                      {isEditing ? "Cancelar" : "Editar"}
                    </Button>
                  </div>

                  {/* Edit form */}
                  {isEditing && (
                    <div className="mt-3 space-y-3 border-t border-input pt-3">
                      {/* Type selector */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground">Tipo:</label>
                        <select
                          value={type}
                          onChange={(e) => setType(e.target.value as "flat" | "tiered")}
                          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="flat">Plano (nuevo/recurrente)</option>
                          <option value="tiered">Por tramos (acumulado mensual)</option>
                        </select>
                      </div>

                      {type === "flat" ? (
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5">
                            <label className="text-xs text-muted-foreground">Nuevo:</label>
                            <input
                              type="number"
                              step="0.1"
                              value={newRate}
                              onChange={(e) => setNewRate(e.target.value)}
                              className={inputClass}
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <label className="text-xs text-muted-foreground">Recurrente:</label>
                            <input
                              type="number"
                              step="0.1"
                              value={returningRate}
                              onChange={(e) => setReturningRate(e.target.value)}
                              className={inputClass}
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Cada tramo aplica su % al slice de facturacion en ese rango. El acumulado mensual determina en que tramo cae cada euro.
                          </p>
                          {tiers.map((tier, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-8">De</span>
                              <input
                                type="number"
                                value={tier.min}
                                onChange={(e) => updateTier(idx, "min", e.target.value)}
                                className={inputClass}
                              />
                              <span className="text-xs text-muted-foreground">a</span>
                              <input
                                type="number"
                                value={tier.max ?? ""}
                                onChange={(e) => updateTier(idx, "max", e.target.value)}
                                placeholder="∞"
                                className={inputClass}
                              />
                              <span className="text-xs text-muted-foreground">&euro; →</span>
                              <input
                                type="number"
                                step="0.1"
                                value={(tier.rate * 100).toFixed(1)}
                                onChange={(e) => updateTier(idx, "rate", e.target.value)}
                                className={`${inputClass} w-16`}
                              />
                              <span className="text-xs text-muted-foreground">%</span>
                              {tiers.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeTier(idx)}
                                  className="text-xs text-red-500 hover:text-red-700"
                                >
                                  X
                                </button>
                              )}
                            </div>
                          ))}
                          <Button variant="ghost" size="sm" onClick={addTier}>
                            + Añadir tramo
                          </Button>
                        </div>
                      )}

                      <div className="flex justify-end">
                        <Button
                          onClick={handleSave}
                          disabled={saving}
                          className="bg-brand text-white hover:bg-brand-dark"
                        >
                          {saving ? "Guardando..." : "Guardar"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
