# Project Log — Emirat Uniform WhatsApp Bot

## What this project is
A WhatsApp bot for Emirat Uniform, a UAE uniform company with 13 branches across 7 locations
(Abu Dhabi, Al Ain, Dubai, Sharjah, Ajman, RAK, Fujairah). Customers scan a single shared
WhatsApp QR code in-branch, are asked which location and branch they're at, have their
name/phone/branch saved as a lead, and receive that branch's Google My Business review link.
Separately, an admin dashboard lets staff filter leads by branch, send WhatsApp marketing
campaigns using Meta-approved templates, submit new templates for Meta approval, and view
per-campaign delivery statistics (sent, delivered, failed, failure reasons).

## Current status
Admin dashboard is built: Supabase Auth login, protected /dashboard/* routes, Conversations,
Leads (filter + CSV export + campaign send), and Campaigns (templates + history + per-campaign
delivery stats). Schema/RLS/seed SQL — including the templates.category/language and
campaign_sends.wa_message_id additions from this change — still has not been run against a live
Supabase project yet, and no dashboard user has been created in Supabase Auth yet.

## Architecture
- Next.js App Router + Vercel
- Supabase (Postgres) for data
- Claude API for conversation handling during branch selection only
- WhatsApp Cloud API (Meta) for messaging
- No human handoff, no image handling, no product catalog — this bot is lead capture + review collection + campaign sending only

## Change history

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
- No dashboard user exists yet — create one in the Supabase Auth dashboard (Authentication →
  Users → Add user) before /login can be used.
- Campaign sending doesn't support templates with variables ({{1}}, etc.) — sendWhatsAppTemplate()
  sends the template name + language only, no component parameters. Only variable-free templates
  can actually be sent via the campaign flow today; templates with variables can still be created
  and approved, just not sent yet.
- No editing/archiving of templates or campaigns from the dashboard — templates are create-once
  (resubmit as a new template if rejected), campaigns are fire-and-forget.
- gmb_review_link is NULL for all 13 branches — needs to be filled in with real Google My
  Business review links before the bot can send them (the webhook logs a console warning and
  sends a generic thank-you in the meantime).
- Schema/RLS/seed SQL have not yet been run against a live Supabase project — this includes the
  new templates.category/language and campaign_sends.wa_message_id columns added in this change.
- Neither the webhook nor the dashboard's Meta Template Management API calls have been tested
  against a real Meta WhatsApp Business account yet — only type-checked and build-verified.
