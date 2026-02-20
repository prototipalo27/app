/** Address for Cabify Logistics pickup/dropoff */
export interface CabifyAddress {
  street: string;
  city: string;
  postal_code: string;
  country: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
}

/** Delivery estimate from Cabify */
export interface CabifyDeliveryEstimate {
  price: {
    amount: number;
    currency: string;
  };
  estimated_duration_minutes?: number;
  product_id?: string;
}

/** Parcel creation response */
export interface CabifyParcel {
  id: string;
  status: string;
  tracking_url?: string;
  price?: {
    amount: number;
    currency: string;
  };
  created_at: string;
}

/** Tracking event from Cabify */
export interface CabifyTrackingEvent {
  timestamp: string;
  status: string;
  description: string;
}

/** Parcel status response */
export interface CabifyParcelStatus {
  id: string;
  status: string;
  tracking_url?: string;
  events: CabifyTrackingEvent[];
}

/** Webhook payload from Cabify */
export interface CabifyWebhookPayload {
  event: string;
  parcel_id: string;
  status: string;
  timestamp: string;
}
