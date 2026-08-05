# Project Log — Emirat Uniform WhatsApp Bot

## What this project is
A WhatsApp bot for Emirat Uniform, a UAE uniform company with 13 branches across 7 locations
(Abu Dhabi, Al Ain, Dubai, Sharjah, Ajman, RAK, Fujairah). Customers scan a single shared
WhatsApp QR code in-branch, are asked which location and branch they're at, have their
name/phone/branch saved as a lead, and are then shown a post-visit menu (submit a Google review,
open the branch's map location, talk to customer service, or go back to the main location list).
Separately, an admin dashboard lets staff filter leads by branch, send WhatsApp marketing
campaigns using Meta-approved templates, submit new templates for Meta approval, and view
per-campaign delivery statistics (sent, delivered, failed, failure reasons).

## Current status
Admin dashboard is built and restyled with a soft/premium visual design (Conversations, Leads,
Campaigns, Sidebar). Verified live in a real browser against the actual Supabase project — the
schema, RLS, and seed data are confirmed already applied (Conversations/Leads correctly show real
captured leads from live WhatsApp conversations), and a dashboard user can sign in successfully.
The earlier "nothing run yet" status in this log was stale as of this check. The webhook now also
supports a "change branch" trigger phrase (any state, any time) and a stricter bilingual-only
fallback for off-topic messages from active customers. Conversations page is now a proper
WhatsApp-Web-style two-pane layout (list always visible, thread scrolls independently).
Template creation now fails loudly with a clear error if WHATSAPP_BUSINESS_ACCOUNT_ID is unset,
instead of silently building a broken Meta API URL — see the debugging notes in the change
history below if template creation still errors after checking this. Branch confirmation no
longer auto-sends the review link — it now shows a 4-option post-visit menu (review / map /
customer service / back to main list) via a new 'awaiting_post_branch_action' customer state.
A "main menu" / "القائمة الرئيسية" trigger phrase now also restarts branch selection from any
state (alongside "change branch" / "تغيير الفرع"), and the post-visit closing message and the
general 'active'-state Claude fallback (prompt + failure-fallback reply) all mention both.
The dashboard now has the real Emirat Uniform logo (sidebar + login page), and the login page's
invisible-input-text bug is fixed. 'active' customers can also now ask for the review link, map
link, or customer service in plain language (any time, even in a brand new session), not just via
the post-branch-selection button menu — "help"/"مساعدة" now also routes to customer service, and
the Claude fallback for genuinely open-ended messages (identity questions, out-of-scope questions,
small talk) gives real, helpful, bilingual answers instead of a repeated scripted refusal. That
fallback prompt now also carries the live branch/location structure (queried fresh each time, not
hardcoded), so it can accurately answer "how many branches do you have" / "how many in Al Ain".

## Architecture
- Next.js App Router + Vercel
- Supabase (Postgres) for data
- Claude API for conversation handling during branch selection only
- WhatsApp Cloud API (Meta) for messaging
- No human handoff, no image handling, no product catalog — this bot is lead capture + review collection + campaign sending only

## Change history

### 2026-08-05 — Live branch/location structure in the Claude fallback prompt
- What changed: Added buildLocationBranchSummary(supabase) — queries locations and branches
  (two lightweight unfiltered `select`s, run in parallel) and formats them into the exact
  "Emirat Uniform has N locations... - Location: N branches (Name1, Name2, ...)" structure block.
  Queried live rather than hardcoded: this data changes rarely, but the supabase client is already
  threaded through this entire call chain, so refreshing it per fallback call costs one cheap
  round trip and can never silently drift from the real branches table the way a hardcoded copy
  could if a branch is added or removed later. Converted ACTIVE_STATE_SYSTEM_PROMPT from a static
  constant to buildActiveStateSystemPrompt(locationBranchSummary) — a function that splices the
  live summary into the prompt — and handleActiveConversation() now calls
  buildLocationBranchSummary() inside its existing try/catch (a DB failure there falls back to
  ACTIVE_STATE_FALLBACK_REPLY exactly like a Claude API failure already did). Removed the old
  hardcoded "13 branches across the UAE (Abu Dhabi, Al Ain, ...)" from the prompt's opening
  sentence, since the live structure block now supersedes it as the single source of truth — kept
  both in sync would otherwise mean two places to update. The DB stores the Ras Al Khaimah
  location's name as the abbreviation "RAK" (see LOCATION_LABELS_AR); added a small
  LOCATION_DISPLAY_NAME_EN lookup so Claude sees the friendly full name instead. Added explicit
  prompt instructions: answer branch count/listing questions directly and accurately from the
  structure block, list a specific location's branches by name when asked, and never invent or
  guess names/addresses/counts beyond what's listed.
- Why: Customers asking "how many branches do you have" or "how many branches in Al Ain" need an
  accurate answer sourced from real data, not a plausible-sounding guess — and querying live means
  this stays correct automatically if branches are ever added or removed, with no second place in
  the codebase to remember to update.
- How it was verified: `tsc --noEmit`, `eslint app/api/whatsapp/route.ts`, and `next build` all
  clean. Ran buildLocationBranchSummary() against the real live Supabase project (not a mock) and
  confirmed the generated text matches this task's example structure exactly, character for
  character (7 locations, 13 branches, correct names and order, "Ras Al Khaimah" not "RAK"). Then
  made real Claude API calls with the generated summary spliced into the actual prompt-building
  function and asked "how many branches do you have", "how many branches in Al Ain", "what
  locations are you in", and "do you have a branch in Fujairah" — every answer was accurate
  (correct counts and branch names pulled from the injected structure, not invented) and bilingual.
- Files touched: app/api/whatsapp/route.ts, PROJECT_LOG.md

### 2026-08-05 — "help" as a service intent + a Claude fallback that can actually converse
- What changed:
  - Added "help", "need help", "مساعدة", "أحتاج مساعدة" to ACTIVE_INTENT_KEYWORDS' `service`
    bucket in resolveActiveStateIntent(), alongside the existing "customer service"/"talk to
    someone"/"support"/"خدمة العملاء"/"الدعم" — these now route straight to
    sendCustomerServiceInfo() instead of falling through to Claude.
  - Rewrote ACTIVE_STATE_SYSTEM_PROMPT with real company context (Emirat Uniform, uniform
    supplier, 13 branches across the 7 named UAE locations) and explicit per-situation guidance
    instead of one blanket "only helps with X, refuse everything else" instruction: identity
    questions ("who are you") get answered naturally; clearly out-of-scope questions (products,
    prices, sizes, stock) get a polite "don't have that info" plus the customer service number
    given directly in the same reply (not just "type customer service"); wanting to switch
    branches still points at "change branch"/"main menu"; greetings/small talk/anything else get
    a warm, natural reply instead of a repeated scripted refusal. Still always bilingual (Arabic
    first, English second) and kept short.
  - Reworded ACTIVE_STATE_FALLBACK_REPLY (used only if the Claude API call itself fails) to be
    warmer — still a single fixed bilingual string since there's no model to reason with there,
    but it now opens like a helpful assistant introducing itself rather than a flat refusal.
- Why: Customers naturally say "help" when they want customer service, and repeatedly hitting a
  scripted "Sorry, I can only help with X" refusal for ordinary messages like "who are you" or
  "hi" reads as broken rather than narrow-but-polite. The goal was a bot that feels like a
  knowledgeable assistant with a narrow job, not one that can only recite one sentence.
- How it was verified: `tsc --noEmit`, `eslint app/api/whatsapp/route.ts`, and `next build` all
  clean. Unit-tested resolveActiveStateIntent() in isolation for the new "help" keywords plus a
  regression check on the existing review/map intents — all passed. The system prompt itself is
  non-deterministic prompt text with nothing to unit-test, so — since this doesn't touch WhatsApp
  or customer data, unlike a live webhook payload — made real Claude API calls (same model,
  max_tokens, thinking:disabled as production) with 6 representative messages ("who are you",
  "what is this", "hi", "do you have size L in stock", "how much does a uniform cost", random
  spam text) and inspected the actual replies: identity questions got natural bilingual answers
  (no refusal), both out-of-scope product/price questions got a polite "don't have that info"
  reply with the customer service number included directly in the text, the greeting got a warm
  offer to help, and the spam message got a polite clarification request pointing at "change
  branch"/"main menu" rather than a scripted refusal — every reply was bilingual (Arabic +
  English both present).
