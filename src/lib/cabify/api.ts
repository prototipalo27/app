import type {
  CabifyAddress,
  CabifyDeliveryEstimate,
  CabifyParcel,
  CabifyParcelStatus,
} from "./types";

const CABIFY_API_BASE =
  process.env.CABIFY_API_URL || "https://logistics.api.cabify.com";

// ---------------------------------------------------------------------------
// OAuth2 token management
// ---------------------------------------------------------------------------

let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Obtain a Bearer token via OAuth2 client_credentials grant.
 * Tokens are cached in-memory and refreshed 5 minutes before expiry.
 */
async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const clientId = process.env.CABIFY_API_KEY;
  const clientSecret = process.env.CABIFY_API_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("CABIFY_API_KEY and CABIFY_API_SECRET must be set");
  }

  const res = await fetch(`${CABIFY_API_BASE}/auth/api/authorization`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cabify auth error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  // Cache with 5 min buffer before actual expiry
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  return cachedToken.value;
}

async function headers(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// ---------------------------------------------------------------------------
// Shipping types
// ---------------------------------------------------------------------------

const EXPRESS_SHIPPING_TYPE_ID = "9a0fa972-a29d-4925-a88b-3c03582b33fb";

// ---------------------------------------------------------------------------
// Estimate
// ---------------------------------------------------------------------------

/** Estimate delivery price for a route (POST /v3/parcels/estimate) */
export async function estimateDelivery(
  pickup: CabifyAddress,
  dropoff: CabifyAddress,
): Promise<CabifyDeliveryEstimate> {
  const pickupAddr = [pickup.street, pickup.postal_code, pickup.city].join(", ");
  const dropoffAddr = [dropoff.street, dropoff.postal_code, dropoff.city].join(", ");

  const res = await fetch(`${CABIFY_API_BASE}/v3/parcels/estimate`, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({
      parcels: [
        {
          pickup_location: { address: pickupAddr },
          dropoff_location: { address: dropoffAddr },
        },
      ],
      shipping_type_id: EXPRESS_SHIPPING_TYPE_ID,
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

// ---------------------------------------------------------------------------
// Parcels
// ---------------------------------------------------------------------------

/** Create a parcel (POST /v1/parcels) */
export async function createParcel(params: {
  pickup: CabifyAddress;
  dropoff: CabifyAddress;
  description?: string;
}): Promise<CabifyParcel> {
  const { pickup, dropoff } = params;

  const pickupAddr = [pickup.street, pickup.postal_code, pickup.city].join(", ");
  const dropoffAddr = [dropoff.street, dropoff.postal_code, dropoff.city].join(", ");

  const res = await fetch(`${CABIFY_API_BASE}/v1/parcels`, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({
      parcels: [
        {
          pickup_info: {
            addr: pickupAddr,
            contact: {
              name: pickup.contact_name || "Prototipalo SL",
              phone: pickup.contact_phone || "",
            },
          },
          dropoff_info: {
            addr: dropoffAddr,
            contact: {
              name: dropoff.contact_name || "",
              phone: dropoff.contact_phone || "",
            },
          },
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

  const data = (await res.json()) as { parcels: Array<{ id: string; state: string }> };
  const first = data.parcels[0];

  return {
    id: first.id,
    status: first.state,
    created_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Ship
// ---------------------------------------------------------------------------

/** Ship parcels — requests pickup (POST /v1/parcels/ship) */
export async function shipParcels(parcelIds: string[]): Promise<unknown> {
  const res = await fetch(`${CABIFY_API_BASE}/v1/parcels/ship`, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({
      parcel_ids: parcelIds,
      shipping_type_id: EXPRESS_SHIPPING_TYPE_ID,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cabify API error ${res.status}: ${body}`);
  }

  return await res.json();
}

// ---------------------------------------------------------------------------
// Status & tracking
// ---------------------------------------------------------------------------

/** Get parcel status (GET /v1/parcels/{id}/status) */
export async function getParcelStatus(
  parcelId: string,
): Promise<CabifyParcelStatus> {
  const res = await fetch(`${CABIFY_API_BASE}/v1/parcels/${parcelId}/status`, {
    headers: await headers(),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cabify API error ${res.status}: ${body}`);
  }

  return (await res.json()) as CabifyParcelStatus;
}

/** Get parcel timeline (GET /v1/parcels/{id}/timeline) */
export async function getParcelTimeline(
  parcelId: string,
): Promise<CabifyParcelStatus> {
  const res = await fetch(`${CABIFY_API_BASE}/v1/parcels/${parcelId}/timeline`, {
    headers: await headers(),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cabify API error ${res.status}: ${body}`);
  }

  return (await res.json()) as CabifyParcelStatus;
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

/** Cancel delivery of parcels (POST /v1/parcels/deliver/cancel) */
export async function cancelParcel(parcelId: string): Promise<void> {
  const res = await fetch(`${CABIFY_API_BASE}/v1/parcels/deliver/cancel`, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({ parcel_ids: [parcelId] }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cabify API error ${res.status}: ${body}`);
  }
}
