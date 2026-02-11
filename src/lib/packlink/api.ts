import type {
  PacklinkAddress,
  PacklinkDropoffPoint,
  PacklinkLabel,
  PacklinkOrderRequest,
  PacklinkOrderResponse,
  PacklinkPackage,
  PacklinkService,
  PacklinkShipment,
  PacklinkTrackingHistory,
} from "./types";

const PACKLINK_API_BASE = "https://apisandbox.packlink.com/v1";

function getApiKey(): string {
  const key = process.env.PACKLINK_API_KEY;
  if (!key) throw new Error("PACKLINK_API_KEY is not set");
  return key;
}

function headers(): Record<string, string> {
  return {
    Authorization: getApiKey(),
    "Content-Type": "application/json",
  };
}

/** Fetch available shipping services for a given route and package dimensions */
export async function getServices(
  from: { zip: string; country: string },
  to: { zip: string; country: string },
  packages: PacklinkPackage[],
): Promise<PacklinkService[]> {
  const params = new URLSearchParams({
    from_zip: from.zip,
    from_country: from.country,
    to_zip: to.zip,
    to_country: to.country,
  });

  packages.forEach((pkg, i) => {
    params.set(`packages[${i}][width]`, String(pkg.width));
    params.set(`packages[${i}][height]`, String(pkg.height));
    params.set(`packages[${i}][length]`, String(pkg.length));
    params.set(`packages[${i}][weight]`, String(pkg.weight));
  });

  const res = await fetch(`${PACKLINK_API_BASE}/services?${params}`, {
    headers: headers(),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Packlink API error ${res.status}: ${body}`);
  }

  return (await res.json()) as PacklinkService[];
}

/** Create a shipping order in Packlink */
export async function createOrder(
  data: PacklinkOrderRequest,
): Promise<PacklinkOrderResponse> {
  const res = await fetch(`${PACKLINK_API_BASE}/shipments`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      from: data.from,
      to: data.to,
      packages: data.packages,
      service_id: data.service_id,
      content: data.content,
      contentvalue: data.contentvalue,
      source: data.source,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Packlink API error ${res.status}: ${body}`);
  }

  return (await res.json()) as PacklinkOrderResponse;
}

/** Get shipment details by reference */
export async function getShipment(
  reference: string,
): Promise<PacklinkShipment> {
  const res = await fetch(`${PACKLINK_API_BASE}/shipments/${reference}`, {
    headers: headers(),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Packlink API error ${res.status}: ${body}`);
  }

  return (await res.json()) as PacklinkShipment;
}

/** Get shipping labels for a shipment */
export async function getLabels(
  reference: string,
): Promise<PacklinkLabel[]> {
  const res = await fetch(
    `${PACKLINK_API_BASE}/shipments/${reference}/labels`,
    { headers: headers(), cache: "no-store" },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Packlink API error ${res.status}: ${body}`);
  }

  return (await res.json()) as PacklinkLabel[];
}

/** Get tracking events for a shipment */
export async function getTracking(
  reference: string,
): Promise<PacklinkTrackingHistory> {
  const res = await fetch(
    `${PACKLINK_API_BASE}/shipments/${reference}/track`,
    { headers: headers(), cache: "no-store" },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Packlink API error ${res.status}: ${body}`);
  }

  return (await res.json()) as PacklinkTrackingHistory;
}

/** Get available drop-off points for a service */
export async function getDropoffPoints(
  serviceId: number,
  country: string,
  postalCode: string,
): Promise<PacklinkDropoffPoint[]> {
  const res = await fetch(
    `${PACKLINK_API_BASE}/dropoffs/${serviceId}/${country}/${postalCode}`,
    { headers: headers(), cache: "no-store" },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Packlink API error ${res.status}: ${body}`);
  }

  return (await res.json()) as PacklinkDropoffPoint[];
}
