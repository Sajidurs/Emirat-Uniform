import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase-service";
import { ListRow, sendWhatsAppList, sendWhatsAppText } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Location names are stored in English only; these are just display labels
// for the WhatsApp list (Arabic first, English second per prior convention).
const LOCATION_LABELS_AR: Record<string, string> = {
  "Abu Dhabi": "أبوظبي",
  "Al Ain": "العين",
  Dubai: "دبي",
  Sharjah: "الشارقة",
  Ajman: "عجمان",
  RAK: "رأس الخيمة",
  Fujairah: "الفجيرة",
};

const BRAND_FOOTER = "يونيفورم الإمارات / Emirat Uniform";
const SELECT_BUTTON = "اختيار / Select";

// Bilingual hint appended to the branch-confirmation thank-you message.
const BRANCH_CHANGE_HINT =
  "إذا كنت ترغب في تغيير الفرع لاحقًا، اكتب 'تغيير الفرع' في أي وقت.\n" +
  "If you'd like to change your branch later, just type 'change branch' anytime.";

// Exact-match (case-insensitive, trimmed) phrases that restart branch selection
// regardless of the customer's current state.
const BRANCH_CHANGE_TRIGGERS = new Set([
  "change branch",
  "change location",
  "غير الفرع",
  "غيّر الفرع",
  "تغيير الفرع",
  "تغيير الموقع",
]);

function isBranchChangeTrigger(text: string): boolean {
  return BRANCH_CHANGE_TRIGGERS.has(text.trim().toLowerCase());
}

interface Customer {
  phone_number: string;
  name: string | null;
  branch_id: number | null;
  state: string;
}

interface Branch {
  id: number;
  name: string;
  gmb_review_link: string | null;
}

interface WhatsAppMessage {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
  interactive?: {
    type: string;
    list_reply?: { id: string; title: string };
    button_reply?: { id: string; title: string };
  };
}

interface WhatsAppStatus {
  id: string; // wa_message_id of the outbound message this status refers to
  status: "sent" | "delivered" | "read" | "failed";
  errors?: { code?: number; title?: string; message?: string }[];
}

// ---------- GET: Meta webhook verification ----------
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// ---------- POST: incoming messages ----------
export async function POST(req: NextRequest) {
  const supabase = createServiceClient();

  try {
    const payload = await req.json();
    const entries = payload?.entry ?? [];

    for (const entry of entries) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value;

        const messages: WhatsAppMessage[] | undefined = value?.messages;
        if (messages) {
          const contactName: string | null = value?.contacts?.[0]?.profile?.name ?? null;
          for (const message of messages) {
            await handleInboundMessage(supabase, message, contactName);
          }
        }

        const statuses: WhatsAppStatus[] | undefined = value?.statuses;
        if (statuses) {
          for (const status of statuses) {
            await handleStatusUpdate(supabase, status);
          }
        }
      }
    }
  } catch (err) {
    console.error("Error processing WhatsApp webhook", err);
  }

  // Always acknowledge so Meta doesn't retry.
  return NextResponse.json({ status: "ok" });
}

/**
 * WhatsApp delivery status callback (sent/delivered/read/failed) for an
 * outbound message. Only campaign_sends rows carry a wa_message_id, so this
 * only ever updates campaign messages — the bot's own conversational replies
 * have no matching row, and the update below simply affects zero rows.
 */
async function handleStatusUpdate(supabase: SupabaseClient, status: WhatsAppStatus) {
  const updates: Record<string, unknown> = {
    status: status.status,
    updated_at: new Date().toISOString(),
  };

  if (status.status === "failed" && status.errors && status.errors.length > 0) {
    updates.error_reason = status.errors[0].title ?? status.errors[0].message ?? "Unknown error";
  }

  const { error } = await supabase.from("campaign_sends").update(updates).eq("wa_message_id", status.id);

  if (error) {
    console.error("Failed to update campaign_sends from status callback", error);
  }
}

async function handleInboundMessage(
  supabase: SupabaseClient,
  message: WhatsAppMessage,
  contactName: string | null
) {
  const phoneNumber = message.from;
  const waMessageId: string | null = message.id ?? null;

  if (waMessageId) {
    const { data: existing } = await supabase
      .from("messages")
      .select("id")
      .eq("wa_message_id", waMessageId)
      .maybeSingle();
    if (existing) return; // already processed (Meta retry)
  }

  const customer = await upsertCustomer(supabase, phoneNumber, contactName);
  const inboundBody = extractMessageBody(message);
  await logMessage(supabase, phoneNumber, "inbound", inboundBody, waMessageId);

  // A branch-change trigger phrase always restarts branch selection, no
  // matter what state the customer is currently in (mid-selection or
  // already active). Their branch_id is left as-is until the new selection
  // completes and overwrites it — no separate history is kept.
  if (isBranchChangeTrigger(inboundBody)) {
    customer.state = "new";
  }

  const listReply = message.type === "interactive" && message.interactive?.type === "list_reply"
    ? message.interactive.list_reply!
    : null;

  if (customer.state === "new") {
    await sendLocationList(supabase, phoneNumber);
    await supabase.from("customers").update({ state: "awaiting_location" }).eq("phone_number", phoneNumber);
    return;
  }

  if (customer.state === "awaiting_location") {
    if (listReply) {
      await handleLocationSelected(supabase, phoneNumber, listReply.id);
    } else {
      await sendLocationList(supabase, phoneNumber, true);
    }
    return;
  }

  if (customer.state.startsWith("awaiting_branch:")) {
    if (listReply) {
      await handleBranchSelected(supabase, phoneNumber, listReply.id);
    } else {
      const locationId = Number(customer.state.split(":")[1]);
      await sendBranchListForLocation(supabase, phoneNumber, locationId, true);
    }
    return;
  }

  // state === "active" (or anything else): hand off to Claude for a brief reply
  await handleActiveConversation(supabase, phoneNumber, inboundBody);
}