- Files touched: app/api/whatsapp/route.ts, PROJECT_LOG.md

### 2026-08-05 — Plain-language intent recognition for 'active' customers
- What changed: Added resolveActiveStateIntent() — checked at the top of handleActiveConversation()
  (the function that runs whenever a customer is 'active' and their message didn't match the
  branch-change trigger phrases), before falling through to the Claude fallback. Uses substring
  keyword matching (not exact-match like BRANCH_CHANGE_TRIGGERS or resolvePostBranchAction), since
  these need to be recognized inside free-form sentences like "send me the location", not just
  as a whole-message match: review → "review"/"rate"/"feedback"/"تقييم"/"مراجعة"; map →
  "location"/"map"/"address"/"directions"/"موقع"/"خريطة"/"عنوان"; customer service →
  "customer service"/"talk to someone"/"support"/"خدمة العملاء"/"الدعم". A match calls a new
  handleActiveStateIntent(), which reuses the exact same sendReviewLink()/sendMapLink()/
  sendCustomerServiceInfo() helpers already used by the post-branch-action menu (options 1-3) —
  just reached via keyword match instead of a list_reply tap — then sends a new, shorter closing
  hint (ACTIVE_INTENT_CHANGE_BRANCH_HINT: "لتغيير الفرع، اكتب 'تغيير الفرع' أو 'القائمة
  الرئيسية'." / "To change your branch, type 'change branch' or 'main menu'." — distinct wording
  from POST_ACTION_CLOSING_MESSAGE, which follows the full menu rather than a one-off request).
  No match falls through to ACTIVE_STATE_FALLBACK_REPLY / Claude exactly as before. Chose keyword
  matching over a Claude classification call: this codebase already has two deterministic matchers
  for actionable intents (BRANCH_CHANGE_TRIGGERS, resolvePostBranchAction) and reserves Claude only
  for genuinely open-ended replies with no defined action — a classification call would add
  latency, cost, and a new failure mode for something that should behave deterministically.
  "Change branch" / "main menu" needed no new code: isBranchChangeTrigger() already runs
  unconditionally before all state routing, so those triggers already take priority over the new
  intent check simply by running first in handleInboundMessage().
- Why: Customers expect to ask in plain language whenever they want their review link, directions,
  or customer service — not just in the narrow window right after selecting their branch. Before
  this change, typing "how do I leave a review" a day later (or in a new session) fell through to
  the generic "this assistant only helps with branch selection..." Claude fallback instead of
  actually fulfilling the request.
