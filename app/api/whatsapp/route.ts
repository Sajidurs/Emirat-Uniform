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

// Exact-match (case-insensitive, trimmed) phrases that restart branch selection
// regardless of the customer's current state — including after the
// post-branch-action flow completes (state = 'active').
const BRANCH_CHANGE_TRIGGERS = new Set([
  "change branch",
  "change location",
  "main menu",
  "غير الفرع",
  "غيّر الفرع",
  "تغيير الفرع",
  "تغيير الموقع",
  "القائمة الرئيسية",
]);

function isBranchChangeTrigger(text: string): boolean {
  return BRANCH_CHANGE_TRIGGERS.has(text.trim().toLowerCase());
}

// ---------- Post-branch-selection action menu ----------
// Shown once a branch is confirmed, instead of auto-sending the review link.
// Row titles are English-only: the Arabic phrasing for "Talk to customer
// service" / "Go to main list" both exceed WhatsApp's 24-character row title
// limit, so Arabic goes in the row description (72-char limit) instead —
// every row still shows both languages, just split across title/description
// rather than combined in the title the way the (short) location names are.
type PostBranchAction = "review" | "map" | "service" | "mainlist";

interface PostBranchActionRow {
  id: string;
  action: PostBranchAction;
  titleEn: string;
  descAr: string;
}

const POST_BRANCH_ACTION_ROWS: PostBranchActionRow[] = [
  { id: "postaction_review", action: "review", titleEn: "Submit your review", descAr: "قيّم تجربتك في الفرع" },
  { id: "postaction_map", action: "map", titleEn: "Open the location", descAr: "الذهاب إلى الموقع" },
  {
    id: "postaction_service",
    action: "service",
    titleEn: "Talk to customer service",
    descAr: "التحدث إلى أحد موظفي خدمة العملاء",
  },
  {
    id: "postaction_mainlist",
    action: "mainlist",
    titleEn: "Go to main list",
    descAr: "العودة إلى القائمة الرئيسية",
  },
];

const CUSTOMER_SERVICE_NUMBER = "0509292916";

const CUSTOMER_SERVICE_MESSAGE =
  `يمكنك التواصل مع خدمة العملاء على الرقم ${CUSTOMER_SERVICE_NUMBER}\n` +
  `You can reach our customer service at ${CUSTOMER_SERVICE_NUMBER}`;

const POST_ACTION_CLOSING_MESSAGE =
  "شكراً لزيارتكم! نتطلع لخدمتكم دائماً.\n" +
  "Thank you for your visit! We look forward to serving you again soon.\n\n" +
  "يمكنك كتابة 'تغيير الفرع' لتغيير فرعك، أو 'القائمة الرئيسية' للعودة إلى القائمة في أي وقت.\n" +
  "You can type 'change branch' to switch branches, or 'main menu' to return to the menu anytime.";

/**
 * Resolves a customer's reply at the 'awaiting_post_branch_action' state to
 * one of the 4 menu actions — matching a list_reply id, a numbered text
 * reply ("1".."4" in list order), or the row's own title/description text.
 * Returns null if nothing matches, so the menu can be re-shown.
 */
function resolvePostBranchAction(listReplyId: string | null, inboundBody: string): PostBranchAction | null {
  if (listReplyId) {
    const row = POST_BRANCH_ACTION_ROWS.find((r) => r.id === listReplyId);
    if (row) return row.action;
  }

  const normalized = inboundBody.trim();
  const normalizedLower = normalized.toLowerCase();

  const numberedIndex = ["1", "2", "3", "4"].indexOf(normalized);
  if (numberedIndex !== -1) return POST_BRANCH_ACTION_ROWS[numberedIndex].action;

  const textMatch = POST_BRANCH_ACTION_ROWS.find(
    (r) => r.titleEn.toLowerCase() === normalizedLower || r.descAr === normalized
  );
  return textMatch?.action ?? null;
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
  gmb_map_link: string | null;
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
    await restartToLocationSelection(supabase, phoneNumber);
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

  if (customer.state === "awaiting_post_branch_action") {
    await handlePostBranchAction(supabase, phoneNumber, customer.branch_id, listReply?.id ?? null, inboundBody);
    return;
  }

  // state === "active" (or anything else): hand off to Claude for a brief reply
  await handleActiveConversation(supabase, phoneNumber, inboundBody);
}

