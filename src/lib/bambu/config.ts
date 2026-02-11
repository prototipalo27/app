/** Bambu Lab Cloud configuration constants */

export const BAMBU_CLOUD_MQTT_BROKER = "mqtts://us.mqtt.bambulab.com:8883";

export const BAMBU_CLOUD_API_BASE = "https://api.bambulab.com";

/** MQTT connection timeout in ms */
export const MQTT_CONNECT_TIMEOUT = 5_000;

/** How long to collect MQTT responses before disconnecting (ms) */
export const MQTT_COLLECT_DURATION = 8_000;

/** Map Bambu dev_model_name to friendly model names */
export const MODEL_NAME_MAP: Record<string, string> = {
  "BL-P001": "X1 Carbon",
  "BL-P002": "X1",
  "C11": "P1P",
  "C12": "P1S",
  "C13": "X1E",
  "N1": "A1 mini",
  "N2S": "A1",
  "A1": "A1",
  "A1M": "A1 mini",
};

export function getModelName(devModelName: string): string {
  return MODEL_NAME_MAP[devModelName] ?? devModelName;
}