- How it was verified: `tsc --noEmit`, `eslint app/api/whatsapp/route.ts`, and `next build` all
  clean. As with the earlier trigger-phrase and duplicate-link fixes, did not fire a live webhook
  payload (real WhatsApp/Meta side effects) — unit-tested resolveActiveStateIntent() in isolation
  against all of this task's example phrases in both languages, plus unrelated/empty-message
  non-matches — all 18 cases passed.
- Files touched: app/api/whatsapp/route.ts, PROJECT_LOG.md

### 2026-08-05 — Login input contrast fix + dashboard logo
- What changed:
  - Fixed invisible text in the /login email and password inputs: neither `<input>` had an
    explicit text color, so both inherited `color: var(--foreground)` from `body` in
    globals.css — `#ededed` (near-white) whenever the browser/OS is in dark mode — rendered
    against the input's default white background, making typed text unreadable. Added explicit
    `bg-white text-gray-900 placeholder:text-gray-400` to both inputs, matching this page's
    existing (gray-based) local color scheme.
  - Added the real Emirat Uniform logo, provided as a WhatsApp-shared image. The chat message
    embedded the image inline but left its actual file path as an unfilled placeholder; located
    the real files on disk via their recent modification time (Downloads\WhatsApp_Image_...
    -removebg-preview.png and the "(1)" variant — both already background-removed with alpha
    transparency, confirmed via direct PNG header inspection) and visually matched them against
    the image shown in chat before using them. Copied the compact icon-only mark (160x171,
    no wordmark) to public/logo-mark.png for the sidebar, and the full mark-plus-wordmark version
    (589x424, "EMIRATES UNIFORM / Uniform&Scrubs") to public/logo-full.png for the login page.
    Used next/image (not a raw `<img>`, consistent with this project's eslint-config-next
    core-web-vitals rule) in both components/dashboard/Sidebar.tsx (replaces the old indigo "E"
    monogram square, kept the "Emirat Uniform" text label alongside it, `alt=""` since the
    adjacent text already conveys the same information) and app/login/page.tsx (added above the
    existing "Emirat Uniform" heading, `h-20` centered, `priority` since it's likely the largest
    above-the-fold element on that page).
- Why: user-reported bug (unreadable login text) plus a branding ask (real logo instead of a
  placeholder monogram) to be applied without touching any other styling or functionality.
- How it was verified: `tsc --noEmit`, `eslint`, and `next build` all clean. Given this is a
  visual bug fix + a visual asset addition — exactly the kind of change static analysis can't
  confirm — verified live in a real browser (temporary Supabase Auth user + Playwright, same
  transient-install approach as prior UI verifications, cleaned up afterward): typed real text
  into both login fields and confirmed via `getComputedStyle` that the rendered color is a very
  dark near-black against a white background (not just eyeballing a screenshot), then logged in
  and confirmed the sidebar logo renders at a small, proportional size (160x171 natural →
  30x32 rendered) next to real production conversation data, with zero browser console errors.
- Files touched: app/login/page.tsx, components/dashboard/Sidebar.tsx, public/logo-mark.png (new),
  public/logo-full.png (new), PROJECT_LOG.md