/** Sends the location list and moves the customer to 'awaiting_location'. */
async function restartToLocationSelection(supabase: SupabaseClient, phoneNumber: string) {
  await sendLocationList(supabase, phoneNumber);
  await supabase.from("customers").update({ state: "awaiting_location" }).eq("phone_number", phoneNumber);
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
    .select("id, name, gmb_review_link, gmb_map_link")
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
    .select("id, name, gmb_review_link, gmb_map_link")
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
    .select("id, name, gmb_review_link, gmb_map_link")
    .eq("id", branchId)
    .maybeSingle();

  if (!branch) {
    console.warn(`Branch not found for id=${branchId}`);
    await sendGenericError(supabase, phoneNumber);
    return;
  }

  await confirmBranch(supabase, phoneNumber, branch as Branch);
}

/**
 * Branch confirmed: instead of auto-sending the review link, show the
 * post-branch-selection action menu (review / map / customer service / back
 * to main list) and move the customer to 'awaiting_post_branch_action'.
 */
async function confirmBranch(supabase: SupabaseClient, phoneNumber: string, branch: Branch) {
  await supabase
    .from("customers")
    .update({ branch_id: branch.id, state: "awaiting_post_branch_action" })
    .eq("phone_number", phoneNumber);

  await sendPostBranchActionList(supabase, phoneNumber, branch.name);
}

async function sendPostBranchActionList(
  supabase: SupabaseClient,
  phoneNumber: string,
  branchName?: string,
  isRetry = false
) {
  const rows: ListRow[] = POST_BRANCH_ACTION_ROWS.map((r) => ({
    id: r.id,
    title: r.titleEn,
    description: r.descAr,
  }));

  const body =
    !isRetry && branchName
      ? `شكراً لزيارتكم فرع ${branchName}! من فضلك اختر أحد الخيارات التالية.\n` +
        `Thank you for visiting our ${branchName} branch! Please choose one of the following options.`
      : "من فضلك اختر أحد الخيارات من القائمة أدناه.\nPlease select one of the options from the list below.";

  const waMessageId = await sendWhatsAppList(phoneNumber, {
    header: "ماذا تريد أن تفعل؟ / What would you like to do?",
    body,
    footer: BRAND_FOOTER,
    button: SELECT_BUTTON,
    sections: [{ title: "الخيارات / Options", rows }],
  });
  await logMessage(supabase, phoneNumber, "outbound", body, waMessageId);
}

/** Handles a reply while the customer is at 'awaiting_post_branch_action'. */
async function handlePostBranchAction(
  supabase: SupabaseClient,
  phoneNumber: string,
  branchId: number | null,
  listReplyId: string | null,
  inboundBody: string
) {
  const action = resolvePostBranchAction(listReplyId, inboundBody);

  if (!action) {
    await sendPostBranchActionList(supabase, phoneNumber, undefined, true);
    return;
  }

  if (action === "mainlist") {
    // Reuses the exact same restart logic as the "change branch" trigger phrase.
    await restartToLocationSelection(supabase, phoneNumber);
    return;
  }

  if (!branchId) {
    console.warn("Customer reached awaiting_post_branch_action with no branch_id set");
    await sendGenericError(supabase, phoneNumber);
    return;
  }

  const { data: branch } = await supabase
    .from("branches")
    .select("id, name, gmb_review_link, gmb_map_link")
    .eq("id", branchId)
    .maybeSingle();

  if (!branch) {
    console.warn(`Branch not found for id=${branchId}`);
    await sendGenericError(supabase, phoneNumber);
    return;
  }

  const typedBranch = branch as Branch;

  if (action === "review") {
    await sendReviewLink(supabase, phoneNumber, typedBranch);
  } else if (action === "map") {
    await sendMapLink(supabase, phoneNumber, typedBranch);
  } else {
    await sendCustomerServiceInfo(supabase, phoneNumber);
  }

  // Options 1-3 complete the post-branch flow; option 4 (handled above) skips
  // both the 'active' transition and the closing message since it restarts
  // branch selection instead.
  await supabase.from("customers").update({ state: "active" }).eq("phone_number", phoneNumber);
  await sendPostActionClosing(supabase, phoneNumber);
}

