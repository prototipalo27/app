/** Bambu Lab Cloud API & MQTT types */

/** Printer info returned by the Bambu Cloud HTTP API */
export interface CloudPrinter {
  dev_id: string; // serial number
  name: string;
  online: boolean;
  print_status: string;
  dev_model_name: string;
  dev_product_name: string;
}

/** Response from /v1/iot-service/api/user/bind */
export interface CloudBindResponse {
  message: string;
  code: number;
  devices: CloudPrinter[];
}

/** Subset of the MQTT `print` object we care about */
export interface MqttPrintStatus {
  gcode_state?: string;
  mc_percent?: number;
  mc_remaining_time?: number;
  gcode_file?: string;
  layer_num?: number;
  total_layer_num?: number;
  nozzle_temper?: number;
  nozzle_target_temper?: number;
  bed_temper?: number;
  bed_target_temper?: number;
  chamber_temper?: number;
  spd_lvl?: number;
  cooling_fan_speed?: string; // comes as percentage string like "15"
  print_error?: number;
  [key: string]: unknown;
}

/** Full MQTT message (only the parts we use) */
export interface MqttMessage {
  print?: MqttPrintStatus;
  [key: string]: unknown;
}

/** Aggregated printer status ready for DB upsert */
export interface PrinterSyncResult {
  serial_number: string;
  name: string;
  model: string | null;
  online: boolean;
  mqtt_connected: boolean;
  gcode_state: string | null;
  print_percent: number;
  remaining_minutes: number | null;
  current_file: string | null;
  layer_current: number | null;
  layer_total: number | null;
  nozzle_temp: number | null;
  nozzle_target: number | null;
  bed_temp: number | null;
  bed_target: number | null;
  chamber_temp: number | null;
  speed_level: number | null;
  fan_speed: number | null;
  print_error: number;
  raw_status: Record<string, unknown> | null;
  last_sync_at: string;
}