### 2026-08-02 — Mention "main menu" in the general active-state Claude fallback too
- What changed: ACTIVE_STATE_SYSTEM_PROMPT and ACTIVE_STATE_FALLBACK_REPLY (used for any
  off-topic message once a customer is fully 'active', as opposed to the post-visit closing
  message from the previous change) previously only told the customer they could type "change
  branch" / "تغيير الفرع". Both now also mention "main menu" / "القائمة الرئيسية": the system
  prompt instructs Claude to remind customers of both options ("...to switch branches, or 'main
  menu' / 'القائمة الرئيسية' to see their options again"), and the static failure-fallback reply
  (used only if the Claude API call itself errors) carries the same two-option wording directly
  in both languages, Arabic first.
- Why: The "main menu" trigger phrase was added in the previous change, but the two places that
  actually tell a customer what commands exist — the system prompt guiding Claude's replies, and
  the hardcoded fallback used when Claude is unreachable — still only advertised "change branch",
  so customers reaching the general active state had no way to learn about "main menu" unless
  they already knew about the post-visit closing message.
- How it was verified: `tsc --noEmit`, `eslint app/api/whatsapp/route.ts`, and `next build` all
  clean. This is prompt/copy text with no branching logic, so there's nothing meaningful to unit
  test in isolation the way the earlier trigger-phrase and duplicate-link fixes were — verified
  by reading the concatenated string output directly to confirm correct spacing/grammar and that
  both languages carry the same two-option meaning.
- Files touched: app/api/whatsapp/route.ts, PROJECT_LOG.md

### 2026-08-02 — Fix duplicate link bug + add "main menu" trigger phrase
- What changed:
  - Fixed sendReviewLink(): gmb_review_link was being interpolated into both the Arabic line and
    the English line (the same duplication bug pattern seen earlier with the branch-confirmation
    message) — restructured to a single shared link placed once, after both language lines.
  - While fixing that, found and fixed the identical bug in sendMapLink() (not explicitly
    reported, but the same copy-pasted pattern with gmb_map_link) — same fix applied there too.
  - Added "main menu" and "القائمة الرئيسية" to BRANCH_CHANGE_TRIGGERS. Since
    isBranchChangeTrigger() already runs unconditionally before the customer.state routing chain
    in handleInboundMessage() (existing behavior, unchanged), this required no other code
    changes — the new phrases restart branch selection from any state, including 'active', for
    free.
  - Updated POST_ACTION_CLOSING_MESSAGE (sent after post-visit options 1-3) to add a bilingual
    line pointing at both restart phrases: "يمكنك كتابة 'تغيير الفرع' لتغيير فرعك، أو 'القائمة
    الرئيسية' للعودة إلى القائمة في أي وقت." / "You can type 'change branch' to switch branches,
    or 'main menu' to return to the menu anytime."
- Why: The review link (and map link) were unintentionally sent twice in one message; and
  customers had no worded way back to the main menu after finishing the post-visit flow other
  than "change branch", which restarts branch selection but doesn't read as "go to the menu."
- How it was verified: `tsc --noEmit`, `eslint app/api/whatsapp/route.ts`, and `next build` all
  clean. Confirmed by grep that gmb_review_link and gmb_map_link each now appear exactly once in
  their respective message-building code. Re-ran the isolated trigger-phrase unit test (same
  approach as the earlier "change branch" change — no live webhook payload, since that would hit
  the real WhatsApp/Meta API) with the two new phrases added: exact match, case-insensitivity,
  trimming, and non-matches ("main menu please") all passed.
- Files touched: app/api/whatsapp/route.ts, PROJECT_LOG.md

### 2026-08-02 — Post-branch-selection action menu (review / map / customer service / main list)
- What changed:
  - Branch confirmation (confirmBranch()) no longer auto-sends the thank-you + review link.
    Instead it moves the customer to a new state, 'awaiting_post_branch_action', and sends a
    bilingual 4-option interactive list (sendPostBranchActionList()): "Submit your review" /
    قيّم تجربتك في الفرع, "Open the location" / الذهاب إلى الموقع, "Talk to customer service" /
    التحدث إلى أحد موظفي خدمة العملاء, "Go to main list" / العودة إلى القائمة الرئيسية. Row
    titles are English (WhatsApp's 24-char row title limit is too tight for the "customer
    service" and "main list" Arabic phrasing — both run ~27-33 chars), with the Arabic phrasing
    in each row's description (72-char limit, plenty of room) — noted in a code comment since
    it's the one place in this file where a row doesn't show combined "Arabic / English" in the
    title itself.
  - Added a new branches.gmb_map_link column (nullable text, same pattern as gmb_review_link) —
    updated supabase/schema.sql for reference; left NULL for all 13 branches, to be filled in
    later. Since schema.sql isn't being re-run against the live DB for this change, the exact
    `alter table branches add column if not exists gmb_map_link text;` was provided separately
    for manual application.
  - handleInboundMessage() routes the 'awaiting_post_branch_action' state to a new
    handlePostBranchAction(), which resolves the reply via resolvePostBranchAction() — matching
    a list_reply id, a numbered text reply ("1"-"4" in list order), or the row's own title/
    description text (case-insensitive for the English title). An unresolved reply re-shows the
    same 4-option list rather than falling through to the Claude fallback, matching the existing
    resend-on-unclear-reply pattern already used for the location/branch lists.
  - Option 1 sends the branch's gmb_review_link (or a polite "not available yet" message if
    NULL, same pattern as the old review-link fallback). Option 2 sends gmb_map_link the same
    way. Option 3 sends a fixed bilingual message with a hardcoded customer service number
    (0509292916, a constant — same number for every branch, not a database column). Options 1-3
    all then set state='active' and send the fixed bilingual closing message ("شكراً لزيارتكم! ..."
    / "Thank you for your visit! ..."). Option 4 ("Go to main list") does not get the closing
    message and does not transition to 'active' — it calls a new restartToLocationSelection()
    helper (extracted from the former inline 'new'-state handling in handleInboundMessage) that
    is now shared verbatim between the 'new'-state branch, the "change branch" trigger phrase
    path, and this option — genuinely the same code, not just similar logic.
  - Removed the now-unused BRANCH_CHANGE_HINT constant (its only call site, the old
    confirmBranch() thank-you message, no longer exists). Updated ACTIVE_STATE_SYSTEM_PROMPT and
    ACTIVE_STATE_FALLBACK_REPLY's wording, since they previously assumed the customer "already...
    received their review link" — no longer reliably true now that review/map/service are
    separate menu choices; reworded to reference the post-visit options menu generally instead.
- Why: Customers were being auto-sent the Google review link immediately after branch selection
  with no other options; the new menu lets them also get directions, reach customer service, or
  restart branch selection, without changing anything about how branch selection itself works.
- How it was verified: `tsc --noEmit`, `eslint app/api/whatsapp/route.ts`, and `next build` all
  clean. As with the earlier branch-change-trigger change, did not fire a live webhook payload
  end-to-end (would call the real WhatsApp/Meta API with real side effects). Instead unit-tested
  resolvePostBranchAction()'s matching logic in isolation — list_reply ids, numbered replies
  ("1"-"4", including with stray whitespace), case-insensitive English title matches, exact
  Arabic description matches, and non-matches (unrelated text, empty string, out-of-range number,
  unrecognized list_reply id) — all 17 cases passed.
- Files touched: app/api/whatsapp/route.ts, supabase/schema.sql, PROJECT_LOG.md

### 2026-08-02 — Debug: template creation "Object with ID 'undefined' does not exist"
- What was checked: (1) app/api/dashboard/templates/create/route.ts and lib/meta-templates.ts
  both read `process.env.WHATSAPP_BUSINESS_ACCOUNT_ID` — exact name, no typo. (2) There is no
  centralized required-env-vars validation/schema anywhere in this project (grepped for
  `env*.ts`/similar — only node_modules matches) — this project has never had one, so there was
  nothing pre-existing to have missed adding this var to. (3) Actually ran this project's real
  `.env.local` through Next.js's own env loader (`@next/env`'s `loadEnvConfig`, the exact function
  `next dev` calls) in a standalone script: it resolved `WHATSAPP_BUSINESS_ACCOUNT_ID` correctly
  as a clean 16-character string with no stray whitespace. So as configured right now, a freshly
  started `next dev` process reading this exact file would not produce `undefined` — the bug, if
  still reproducible, points at either (a) a stale `next dev` process from before the env change
  still running/listening (a `restart` that didn't actually kill the old process is the most
  common cause of exactly this symptom), or (b) this was hit against a deployed environment
  (Vercel) rather than local dev — `.env.local` is gitignored and never deployed, so a var added
  there doesn't exist in production until it's also added to the platform's own environment
  variable settings.
