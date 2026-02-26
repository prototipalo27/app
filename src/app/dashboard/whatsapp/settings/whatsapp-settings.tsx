"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Instance = {
  id: string;
  instance_name: string;
  phone_number: string | null;
  status: string;
  api_key: string | null;
  created_at: string;
};

export default function WhatsAppSettings({
  instance,
}: {
  instance: Instance | null;
}) {
  const router = useRouter();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState(instance?.status || "disconnected");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Real-time status updates
  useEffect(() => {
    if (!instance) return;

    const supabase = createClient();
    const channel = supabase
      .channel("whatsapp-instance-status")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "whatsapp_instances",
          filter: `id=eq.${instance.id}`,
        },
        (payload) => {
          const newStatus = (payload.new as Instance).status;
          setStatus(newStatus);
          if (newStatus === "connected") {
            setQrCode(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [instance]);

  const handleCreateInstance = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/whatsapp/instance", {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Error al crear instancia");
          return;
        }
        router.refresh();
      } catch {
        setError("Error de conexión");
      }
    });
  };

  const handleConnect = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/whatsapp/connect", {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Error al obtener QR");
          return;
        }
        if (data.base64) {
          setQrCode(data.base64);
        } else if (data.code) {
          setQrCode(data.code);
        }
      } catch {
        setError("Error de conexión");
      }
    });
  };

  const handleDisconnect = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/whatsapp/disconnect", {
          method: "POST",
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Error al desconectar");
          return;
        }
        setStatus("disconnected");
        setQrCode(null);
        router.refresh();
      } catch {
        setError("Error de conexión");
      }
    });
  };

  return (
    <div className="max-w-xl space-y-6">
      {/* Status card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
          Estado de la conexión
        </h2>

        <div className="mb-4 flex items-center gap-3">
          <span
            className={`h-3 w-3 rounded-full ${
              status === "connected"
                ? "bg-green-500"
                : status === "connecting"
                  ? "animate-pulse bg-yellow-500"
                  : "bg-red-500"
            }`}
          />
          <span className="text-sm font-medium text-zinc-900 dark:text-white">
            {status === "connected"
              ? "Conectado"
              : status === "connecting"
                ? "Conectando..."
                : "Desconectado"}
          </span>
          {instance?.phone_number && (
            <span className="text-sm text-zinc-500">
              (+{instance.phone_number})
            </span>
          )}
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </p>
        )}

        {!instance ? (
          <button
            onClick={handleCreateInstance}
            disabled={isPending}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isPending ? "Creando..." : "Crear instancia WhatsApp"}
          </button>
        ) : status === "connected" ? (
          <button
            onClick={handleDisconnect}
            disabled={isPending}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            {isPending ? "Desconectando..." : "Desconectar WhatsApp"}
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={isPending}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isPending ? "Obteniendo QR..." : "Conectar WhatsApp"}
          </button>
        )}
      </div>

      {/* QR Code */}
      {qrCode && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
            Escanea el código QR
          </h2>
          <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
            Abre WhatsApp en tu teléfono → Dispositivos vinculados → Vincular
            dispositivo
          </p>
          <div className="flex justify-center rounded-lg bg-white p-4">
            {qrCode.startsWith("data:") || qrCode.startsWith("http") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrCode}
                alt="QR Code"
                className="h-64 w-64"
              />
            ) : (
              <div className="flex h-64 w-64 items-center justify-center rounded-lg bg-zinc-100 text-xs text-zinc-500">
                <pre className="overflow-hidden text-[6px] leading-tight">
                  {qrCode}
                </pre>
              </div>
            )}
          </div>
          <p className="mt-3 text-center text-xs text-zinc-400">
            El QR se actualiza automáticamente. Esperando conexión...
          </p>
        </div>
      )}

      {/* Info */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">
          Información
        </h2>
        <ul className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
          <li>
            La conexión usa Evolution API como bridge con WhatsApp.
          </li>
          <li>
            Los mensajes se sincronizan en tiempo real con Supabase.
          </li>
          <li>
            Solo managers y super_admin pueden acceder a esta sección.
          </li>
        </ul>
      </div>
    </div>
  );
}
