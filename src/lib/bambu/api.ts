import { BAMBU_CLOUD_API_BASE } from "./config";
import type { CloudBindResponse, CloudPrinter } from "./types";

/**
 * Fetch the list of printers bound to the Bambu Lab account.
 * Uses the Cloud HTTP API (not MQTT).
 */
export async function getBoundPrinters(): Promise<CloudPrinter[]> {
  const token = process.env.BAMBU_CLOUD_TOKEN;
  if (!token) throw new Error("BAMBU_CLOUD_TOKEN is not set");

  const res = await fetch(`${BAMBU_CLOUD_API_BASE}/v1/iot-service/api/user/bind`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Bambu Cloud API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as CloudBindResponse;

  if (!data.devices) {
    return [];
  }

  return data.devices;
}