async function sendReviewLink(supabase: SupabaseClient, phoneNumber: string, branch: Branch) {
  let text: string;
  if (branch.gmb_review_link) {
    text =
      `تفضل، هذا رابط تقييم فرع ${branch.name} على جوجل.\n\n` +
      `Here's the Google review link for our ${branch.name} branch:\n\n` +
      branch.gmb_review_link;
  } else {
    console.warn(`Branch id=${branch.id} (${branch.name}) has no gmb_review_link set`);
    text =
      "عذراً، رابط التقييم غير متوفر حالياً.\nSorry, the review link isn't available yet.";
  }

  const waMessageId = await sendWhatsAppText(phoneNumber, text);
  await logMessage(supabase, phoneNumber, "outbound", text, waMessageId);
}

async function sendMapLink(supabase: SupabaseClient, phoneNumber: string, branch: Branch) {
  let text: string;
  if (branch.gmb_map_link) {
    text =
      `تفضل، هذا موقع فرع ${branch.name} على الخريطة.\n\n` +
      `Here's the map location for our ${branch.name} branch:\n\n` +
      branch.gmb_map_link;
  } else {
    console.warn(`Branch id=${branch.id} (${branch.name}) has no gmb_map_link set`);
    text =
      "عذراً، رابط الموقع غير متوفر حالياً.\nSorry, the location link isn't available yet.";
  }

  const waMessageId = await sendWhatsAppText(phoneNumber, text);
  await logMessage(supabase, phoneNumber, "outbound", text, waMessageId);
}

async function sendCustomerServiceInfo(supabase: SupabaseClient, phoneNumber: string) {
  const waMessageId = await sendWhatsAppText(phoneNumber, CUSTOMER_SERVICE_MESSAGE);
  await logMessage(supabase, phoneNumber, "outbound", CUSTOMER_SERVICE_MESSAGE, waMessageId);
}

async function sendPostActionClosing(supabase: SupabaseClient, phoneNumber: string) {
  const waMessageId = await sendWhatsAppText(phoneNumber, POST_ACTION_CLOSING_MESSAGE);
  await logMessage(supabase, phoneNumber, "outbound", POST_ACTION_CLOSING_MESSAGE, waMessageId);
}

async function sendGenericError(supabase: SupabaseClient, phoneNumber: string) {
  const text = "عذراً، حدث خطأ. من فضلك حاول مرة أخرى لاحقاً.\nSorry, something went wrong. Please try again later.";
  const waMessageId = await sendWhatsAppText(phoneNumber, text);
  await logMessage(supabase, phoneNumber, "outbound", text, waMessageId);
}

const ACTIVE_STATE_SYSTEM_PROMPT =
  "You are the WhatsApp assistant for Emirat Uniform, a uniform company in the UAE. Your only job " +
  "is helping the customer select their branch and then submit a review, get the branch location, " +
  "or reach customer service — you do not answer product questions, general questions, or anything " +
  "else, even if asked directly. The customer has already completed branch selection and used the " +
  "post-visit options menu. For any message they send now, reply politely explaining that this " +
  "assistant only helps with branch selection and the review/location/customer-service options, " +
  "and remind them they can type \"change branch\" / \"تغيير الفرع\" anytime if they'd like to " +
  "switch branches. Always reply in BOTH Arabic and English together, Arabic first then English — " +
  "every reply must show both languages, regardless of which language the customer wrote in. Keep " +
  "it short, polite, and professional.";

// Used only if the Claude API call itself fails — mirrors the shape Claude is
// instructed to produce, so a fallback message still meets the "always
// bilingual" requirement even when the model can't be reached.
const ACTIVE_STATE_FALLBACK_REPLY =
  "عذرًا، هذا المساعد مخصص فقط لاختيار الفرع وخيارات التقييم والموقع وخدمة العملاء. إذا كنت ترغب " +
  "في تغيير فرعك، يمكنك كتابة 'تغيير الفرع' في أي وقت.\n\n" +
  "Sorry, this assistant is only for branch selection and the review/location/customer-service " +
  "options. If you'd like to change your branch, just type 'change branch' anytime.";

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
