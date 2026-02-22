"use client";

import { useRouter } from "next/navigation";
import { stopImpersonating } from "@/lib/impersonate";

export default function ImpersonationBanner({
  email,
  role,
}: {
  email: string;
  role: string;
}) {
  const router = useRouter();

  const ROLE_LABELS: Record<string, string> = {
    super_admin: "Admin",
    manager: "Manager",
    employee: "Empleado",
  };

  return (
    <div className="flex items-center justify-between bg-amber-500 px-4 py-2 text-sm font-medium text-black">
      <span>
        Viendo como: <strong>{email}</strong> ({ROLE_LABELS[role] ?? role})
      </span>
      <button
        onClick={async () => {
          await stopImpersonating();
          router.refresh();
        }}
        className="rounded bg-black/20 px-3 py-1 text-xs font-semibold text-black hover:bg-black/30"
      >
        Salir
      </button>
    </div>
  );
}