- Found and fixed along the way: README.md's setup and deploy steps both referenced
  `.env.local.example`, which was deleted from this repo during the initial dashboard build
  (2026-08-02 admin dashboard entry, below) and never recreated — anyone deploying by following
  the README's step 7 literally had no file to read variables from, which is exactly the kind of
  gap that lets a newly-added var like `WHATSAPP_BUSINESS_ACCOUNT_ID` go unset on a deployment
  platform. Updated both steps to point at the (already-accurate) variable table in step 2
  instead, and added an explicit note to double-check Vercel's env settings whenever a new
  variable is added locally.
- What changed in code: createMetaTemplate() in lib/meta-templates.ts now reads
  `WHATSAPP_BUSINESS_ACCOUNT_ID` into a local `businessAccountId` variable, logs it via
  `console.log` (using `JSON.stringify` rather than a template literal, so a missing var prints
  as `undefined` and any stray leading/trailing whitespace would show up as visible quoted spaces)
  immediately before building the Meta API URL, and — if it's falsy — returns immediately with a
  clear `error` message instead of proceeding to call `fetch()` against a URL containing the
  literal string "undefined". This turns a confusing Meta-side "Object with ID 'undefined' does
  not exist" response into an immediate, unambiguous server-side error naming the actual missing
  variable.
- Files touched: lib/meta-templates.ts, README.md, PROJECT_LOG.md

### 2026-08-02 — Conversations page: WhatsApp-Web-style fixed two-pane layout
- What changed: /dashboard/conversations was two independent routes (the list page and the
  [phone] detail page) — opening a conversation navigated away from the list entirely, so the
  list wasn't a sidebar at all, it just scrolled/disappeared along with the rest of the page.
  Restructured as a nested layout: app/dashboard/conversations/layout.tsx now server-fetches the
  customer list once and renders it as a persistent left column (new
  components/dashboard/ConversationsList.tsx, a client component using usePathname to highlight
  the open conversation) alongside {children} as the right column — both routes
  (app/dashboard/conversations/page.tsx, now just a "select a conversation" EmptyState, and
  app/dashboard/conversations/[phone]/page.tsx) render only inside that right column, so the list
  never unmounts when navigating between conversations. The layout's outer container is sized
  `h-[calc(100vh-3.5rem)]` — matching the dashboard shell's `<main>` vertical padding (py-7 ×
  2 = 3.5rem) exactly — so the panel always fits the visible viewport and `<main>` itself never
  needs to scroll; the list column and the message-thread column each get their own
  `overflow-y-auto` (with `min-h-0` on their flex containers, required for the scroll regions to
  actually engage instead of growing to fit content). Within the thread column, the customer info
  header is `shrink-0` (stays pinned) and only the messages below it scroll — matching WhatsApp
  Web's split more closely than a plain two-column scroll would. Removed the now-redundant "Back
  to conversations" link from the detail page, since the list is always visible.
- Why: The user reported the conversation list disappearing/scrolling away when a thread was
  opened, instead of behaving like a standard two-pane inbox (WhatsApp Web / Slack) where the
  list stays put and only the open thread scrolls.
- How it was verified: `tsc --noEmit`, `eslint .`, and `next build` all clean. Since this is a
  scroll/layout behavior fix that can't be confirmed by static analysis, also verified live:
  seeded 30 temporary customers (one with 40 messages) via the service-role client, logged in as
  a temporary Supabase Auth user with Playwright (installed transiently via `npm install
  --no-save`, never touching package.json/package-lock.json), and drove real mouse-wheel scroll
  events over the message pane and then the list pane. Measured `scrollTop` on each independently
  scrollable container directly (not just bounding boxes): the message pane's scrollTop moved
  0 → 2203 while the list pane's stayed at 0, then the list pane's moved 0 → 2208 while the
  message pane's stayed unchanged; the dashboard `<main>` shell and `window.scrollY` both stayed
  at 0 throughout; the sidebar, conversation list, and thread header bounding boxes were pixel
  stable across both scroll actions. All 11 checks passed. Screenshots confirmed the same
  visually. Temp user, temp customers/messages, and the transient playwright install were all
  cleaned up afterward.
- Files touched: app/dashboard/conversations/layout.tsx (new),
  components/dashboard/ConversationsList.tsx (new), app/dashboard/conversations/page.tsx,
  app/dashboard/conversations/[phone]/page.tsx, PROJECT_LOG.md