function extractMessageBody(message: WhatsAppMessage): string {
  if (message.type === "text") return message.text?.body ?? "";
  if (message.type === "interactive") {
    if (message.interactive?.list_reply) return message.interactive.list_reply.title;
    if (message.interactive?.button_reply) return message.interactive.button_reply.title;
  }
  return `[${message.type}]`;
}

async function upsertCustomer(
  supabase: SupabaseClient,
  phoneNumber: string,
  contactName: string | null
): Promise<Customer> {
  const { data: existing } = await supabase
    .from("customers")
    .select("phone_number, name, branch_id, state")
    .eq("phone_number", phoneNumber)
    .maybeSingle();

  if (existing) {
    const updates: Record<string, unknown> = { last_seen: new Date().toISOString() };
    if (!existing.name && contactName) updates.name = contactName;
    await supabase.from("customers").update(updates).eq("phone_number", phoneNumber);
    return { ...existing, name: (updates.name as string | undefined) ?? existing.name };
  }

  const { data: created } = await supabase
    .from("customers")
    .insert({ phone_number: phoneNumber, name: contactName, state: "new" })
    .select("phone_number, name, branch_id, state")
    .single();

  return created as Customer;
}

async function logMessage(
  supabase: SupabaseClient,
  phoneNumber: string,
  direction: "inbound" | "outbound",
  body: string | null,
  waMessageId: string | null
) {
  await supabase.from("messages").insert({
    phone_number: phoneNumber,
    direction,
    body,
    wa_message_id: waMessageId,
  });
}

async function sendLocationList(supabase: SupabaseClient, phoneNumber: string, isRetry = false) {
  const { data: locations } = await supabase.from("locations").select("id, name").order("id");

  const rows: ListRow[] = (locations ?? []).map((loc: { id: number; name: string }) => ({
    id: `loc_${loc.id}`,
    title: LOCATION_LABELS_AR[loc.name] ? `${LOCATION_LABELS_AR[loc.name]} / ${loc.name}` : loc.name,
  }));

  const body = isRetry
    ? "من فضلك اختر أحد الخيارات من القائمة أدناه.\nPlease select one of the options from the list below."
    : "أهلاً بك! من فضلك اختر الموقع الذي تتواجد فيه الآن.\nWelcome! Please select the location you're currently at.";

  const waMessageId = await sendWhatsAppList(phoneNumber, {
    header: "اختر الموقع / Choose Location",
    body,
    footer: BRAND_FOOTER,
    button: SELECT_BUTTON,
    sections: [{ title: "المواقع / Locations", rows }],
  });
  await logMessage(supabase, phoneNumber, "outbound", body, waMessageId);
}

async function handleLocationSelected(supabase: SupabaseClient, phoneNumber: string, listReplyId: string) {
  const locationId = Number(listReplyId.replace("loc_", ""));

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, gmb_review_link")
    .eq("location_id", locationId);

  if (!branches || branches.length === 0) {
    console.warn(`No branches found for location_id=${locationId}`);
    await sendGenericError(supabase, phoneNumber);
    return;
  }

  if (branches.length === 1) {
    await confirmBranch(supabase, phoneNumber, branches[0] as Branch);
    return;
  }

  await sendBranchList(supabase, phoneNumber, branches as Branch[]);
  await supabase.from("customers").update({ state: `awaiting_branch:${locationId}` }).eq("phone_number", phoneNumber);
}

async function sendBranchListForLocation(
  supabase: SupabaseClient,
  phoneNumber: string,
  locationId: number,
  isRetry: boolean
) {
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, gmb_review_link")
    .eq("location_id", locationId);

  if (!branches || branches.length === 0) {
    console.warn(`No branches found for location_id=${locationId}`);
    await sendGenericError(supabase, phoneNumber);
    return;
  }

  await sendBranchList(supabase, phoneNumber, branches as Branch[], isRetry);
}

