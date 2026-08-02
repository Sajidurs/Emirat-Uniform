const GRAPH_API_VERSION = "v21.0";

export type TemplateStatus = "pending" | "approved" | "rejected";

function sanitizeTemplateName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function mapMetaStatus(metaStatus: string | undefined): TemplateStatus {
  switch ((metaStatus ?? "").toUpperCase()) {
    case "APPROVED":
      return "approved";
    case "REJECTED":
      return "rejected";
    default:
      return "pending";
  }
}

export interface CreateMetaTemplateResult {
  metaTemplateId: string | null;
  metaName: string;
  status: TemplateStatus;
  error?: string;
}

/** Submits a new template to Meta's Template Management API for approval. */
export async function createMetaTemplate(options: {
  name: string;
  body: string;
  category: "marketing" | "utility";
  language: string;
}): Promise<CreateMetaTemplateResult> {
  const metaName = sanitizeTemplateName(options.name);
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${process.env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: metaName,
      language: options.language,
      category: options.category.toUpperCase(),
      components: [{ type: "BODY", text: options.body }],
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      metaTemplateId: null,
      metaName,
      status: "pending",
      error: data?.error?.message ?? `Meta API error (${res.status})`,
    };
  }

  return {
    metaTemplateId: data.id ?? null,
    metaName,
    status: mapMetaStatus(data.status),
  };
}

/** Re-checks a template's approval status from Meta by its Meta template id. */
export async function getMetaTemplateStatus(
  metaTemplateId: string
): Promise<{ status: TemplateStatus; error?: string }> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${metaTemplateId}?fields=status`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return { status: "pending", error: data?.error?.message ?? `Meta API error (${res.status})` };
  }

  return { status: mapMetaStatus(data.status) };
}
