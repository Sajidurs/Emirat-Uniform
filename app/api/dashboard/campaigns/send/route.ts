import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-service";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await req.json().catch(() => null);
  const branchId: number | null = payload?.branch_id ?? null;
  const templateId: number | undefined = payload?.template_id;
  const phoneNumbers: string[] | undefined = payload?.phone_numbers;

  if (!templateId || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
    return NextResponse.json(
      { error: "template_id and a non-empty phone_numbers array are required" },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  const { data: template } = await service
    .from("templates")
    .select("id, name, language, status")
    .eq("id", templateId)
    .maybeSingle();

  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  if (template.status !== "approved") {
    return NextResponse.json({ error: "Only approved templates can be used for a campaign" }, { status: 400 });
  }

  const { data: campaign, error: campaignError } = await service
    .from("campaigns")
    .insert({ branch_id: branchId, template_id: templateId })
    .select("id")
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: campaignError?.message ?? "Failed to create campaign" }, { status: 500 });
  }

  const { data: sends, error: sendsError } = await service
    .from("campaign_sends")
    .insert(phoneNumbers.map((phone) => ({ campaign_id: campaign.id, phone_number: phone, status: "queued" })))
    .select("id, phone_number");

  if (sendsError || !sends) {
    return NextResponse.json({ error: sendsError?.message ?? "Failed to queue recipients" }, { status: 500 });
  }

  let sentCount = 0;
  let failedCount = 0;

  // Sent serially to stay well under WhatsApp's per-second rate limits.
  for (const send of sends) {
    const result = await sendWhatsAppTemplate(send.phone_number, template.name, template.language);

    if (result.messageId) {
      sentCount++;
      await service
        .from("campaign_sends")
        .update({ status: "sent", wa_message_id: result.messageId, sent_at: new Date().toISOString() })
        .eq("id", send.id);
    } else {
      failedCount++;
      await service
        .from("campaign_sends")
        .update({ status: "failed", error_reason: result.error ?? "Unknown error" })
        .eq("id", send.id);
    }
  }

  return NextResponse.json({
    campaign_id: campaign.id,
    total: sends.length,
    sent: sentCount,
    failed: failedCount,
  });
}
