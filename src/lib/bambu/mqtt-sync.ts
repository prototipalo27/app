import mqtt from "mqtt";
import { getBoundPrinters } from "./api";
import {
  BAMBU_CLOUD_MQTT_BROKER,
  MQTT_CONNECT_TIMEOUT,
  MQTT_COLLECT_DURATION,
  getModelName,
} from "./config";
import type {
  CloudPrinter,
  MqttMessage,
  MqttPrintStatus,
  PrinterSyncResult,
} from "./types";

/**
 * Connect to Bambu Cloud MQTT, request status from all printers,
 * collect responses for ~8s, then disconnect and return results.
 */
export async function syncPrinters(): Promise<PrinterSyncResult[]> {
  const token = process.env.BAMBU_CLOUD_TOKEN;
  const userId = process.env.BAMBU_CLOUD_USER_ID;

  if (!token) throw new Error("BAMBU_CLOUD_TOKEN is not set");
  if (!userId) throw new Error("BAMBU_CLOUD_USER_ID is not set");

  // 1. Get bound printers from Cloud HTTP API
  const cloudPrinters = await getBoundPrinters();
  if (cloudPrinters.length === 0) {
    return [];
  }

  // 2. Connect to MQTT broker
  const collected = new Map<string, MqttPrintStatus>();
  const now = new Date().toISOString();

  const client = await new Promise<mqtt.MqttClient>((resolve, reject) => {
    const c = mqtt.connect(BAMBU_CLOUD_MQTT_BROKER, {
      username: `u_${userId}`,
      password: token,
      connectTimeout: MQTT_CONNECT_TIMEOUT,
      reconnectPeriod: 0, // no auto-reconnect for short-lived connection
      rejectUnauthorized: false, // Bambu Lab uses self-signed certs
    });

    c.on("connect", () => resolve(c));
    c.on("error", (err) => {
      c.end(true);
      reject(err);
    });

    setTimeout(() => {
      c.end(true);
      reject(new Error("MQTT connection timeout"));
    }, MQTT_CONNECT_TIMEOUT + 1000);
  });

  try {
    // 3. Subscribe to report topics
    const serials = cloudPrinters.map((p) => p.dev_id);
    for (const serial of serials) {
      client.subscribe(`device/${serial}/report`);
    }

    // 4. Listen for messages — merge incremental updates
    client.on("message", (_topic: string, payload: Buffer) => {
      const topicParts = _topic.split("/");
      const serial = topicParts[1];
      if (!serial) return;

      try {
        const msg = JSON.parse(payload.toString()) as MqttMessage;
        if (msg.print) {
          const existing = collected.get(serial) ?? {};
          collected.set(serial, { ...existing, ...msg.print });
        }
      } catch {
        // Ignore malformed messages
      }
    });

    // 5. Request pushall from each printer
    for (const serial of serials) {
      client.publish(
        `device/${serial}/request`,
        JSON.stringify({
          pushing: { sequence_id: "0", command: "pushall" },
        })
      );
    }

    // 6. Wait for collection period
    await new Promise((resolve) => setTimeout(resolve, MQTT_COLLECT_DURATION));
  } finally {
    // 7. Always disconnect
    client.end(true);
  }

  // 8. Build results merging Cloud API + MQTT data
  return cloudPrinters.map((cp) => buildResult(cp, collected.get(cp.dev_id), now));
}

function buildResult(
  cloud: CloudPrinter,
  mqttData: MqttPrintStatus | undefined,
  syncTime: string
): PrinterSyncResult {
  return {
    serial_number: cloud.dev_id,
    name: cloud.name,
    model: getModelName(cloud.dev_model_name),
    online: cloud.online,
    mqtt_connected: !!mqttData,
    gcode_state: mqttData?.gcode_state ?? null,
    print_percent: mqttData?.mc_percent ?? 0,
    remaining_minutes: mqttData?.mc_remaining_time ?? null,
    current_file: mqttData?.gcode_file ?? null,
    layer_current: mqttData?.layer_num ?? null,
    layer_total: mqttData?.total_layer_num ?? null,
    nozzle_temp: mqttData?.nozzle_temper ?? null,
    nozzle_target: mqttData?.nozzle_target_temper ?? null,
    bed_temp: mqttData?.bed_temper ?? null,
    bed_target: mqttData?.bed_target_temper ?? null,
    chamber_temp: mqttData?.chamber_temper ?? null,
    speed_level: mqttData?.spd_lvl ?? null,
    fan_speed: mqttData?.cooling_fan_speed
      ? parseInt(mqttData.cooling_fan_speed, 10)
      : null,
    print_error: mqttData?.print_error ?? 0,
    raw_status: mqttData ? (mqttData as unknown as Record<string, unknown>) : null,
    last_sync_at: syncTime,
  };
}
