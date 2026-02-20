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

/** Estimate delivery price for a route */
export async function estimateDelivery(
  pickup: CabifyAddress,
  dropoff: CabifyAddress,
): Promise<CabifyDeliveryEstimate> {
  const res = await fetch(`${CABIFY_API_BASE}/v1/deliveries/estimate`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      pickup: {
        address: `${pickup.street}, ${pickup.postal_code} ${pickup.city}`,
        contact: {
          name: pickup.contact_name,
          phone: pickup.contact_phone,
        },
      },
      dropoff: {
        address: `${dropoff.street}, ${dropoff.postal_code} ${dropoff.city}`,
        contact: {
          name: dropoff.contact_name,
          phone: dropoff.contact_phone,
        },
      },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cabify API error ${res.status}: ${body}`);
  }

  return (await res.json()) as CabifyDeliveryEstimate;
}

/** Create a parcel delivery */
export async function createParcel(params: {
  pickup: CabifyAddress;
  dropoff: CabifyAddress;
  description?: string;
}): Promise<CabifyParcel> {
  const { pickup, dropoff, description } = params;

  const res = await fetch(`${CABIFY_API_BASE}/v1/deliveries`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      pickup: {
        address: `${pickup.street}, ${pickup.postal_code} ${pickup.city}`,
        contact: {
          name: pickup.contact_name,
          phone: pickup.contact_phone,
          email: pickup.contact_email,
        },
      },
      dropoff: {
        address: `${dropoff.street}, ${dropoff.postal_code} ${dropoff.city}`,
        contact: {
          name: dropoff.contact_name,
          phone: dropoff.contact_phone,
          email: dropoff.contact_email,
        },
      },
      description: description || "3D printed parts",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cabify API error ${res.status}: ${body}`);
  }

  return (await res.json()) as CabifyParcel;
}

/** Get parcel status and tracking events */
export async function getParcelStatus(
  parcelId: string,
): Promise<CabifyParcelStatus> {
  const res = await fetch(`${CABIFY_API_BASE}/v1/deliveries/${parcelId}`, {
    headers: headers(),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cabify API error ${res.status}: ${body}`);
  }

  return (await res.json()) as CabifyParcelStatus;
}

/** Cancel a parcel delivery */
export async function cancelParcel(parcelId: string): Promise<void> {
  const res = await fetch(
    `${CABIFY_API_BASE}/v1/deliveries/${parcelId}/cancel`,
    {
      method: "POST",
      headers: headers(),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cabify API error ${res.status}: ${body}`);
  }
}
