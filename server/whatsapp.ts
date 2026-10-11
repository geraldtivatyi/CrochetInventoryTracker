const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION ?? "v23.0";

export function normalizeWhatsAppNumber(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 10) digits = `27${digits.slice(1)}`;
  if (digits.length < 8 || digits.length > 15) {
    throw new Error("The WhatsApp recipient phone number must be in international format.");
  }
  return digits;
}

async function sendWhatsAppMessage(
  accessToken: string,
  phoneNumberId: string,
  recipient: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizeWhatsAppNumber(recipient),
        ...payload,
      }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  if (!response.ok) {
    throw new Error(body?.error?.message ?? `WhatsApp Cloud API returned HTTP ${response.status}.`);
  }
}

export async function sendWhatsAppTemplate(
  accessToken: string,
  phoneNumberId: string,
  recipient: string,
  templateName: string,
  language: string,
  parameters: string[],
): Promise<void> {
  if (!/^[a-z0-9_]{1,512}$/.test(templateName)) {
    throw new Error("A valid approved WhatsApp message template name is required.");
  }
  await sendWhatsAppMessage(accessToken, phoneNumberId, recipient, {
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      components: [{
        type: "body",
        parameters: parameters.map((text) => ({ type: "text", text: text.slice(0, 1024) || "-" })),
      }],
    },
  });
}

export function sendWhatsAppText(
  accessToken: string,
  phoneNumberId: string,
  recipient: string,
  text: string,
): Promise<void> {
  return sendWhatsAppMessage(accessToken, phoneNumberId, recipient, {
    type: "text",
    text: { body: text.slice(0, 4096) },
  });
}

export function sendWhatsAppList(
  accessToken: string,
  phoneNumberId: string,
  recipient: string,
  bodyText: string,
  rows: Array<{ id: string; title: string; description?: string }>,
): Promise<void> {
  if (!rows.length || rows.length > 10) throw new Error("A WhatsApp list must contain between 1 and 10 rows.");
  if (rows.some((row) => row.id.length > 200 || row.title.length > 24 || (row.description?.length ?? 0) > 72)) {
    throw new Error("A WhatsApp list row exceeds the provider's supported length.");
  }
  return sendWhatsAppMessage(accessToken, phoneNumberId, recipient, {
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: bodyText.slice(0, 1024) },
      action: {
        button: "Choose an option",
        sections: [{ title: "Menu", rows }],
      },
    },
  });
}
