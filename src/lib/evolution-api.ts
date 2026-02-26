const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL!;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY!;

async function evoFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${EVOLUTION_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: EVOLUTION_API_KEY,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evolution API error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function createInstance(instanceName: string, webhookUrl: string) {
  return evoFetch("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      webhook: {
        url: webhookUrl,
        byEvents: false,
        base64: false,
        events: [
          "MESSAGES_UPSERT",
          "MESSAGES_UPDATE",
          "CONNECTION_UPDATE",
          "QRCODE_UPDATED",
        ],
      },
    }),
  });
}

export async function getInstanceStatus(instanceName: string) {
  return evoFetch(`/instance/connectionState/${instanceName}`);
}

export async function getQRCode(instanceName: string) {
  return evoFetch(`/instance/connect/${instanceName}`);
}

export async function sendTextMessage(
  instanceName: string,
  phone: string,
  text: string
) {
  return evoFetch(`/message/sendText/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({
      number: phone,
      text,
    }),
  });
}

export async function deleteInstance(instanceName: string) {
  return evoFetch(`/instance/delete/${instanceName}`, {
    method: "DELETE",
  });
}

export async function logoutInstance(instanceName: string) {
  return evoFetch(`/instance/logout/${instanceName}`, {
    method: "DELETE",
  });
}

export async function fetchInstances() {
  return evoFetch("/instance/fetchInstances");
}
