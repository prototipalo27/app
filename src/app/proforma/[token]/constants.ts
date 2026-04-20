export type PaymentCondition = "50-50" | "100-5" | "100-0";

// Below this subtotal (base imponible, sin IVA) the client cannot choose — single payment only.
export const DISCOUNT_THRESHOLD_EUR = 400;