### 2026-08-02 — Fix: gmb_review_link duplicated in branch confirmation message
- What changed: confirmBranch()'s "with-link" text variant had the review link inserted once in
  the Arabic line and again in the English line (introduced when the change-branch hint was
  added). Restructured to a single shared link placed once after both language lines, before the
  bilingual change-branch hint.
- Why: The customer was receiving the same review link twice in one message.
- Files touched: app/api/whatsapp/route.ts, PROJECT_LOG.md

### 2026-08-02 — Dashboard visual redesign (premium/soft SaaS style)
- What changed: Restyled the whole admin dashboard — no functional/behavioral changes. New shared
  primitives in components/dashboard/ui/ (Button — primary/secondary/ghost/danger variants;
  Select — native select restyled with a custom chevron, appearance-none, focus ring;
  Checkbox — native checkbox with accent-indigo-600; Badge — soft pill status labels;
  EmptyState — icon + title + description for empty tables/lists; PageHeader — consistent
  title+description+actions header) plus a hand-written outline icon set
  (components/dashboard/icons.tsx: nav icons, chevron, inbox, plus, download, paper-plane,
  arrow-left, refresh — no icon library dependency). Palette: bg-slate-50 page background,
  white bg-slate-200-bordered cards/tables (rounded-xl, shadow-sm), slate-900/600/400 text instead
  of pure black, indigo-600 as the single accent for primary actions/active nav/focus rings.
  Sidebar (components/dashboard/Sidebar.tsx) now has icons per nav item, an indigo-tinted active
  state, and a bottom user block (avatar initials + email + logout icon button) — the layout now
  passes the logged-in user's email down from the server-side auth check already done in
  app/dashboard/layout.tsx. Every list table (Conversations, Leads, Templates, Campaign History,
  campaign detail recipients) got row hover/alternating shading, softer dividers, and an
  EmptyState instead of a blank/placeholder row. Leads filters and the template-category picker
  now use the Select component; all checkboxes use the Checkbox component. Campaigns tab switcher
  became a segmented pill control; campaign detail stats became small tiles with a colored count
  circle per status. Conversation detail thread restyled as chat bubbles (indigo for outbound,
  slate for inbound, rounded-2xl with a flat corner on the sending side).
- Why: The dashboard looked like a bare unstyled admin table; this brings it in line with a
  modern SaaS look (Linear/Notion/Stripe-style) per explicit design direction, without touching
  any data flow, API route, or auth logic.
- How it was verified: No /mnt/skills/public/frontend-design/SKILL.md (or equivalent) exists in
  this environment, so the redesign follows general premium-SaaS conventions directly. Verified
  with `tsc --noEmit`, `eslint .`, and `next build` (all clean), then actually run in a browser:
  started the dev server, created a temporary Supabase Auth user via the admin API
  (service-role client), logged in with Playwright (fetched transiently via `npm install
  playwright --no-save` + `npx`, not added to package.json/package-lock.json), and screenshotted
  Conversations/Leads/Campaigns — all rendered correctly with zero browser console errors, then
  the temp user and the transient playwright install were both cleaned up.
- Files touched: components/dashboard/icons.tsx, components/dashboard/ui/Button.tsx,
  components/dashboard/ui/Select.tsx, components/dashboard/ui/Checkbox.tsx,
  components/dashboard/ui/Badge.tsx, components/dashboard/ui/EmptyState.tsx,
  components/dashboard/ui/PageHeader.tsx, components/dashboard/Sidebar.tsx,
  components/dashboard/LogoutButton.tsx, components/dashboard/LeadsTable.tsx,
  components/dashboard/SendCampaignModal.tsx, components/dashboard/CampaignsTabs.tsx,
  components/dashboard/TemplatesTab.tsx, components/dashboard/CampaignHistoryTab.tsx,
  app/dashboard/layout.tsx, app/dashboard/conversations/page.tsx,
  app/dashboard/conversations/[phone]/page.tsx, app/dashboard/leads/page.tsx,
  app/dashboard/campaigns/page.tsx, app/dashboard/campaigns/[id]/page.tsx, app/layout.tsx,
  PROJECT_LOG.md

### 2026-08-02 — Webhook: branch-change trigger phrase + stricter bilingual fallback
- What changed:
  - Added a trigger-phrase check in handleInboundMessage() that runs before the customer.state
    routing logic, on every inbound message regardless of current state. If the message body
    (trimmed, case-insensitive, exact match) is "change branch", "change location", "غير الفرع",
    "غيّر الفرع", "تغيير الفرع", or "تغيير الموقع", the in-memory customer.state is reset to
    'new' so the rest of the function's existing 'new'-state branch handles it naturally (sends
    the location list, then persists state 'awaiting_location'). branch_id is deliberately left
    untouched — it only gets overwritten once the customer completes the new selection in
    confirmBranch(), so there's no separate history table and no explicit clearing step.
  - confirmBranch()'s thank-you message now appends a bilingual BRANCH_CHANGE_HINT line (Arabic
    then English) telling the customer they can type "change branch" / "تغيير الفرع" anytime,
    for both the with-review-link and no-review-link message variants.
  - Rewrote ACTIVE_STATE_SYSTEM_PROMPT: previously it just said "thank them warmly, matching
    their language." Now it explicitly states the assistant's only job is branch selection +
    review link (no product/general questions, even if asked directly), instructs it to point
    the customer at "change branch" / "تغيير الفرع", and — the key behavioral change — requires
    every reply to show BOTH Arabic and English together (Arabic first), not just whichever
    language the customer used. Bumped max_tokens from 150 to 250 so the now-longer bilingual
    reply doesn't get truncated. Also replaced the API-failure fallback string (previously a
    one-line "شكراً لك! / Thank you!") with ACTIVE_STATE_FALLBACK_REPLY, a fully bilingual
    message matching the same shape Claude is instructed to produce, so even a Claude API
    failure still meets the always-bilingual requirement.
