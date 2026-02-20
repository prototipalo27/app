import type {
  CabifyAddress,
  CabifyDeliveryEstimate,
  CabifyParcel,
  CabifyParcelStatus,
} from "./types";

const CABIFY_API_BASE =
  process.env.CABIFY_API_URL || "https://logistics.api.cabify.com";

function getApiKey(): string {
  const key = process.env.CABIFY_API_KEY;
  if (!key) throw new Error("CABIFY_API_KEY is not set");
  return key;
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
  };
}

/**
 * Build the parcel address object used across Cabify endpoints.
 * The exact field names are based on the Cabify Logistics API reference.
 */
function buildParcelAddress(addr: CabifyAddress) {
  return {
    address: addr.street,
    city: addr.city,
    postal_code: addr.postal_code,
    country_code: addr.country,
    contact_name: addr.contact_name,
    contact_phone: addr.contact_phone,
    contact_email: addr.contact_email,
  };
}

/** Estimate delivery price for a route (POST /shipment/estimate) */
export async function estimateDelivery(
  pickup: CabifyAddress,
  dropoff: CabifyAddress,
): Promise<CabifyDeliveryEstimate> {
  const res = await fetch(`${CABIFY_API_BASE}/shipment/estimate`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      pickup: buildParcelAddress(pickup),
      dropoff: buildParcelAddress(dropoff),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cabify API error ${res.status}: ${body}`);
  }

  return (await res.json()) as CabifyDeliveryEstimate;
}

/** Create a parcel in the system (POST /parcels) */
export async function createParcel(params: {
  pickup: CabifyAddress;
  dropoff: CabifyAddress;
  description?: string;
}): Promise<CabifyParcel> {
  const { pickup, dropoff, description } = params;

  const res = await fetch(`${CABIFY_API_BASE}/parcels`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      parcels: [
        {
          pickup: buildParcelAddress(pickup),
          dropoff: buildParcelAddress(dropoff),
          description: description || "3D printed parts",
        },
      ],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cabify API error ${res.status}: ${body}`);
  }

  return (await res.json()) as CabifyParcel;
}

/** Ship parcels — requests pickup (POST /shipment) */
export async function shipParcels(parcelIds: string[]): Promise<unknown> {
  const res = await fetch(`${CABIFY_API_BASE}/shipment`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ parcel_ids: parcelIds }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cabify API error ${res.status}: ${body}`);
  }

  return await res.json();
}

/** Get parcel status (GET /parcels/{id}/status) */
export async function getParcelStatus(
  parcelId: string,
): Promise<CabifyParcelStatus> {
  const res = await fetch(`${CABIFY_API_BASE}/parcels/${parcelId}/status`, {
    headers: headers(),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cabify API error ${res.status}: ${body}`);
  }

  return (await res.json()) as CabifyParcelStatus;
}

/** Get parcel timeline (GET /parcels/{id}/timeline) */
export async function getParcelTimeline(
  parcelId: string,
): Promise<CabifyParcelStatus> {
  const res = await fetch(`${CABIFY_API_BASE}/parcels/${parcelId}/timeline`, {
    headers: headers(),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cabify API error ${res.status}: ${body}`);
  }

  return (await res.json()) as CabifyParcelStatus;
}

/** Cancel delivery of parcels (POST /delivery/cancel) */
export async function cancelParcel(parcelId: string): Promise<void> {
  const res = await fetch(`${CABIFY_API_BASE}/delivery/cancel`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ parcel_ids: [parcelId] }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cabify API error ${res.status}: ${body}`);
  }
}
