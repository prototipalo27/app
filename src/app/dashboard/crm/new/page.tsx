import { createClient } from "@/lib/supabase/server";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createLead } from "../actions";
import { QUANTITY_RANGES, COMPLEXITY_OPTIONS, URGENCY_OPTIONS } from "@/lib/crm-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

export default async function NewLeadPage() {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");
  if (!hasRole(profile.role, "manager")) redirect("/dashboard");

  const supabase = await createClient();

  const { data: managers } = await supabase
    .from("user_profiles")
    .select("id, email")
    .in("role", ["manager", "super_admin"])
    .eq("is_active", true);

  const selectClass =
    "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <Link
          href="/dashboard/crm"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Volver a CRM
        </Link>
      </div>

      <Card>
        <CardContent>
          <h1 className="mb-6 text-xl font-bold text-card-foreground">
            Nuevo Lead
          </h1>

          <form action={createLead} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Nombre completo *
              </label>
              <Input
                type="text"
                name="full_name"
                required
                placeholder="Nombre del contacto"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Empresa
              </label>
              <Input
                type="text"
                name="company"
                placeholder="Nombre de la empresa"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Email
                </label>
                <Input
                  type="email"
                  name="email"
                  placeholder="email@ejemplo.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Telefono
                </label>
                <Input
                  type="tel"
                  name="phone"
                  placeholder="+34 600 000 000"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Mensaje
              </label>
              <Textarea
                name="message"
                rows={4}
                placeholder="Descripcion del proyecto o consulta..."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Cantidad estimada
                </label>
                <select name="estimated_quantity" className={selectClass}>
                  <option value="">Sin definir</option>
                  {QUANTITY_RANGES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Complejidad
                </label>
                <select name="estimated_complexity" className={selectClass}>
                  <option value="">Sin definir</option>
                  {COMPLEXITY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Urgencia
                </label>
                <select name="estimated_urgency" className={selectClass}>
                  <option value="">Sin definir</option>
                  {URGENCY_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Asignar a
                </label>
                <select name="assigned_to" className={selectClass}>
                  <option value="">Sin asignar</option>
                  {(managers || []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.email.split("@")[0]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Captado por
                </label>
                <select name="owned_by" defaultValue={profile.id} className={selectClass}>
                  {(managers || []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.email.split("@")[0]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" render={<Link href="/dashboard/crm" />}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-brand text-white hover:bg-brand-dark">
                Crear lead
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
