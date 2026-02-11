/** Packlink PRO API types */

export interface PacklinkAddress {
  city: string;
  country: string; // ISO 2-letter code (ES, FR, DE…)
  email?: string;
  name?: string;
  phone?: string;
  street1: string;
  zip_code: string;
  company?: string;
}

export interface PacklinkPackage {
  width: number; // cm
  height: number; // cm
  length: number; // cm
  weight: number; // kg
}

export interface PacklinkService {
  id: number;
  carrier_name: string;
  name: string;
  price: {
    total_price: number;
    currency: string;
  };
  transit_hours: string;
  transit_days: string;
  delivery_to_parcelshop: boolean;
}

export interface PacklinkOrderRequest {
  from: PacklinkAddress;
  to: PacklinkAddress;
  packages: PacklinkPackage[];
  service_id: number;
  content: string;
  contentvalue: number;
  source: string;
}

export interface PacklinkOrderResponse {
  reference: string;
}

export interface PacklinkShipment {
  reference: string;
  tracking_codes: string[];
  state: string;
  carrier: string;
  service: string;
  price: {
    total_price: number;
    currency: string;
  };
}

export interface PacklinkLabel {
  url: string;
}

export interface PacklinkTrackingEvent {
  city: string;
  description: string;
  timestamp: string;
}

export interface PacklinkTrackingHistory {
  history: PacklinkTrackingEvent[];
}

export interface PacklinkDropoffPoint {
  id: string;
  name: string;
  address: string;
  city: string;
  zip_code: string;
  lat: number;
  long: number;
}
