import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import SignaturePad from "./signature-pad";

export default async function SignatureSettingsPage() {
  const profile = await requireRole("manager");

  const supabase = await createClient();
  const { data } = await supabase
    .from("user_profiles")
    .select("signature_data")
    .eq("id", profile.id)
    .single();

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <Link
        href="/dashboard/settings"
        className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        ← Volver a Ajustes
      </Link>

      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Tu firma</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Esta firma se incrustará en la columna de Prototipalo de cada NDA cuando un cliente lo firme. La rúbrica del super_admin del sistema es la que se aplica a todos los NDAs, así que asegúrate de que es la tuya si eres tú quien firma.
        </p>
      </div>

      <SignaturePad
        current={data?.signature_data ?? null}
        isCanonical={profile.role === "super_admin"}
      />
    </div>
  );
}
