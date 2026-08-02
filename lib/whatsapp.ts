const GRAPH_API_VERSION = "v21.0";

function apiUrl() {
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
}

async function sendWhatsAppMessage(payload: Record<string, unknown>): Promise<string | null> {
  const res = await fetch(apiUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });

  if (!res.ok) {
    console.error("WhatsApp API error", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  return data?.messages?.[0]?.id ?? null;
}

export function sendWhatsAppText(to: string, body: string) {
  return sendWhatsAppMessage({
    to,
    type: "text",
    text: { body },
  });
}

export interface ListRow {
  id: string;
  title: string;
  description?: string;
}

export interface ListSection {
  title: string;
  rows: ListRow[];
}

export function sendWhatsAppList(
  to: string,
  options: {
    header: string;
    body: string;
    footer: string;
    button: string;
    sections: ListSection[];
  }
) {
  return sendWhatsAppMessage({
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: options.header },
      body: { text: options.body },
      footer: { text: options.footer },
      action: {
        button: options.button,
        sections: options.sections,
      },
    },
  });
}

export interface TemplateSendResult {
  messageId: string | null;
  error?: string;
}

/**
 * Sends an approved WhatsApp template message (used for marketing campaigns).
 * Returns the failure reason (rather than just logging it) so campaign_sends
 * rows can record why a send failed.
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string
): Promise<TemplateSendResult> {
  const res = await fetch(apiUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: templateName, language: { code: languageCode } },
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMessage: string = data?.error?.message ?? `WhatsApp API error (${res.status})`;
    console.error("WhatsApp template send error", res.status, data);
    return { messageId: null, error: errorMessage };
  }

  return { messageId: data?.messages?.[0]?.id ?? null };
}