- Why: Customers who mis-selected their branch had no way to correct it short of re-scanning the
  QR code from scratch; a "change branch" phrase gives them a direct escape hatch from any point
  in the flow. Separately, the old fallback prompt could reply in only the customer's language and
  didn't explicitly forbid answering off-topic questions — the new prompt makes both the
  bilingual requirement and the "branch selection only, nothing else" scope explicit.
- How it was verified: `tsc --noEmit`, `eslint app/api/whatsapp/route.ts`, and `next build` all
  clean. Did not simulate a live webhook POST end-to-end — unlike the dashboard UI change, that
  would call the real WhatsApp Cloud API and could send an actual message to a real phone number,
  which isn't a safe/reversible test to run casually. Instead isolated and unit-tested
  isBranchChangeTrigger()'s exact matching logic (case-insensitivity, trim, non-matches like
  "change branch please") in a standalone Node script — all cases passed.
- Files touched: app/api/whatsapp/route.ts, PROJECT_LOG.md

### 2026-08-02 — Admin dashboard (auth, conversations, leads, campaigns)
- What changed:
  - **Auth**: Added the standard @supabase/ssr Next.js App Router pattern — lib/supabase/server.ts
    (Server Components/Route Handlers), lib/supabase/client.ts (Client Components), and
    lib/supabase/middleware.ts wired into proxy.ts (Next.js 16 renamed the `middleware.ts`
    convention to `proxy.ts` — used the current convention directly rather than the deprecated
    one). The proxy redirects unauthenticated requests to /dashboard/* to /login, and redirects
    already-logged-in users away from /login. app/dashboard/layout.tsx re-checks auth server-side
    as defense in depth. /login is email/password only (no self-serve signup) — dashboard users
    are created directly in the Supabase Auth dashboard, matching a small internal-tool pattern.
  - **Sidebar/layout**: components/dashboard/Sidebar.tsx (Conversations/Leads/Campaigns links +
    Logout) and app/dashboard/layout.tsx; /dashboard redirects to /dashboard/conversations.
  - **Conversations**: app/dashboard/conversations/page.tsx lists customers joined with
    branch/location; app/dashboard/conversations/[phone]/page.tsx shows the full read-only
    message thread (no take-over UI — this bot has no human handoff).
  - **Leads**: app/dashboard/leads/page.tsx fetches customers + branches + locations server-side;
    components/dashboard/LeadsTable.tsx (client) does location→branch cascading filters, row/
    select-all checkboxes, a client-side CSV export (selected rows if any are checked, otherwise
    the current filtered set), and a "Send Campaign" button that opens
    components/dashboard/SendCampaignModal.tsx. The modal loads approved templates directly via
    the browser Supabase client (RLS allows authenticated SELECT), and if the selection spans more
    than one branch, sends `branch_id: null` (campaigns.branch_id is nullable for exactly this
    case) and labels it "Multiple branches (N)" in the confirmation.
  - **Campaigns**: app/dashboard/campaigns/page.tsx fetches templates + campaigns (with recipient
    counts derived from campaign_sends) server-side; components/dashboard/CampaignsTabs.tsx
    switches between TemplatesTab.tsx (list + create-template form + per-row "Refresh Status") and
    CampaignHistoryTab.tsx (list linking to app/dashboard/campaigns/[id]/page.tsx, which shows
    sent/delivered/read/failed counts and a per-recipient table with failure reasons).
  - **New API routes** (all check auth via lib/api-auth.ts's getAuthenticatedUser(), 401 if
    missing, writes via the existing service-role client):
    - app/api/dashboard/templates/create/route.ts — calls Meta's Template Management API
      (lib/meta-templates.ts createMetaTemplate(), which slugifies the name to Meta's allowed
      format and uppercases the category) and stores the returned meta_template_id/status.
    - app/api/dashboard/templates/status/route.ts — re-checks a template's status from Meta
      (getMetaTemplateStatus()) and updates the row.
    - app/api/dashboard/campaigns/send/route.ts — creates the campaigns row, inserts a
      campaign_sends row per recipient (status 'queued'), then sends the template message to each
      number serially via a new sendWhatsAppTemplate() in lib/whatsapp.ts, updating each row to
      'sent' (with wa_message_id + sent_at) or 'failed' (with error_reason) based on the immediate
      API response.
  - **Webhook**: app/api/whatsapp/route.ts now also reads the `statuses` array on each webhook
    payload (previously only `messages` was handled) and updates the matching campaign_sends row
    by wa_message_id as WhatsApp reports sent → delivered → read, or failed with a reason.
  - **Schema**: added templates.category (marketing/utility) and templates.language (default
    'en_US') — both needed to call Meta's template API and to send templates later; added
    campaign_sends.wa_message_id + a partial unique index — needed so the webhook's status
    callback can find the row to update. Edited supabase/schema.sql directly (not a migration
    file) since it still hasn't been run against a live project yet.
  - Added WHATSAPP_BUSINESS_ACCOUNT_ID to .env.local and documented it in README.md.
- Why: This is the staff-facing half of the product — filtering leads, running branch-targeted
  campaigns through Meta-approved templates, and seeing delivery results, all gated behind login
  since it can send real WhatsApp messages and touches customer data.
- Files touched: supabase/schema.sql, .env.local, README.md, proxy.ts, lib/supabase/server.ts,
  lib/supabase/client.ts, lib/supabase/middleware.ts, lib/api-auth.ts, lib/meta-templates.ts,
  lib/whatsapp.ts, lib/types.ts, app/login/page.tsx, app/dashboard/layout.tsx,
  app/dashboard/page.tsx, app/dashboard/conversations/page.tsx,
  app/dashboard/conversations/[phone]/page.tsx, app/dashboard/leads/page.tsx,
  app/dashboard/campaigns/page.tsx, app/dashboard/campaigns/[id]/page.tsx,
  components/dashboard/Sidebar.tsx, components/dashboard/LogoutButton.tsx,
  components/dashboard/LeadsTable.tsx, components/dashboard/SendCampaignModal.tsx,
  components/dashboard/CampaignsTabs.tsx, components/dashboard/TemplatesTab.tsx,
  components/dashboard/CampaignHistoryTab.tsx, app/api/dashboard/templates/create/route.ts,
  app/api/dashboard/templates/status/route.ts, app/api/dashboard/campaigns/send/route.ts,
  app/api/whatsapp/route.ts, PROJECT_LOG.md

### 2026-08-02 — WhatsApp webhook (branch capture + review link delivery)
- What changed: Built app/api/whatsapp/route.ts. GET handles Meta's webhook verification
  handshake. POST logs every inbound message (upserting the customer by phone_number first to
  satisfy the messages FK, and skipping re-processing if wa_message_id was already logged — guards
  against Meta's webhook retries), then drives the conversation state machine: state 'new' sends
  a bilingual (Arabic/English) interactive location list and moves to 'awaiting_location'; a
  location list_reply looks up that location's branches — a single-branch location (Dubai, Ajman,
  RAK, Fujairah) skips straight to confirmation, multiple branches get a second bilingual branch
  list and state becomes 'awaiting_branch:<location_id>' (the location id is carried in the state
  string itself since customers has no separate "pending location" column); a branch list_reply
  sets branch_id and state 'active', then sends the branch's gmb_review_link (or a generic
  thank-you + console warning if the link is still NULL); once 'active', any further message is
  answered by Claude (claude-sonnet-5, max_tokens 150, thinking disabled) with a short bilingual
  thank-you, per the system prompt's instruction to not re-engage on products/support. Any reply
  that doesn't match the expected list_reply for the current state re-sends the same list with a
  "please pick from the list" prompt instead of getting stuck. All writes go through a new
  lib/supabase-service.ts service-role client (RLS blocks anon/authenticated writes per
  supabase/rls.sql). Added lib/whatsapp.ts with sendWhatsAppText/sendWhatsAppList helpers for the
  Cloud API. Customer names come from the WhatsApp contact profile in the webhook payload — there
  is no separate "ask for your name" step.
- Why: This is the entire customer-facing bot per the project's scope — no product catalog, image
  handling, or human handoff.
- Files touched: app/api/whatsapp/route.ts, lib/whatsapp.ts, lib/supabase-service.ts,
  PROJECT_LOG.md

### 2026-08-02 — Initial project skeleton
- What changed: Initialized Next.js project (TypeScript, Tailwind, App Router, no src/ dir).
  Installed @supabase/supabase-js, @supabase/ssr, @anthropic-ai/sdk. Created
  .env.local.example. Wrote supabase/schema.sql (locations, branches, customers, messages,
  templates, campaigns, campaign_sends, with indexes), supabase/rls.sql (RLS enabled on all
  tables, SELECT-only for authenticated, no anon access, write grants revoked at the grant
  layer), and supabase/seed_locations_branches.sql (7 locations, 13 branches, gmb_review_link
  left NULL). Added this PROJECT_LOG.md and a setup README.md.
- Why: Establish the project skeleton and data model before building the WhatsApp webhook,
  bot conversation logic, or admin dashboard.
- Files touched: package.json, .env.local.example, .gitignore, supabase/schema.sql,
  supabase/rls.sql, supabase/seed_locations_branches.sql, PROJECT_LOG.md, README.md

## Known limitations / not yet built
- Confirmed live and working (as of the 2026-08-02 redesign's browser verification): schema/RLS/
  seed are applied to the real Supabase project, the WhatsApp webhook has handled real customer
  conversations end-to-end (location → branch → active state), and Supabase Auth sign-in works.
  Not yet confirmed: whether a *permanent* staff login exists — the verification used a
  temporary auto-created-and-deleted test account, so create a real one (Supabase dashboard →
  Authentication → Users → Add user) if one doesn't already exist for daily use.
- Campaign sending doesn't support templates with variables ({{1}}, etc.) — sendWhatsAppTemplate()
  sends the template name + language only, no component parameters. Only variable-free templates
  can actually be sent via the campaign flow today; templates with variables can still be created
  and approved, just not sent yet.
- No editing/archiving of templates or campaigns from the dashboard — templates are create-once
  (resubmit as a new template if rejected), campaigns are fire-and-forget.
- gmb_review_link's actual values haven't been spot-checked recently — fill in real Google My
  Business review links per branch if any are still NULL (the webhook logs a console warning and
  sends a generic thank-you when one is missing).
- No template has been created yet, so the dashboard's Meta Template Management API calls
  (submit for approval / refresh status) are still unexercised against a real Meta account.
