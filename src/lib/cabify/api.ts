import type {
  CabifyAddress,
  CabifyDeliveryEstimate,
  CabifyParcel,
  CabifyParcelStatus,
} from "./types";

// ---------------------------------------------------------------------------
// Cabify Corporate API (rides + deliveries)
// Base: https://cabify.com/api/v4
// Auth: OAuth2 client_credentials → POST /auth/api/authorization
// ---------------------------------------------------------------------------

const CABIFY_BASE =
  process.env.CABIFY_API_URL || "https://cabify.com";

const REQUESTER_ID = "e9c7ba933d1611edb6126a4aaec3df3f"; // Manuel @ Prototipalo

// ---------------------------------------------------------------------------
// OAuth2 token management
// ---------------------------------------------------------------------------

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const clientId = process.env.CABIFY_API_KEY;
  const clientSecret = process.env.CABIFY_API_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("CABIFY_API_KEY and CABIFY_API_SECRET must be set");
  }

  const res = await fetch(`${CABIFY_BASE}/auth/api/authorization`, {
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
// Geocode helper — convert address to [lat, lon]
// Uses the Cabify estimate endpoint indirectly, but for now we use a simple
// Google-free approach: pass addresses as stop names and let Cabify resolve.
// Actually, Cabify stops require `loc` coordinates. We'll use a Nominatim call.
// ---------------------------------------------------------------------------

async function geocode(address: string): Promise<[number, number]> {
  const q = encodeURIComponent(address);
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
    {
      headers: { "User-Agent": "Prototipalo/1.0" },
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!res.ok) throw new Error("Geocoding failed");
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data.length) throw new Error(`Could not geocode: ${address}`);
  return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
}

// ---------------------------------------------------------------------------
// Estimate
// ---------------------------------------------------------------------------

/** Estimate delivery price via Cabify Corporate API */
export async function estimateDelivery(
  pickup: CabifyAddress,
  dropoff: CabifyAddress,
): Promise<CabifyDeliveryEstimate> {
  const pickupAddr = [pickup.street, pickup.postal_code, pickup.city].join(", ");
  const dropoffAddr = [dropoff.street, dropoff.postal_code, dropoff.city].join(", ");

  const [pickupLoc, dropoffLoc] = await Promise.all([
    geocode(pickupAddr),
    geocode(dropoffAddr),
  ]);

  const res = await fetch(`${CABIFY_BASE}/api/v4/estimates`, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({
      start_type: "asap",
      requester_id: REQUESTER_ID,
      stops: [
        { loc: pickupLoc, addr: pickupAddr },
        { loc: dropoffLoc, addr: dropoffAddr },
      ],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cabify API error ${res.status}: ${body}`);
  }

  const estimates = (await res.json()) as Array<{
    product: { id: string; slug: string; name: string; service_type: string };
    total: { amount: number; currency: string };
    eta: { formatted: string; estimated: number };
    duration: number;
  }>;

  // Find the "delivery" product
  const delivery = estimates.find((e) => e.product.service_type === "delivery");

  if (!delivery) {
    throw new Error("Cabify delivery service not available for this route");
  }

  return {
    price: {
      // Cabify returns amounts in cents
      amount: delivery.total.amount / 100,
      currency: delivery.total.currency,
    },
    estimated_duration_minutes: Math.ceil(delivery.duration / 60),
    product_id: delivery.product.id,
  };
}

// ---------------------------------------------------------------------------
// Create journey (= create delivery + request pickup in one step)
// ---------------------------------------------------------------------------

export async function createParcel(params: {
  pickup: CabifyAddress;
  dropoff: CabifyAddress;
  description?: string;
}): Promise<CabifyParcel> {
  const { pickup, dropoff, description } = params;

  const pickupAddr = [pickup.street, pickup.postal_code, pickup.city].join(", ");
  const dropoffAddr = [dropoff.street, dropoff.postal_code, dropoff.city].join(", ");

  // 1. Get estimate to obtain the delivery product_id
  const estimate = await estimateDelivery(pickup, dropoff);

  // 2. Geocode addresses
  const [pickupLoc, dropoffLoc] = await Promise.all([
    geocode(pickupAddr),
    geocode(dropoffAddr),
  ]);

  // 3. Create the journey (this requests the driver immediately)
  const res = await fetch(`${CABIFY_BASE}/api/v4/journey`, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({
      product_id: estimate.product_id,
      requester_id: REQUESTER_ID,
      rider: {
        id: REQUESTER_ID,
      },
      stops: [
        {
          loc: pickupLoc,
          addr: pickupAddr,
          name: pickup.contact_name || "Prototipalo",
          contact: {
            name: pickup.contact_name || "Prototipalo SL",
            phone: pickup.contact_phone || "",
          },
        },
        {
          loc: dropoffLoc,
          addr: dropoffAddr,
          name: dropoff.contact_name || "Destinatario",
          contact: {
            name: dropoff.contact_name || "",
            phone: dropoff.contact_phone || "",
          },
          instr: description || "3D printed parts",
        },
      ],
      message: description || "Envío Prototipalo",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cabify API error ${res.status}: ${body}`);
  }

  const journey = (await res.json()) as {
    _id: string;
    state: string;
    tracking_url?: string;
    price?: { amount: number; currency: string };
  };

  return {
    id: journey._id,
    status: journey.state || "created",
    tracking_url: journey.tracking_url,
    price: journey.price
      ? { amount: journey.price.amount / 100, currency: journey.price.currency }
      : estimate.price
        ? { amount: estimate.price.amount, currency: estimate.price.currency }
        : undefined,
    created_at: new Date().toISOString(),
  };
}

// No separate ship step needed — createParcel creates the journey directly

/** Ship parcels — no-op for corporate API (journey is created directly) */
export async function shipParcels(_parcelIds: string[]): Promise<unknown> {
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Status & tracking
// ---------------------------------------------------------------------------

/** Get journey state */
export async function getParcelStatus(
  journeyId: string,
): Promise<CabifyParcelStatus> {
  const res = await fetch(`${CABIFY_BASE}/api/v4/journey/${journeyId}`, {
    headers: await headers(),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cabify API error ${res.status}: ${body}`);
  }

  const journey = (await res.json()) as {
    _id: string;
    state: string;
    tracking_url?: string;
    timeline?: Array<{ timestamp: string; status: string; description: string }>;
  };

  return {
    id: journey._id,
    status: journey.state,
    tracking_url: journey.tracking_url,
    events: journey.timeline || [],
  };
}

/** Get journey timeline (same as status for corporate API) */
export async function getParcelTimeline(
  journeyId: string,
): Promise<CabifyParcelStatus> {
  return getParcelStatus(journeyId);
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

/** Cancel a journey */
export async function cancelParcel(journeyId: string): Promise<void> {
  const res = await fetch(`${CABIFY_BASE}/api/v4/journey/${journeyId}/cancel`, {
    method: "POST",
    headers: await headers(),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cabify API error ${res.status}: ${body}`);
  }
}