async function sendBranchList(
  supabase: SupabaseClient,
  phoneNumber: string,
  branches: Branch[],
  isRetry = false
) {
  const rows: ListRow[] = branches.map((b) => ({ id: `branch_${b.id}`, title: b.name }));

  const body = isRetry
    ? "من فضلك اختر أحد الخيارات من القائمة أدناه.\nPlease select one of the options from the list below."
    : "من فضلك اختر الفرع الذي تتواجد فيه.\nPlease select your branch.";

  const waMessageId = await sendWhatsAppList(phoneNumber, {
    header: "اختر الفرع / Choose Branch",
    body,
    footer: BRAND_FOOTER,
    button: SELECT_BUTTON,
    sections: [{ title: "الفروع / Branches", rows }],
  });
  await logMessage(supabase, phoneNumber, "outbound", body, waMessageId);
}

async function handleBranchSelected(supabase: SupabaseClient, phoneNumber: string, listReplyId: string) {
  const branchId = Number(listReplyId.replace("branch_", ""));

  const { data: branch } = await supabase
    .from("branches")
    .select("id, name, gmb_review_link")
    .eq("id", branchId)
    .maybeSingle();

  if (!branch) {
    console.warn(`Branch not found for id=${branchId}`);
    await sendGenericError(supabase, phoneNumber);
    return;
  }

  await confirmBranch(supabase, phoneNumber, branch as Branch);
}

async function confirmBranch(supabase: SupabaseClient, phoneNumber: string, branch: Branch) {
  await supabase.from("customers").update({ branch_id: branch.id, state: "active" }).eq("phone_number", phoneNumber);

  let text: string;
  if (branch.gmb_review_link) {
    text =
      `شكراً لزيارتكم فرع ${branch.name}! نقدّر تقييمكم لنا.\n\n` +
      `Thank you for visiting our ${branch.name} branch! We'd love it if you could leave us a review:\n\n` +
      `${branch.gmb_review_link}\n\n` +
      BRANCH_CHANGE_HINT;
  } else {
    console.warn(`Branch id=${branch.id} (${branch.name}) has no gmb_review_link set`);
    text =
      `شكراً لزيارتكم فرع ${branch.name}! نقدّر ثقتكم بنا.\n\n` +
      `Thank you for visiting our ${branch.name} branch! We appreciate your trust in us.\n\n` +
      BRANCH_CHANGE_HINT;
  }

  const waMessageId = await sendWhatsAppText(phoneNumber, text);
  await logMessage(supabase, phoneNumber, "outbound", text, waMessageId);
}

async function sendGenericError(supabase: SupabaseClient, phoneNumber: string) {
  const text = "عذراً، حدث خطأ. من فضلك حاول مرة أخرى لاحقاً.\nSorry, something went wrong. Please try again later.";
  const waMessageId = await sendWhatsAppText(phoneNumber, text);
  await logMessage(supabase, phoneNumber, "outbound", text, waMessageId);
}

const ACTIVE_STATE_SYSTEM_PROMPT =
  "You are the WhatsApp assistant for Emirat Uniform, a uniform company in the UAE. Your only job " +
  "is helping the customer select their branch and sending them the Google review link — you do " +
  "not answer product questions, general questions, or anything else, even if asked directly. " +
  "The customer has already completed branch selection and received their review link. For any " +
  "message they send now, reply politely explaining that this assistant only helps with selecting " +
  "a branch and sending the Google review link, and remind them they can type \"change branch\" / " +
  "\"تغيير الفرع\" anytime if they'd like to switch branches. Always reply in BOTH Arabic and " +
  "English together, Arabic first then English — every reply must show both languages, regardless " +
  "of which language the customer wrote in. Keep it short, polite, and professional.";

// Used only if the Claude API call itself fails — mirrors the shape Claude is
// instructed to produce, so a fallback message still meets the "always
// bilingual" requirement even when the model can't be reached.
const ACTIVE_STATE_FALLBACK_REPLY =
  "عذرًا، هذا المساعد مخصص فقط لاختيار الفرع وإرسال رابط تقييم جوجل. إذا كنت ترغب في تغيير فرعك، " +
  "يمكنك كتابة 'تغيير الفرع' في أي وقت.\n\n" +
  "Sorry, this assistant is only for selecting your branch and sending the Google review link. " +
  "If you'd like to change your branch, just type 'change branch' anytime.";

async function handleActiveConversation(supabase: SupabaseClient, phoneNumber: string, inboundBody: string) {
  let replyText = ACTIVE_STATE_FALLBACK_REPLY;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 250,
      thinking: { type: "disabled" },
      system: ACTIVE_STATE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: inboundBody || "(no text)" }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (textBlock && textBlock.type === "text") {
      replyText = textBlock.text;
    }
  } catch (err) {
    console.error("Claude API error while replying to active-state customer", err);
  }

  const waMessageId = await sendWhatsAppText(phoneNumber, replyText);
  await logMessage(supabase, phoneNumber, "outbound", replyText, waMessageId);
}
