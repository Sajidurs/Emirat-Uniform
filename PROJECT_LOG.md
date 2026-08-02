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
WhatsApp webhook (app/api/whatsapp/route.ts) is built and handles the full customer conversation
(location → branch → review link, plus a Claude-powered thank-you fallback). Schema/RLS/seed SQL
still has not been run against a live Supabase project yet, and the admin dashboard doesn't exist yet.

## Architecture
- Next.js App Router + Vercel
- Supabase (Postgres) for data
- Claude API for conversation handling during branch selection only
- WhatsApp Cloud API (Meta) for messaging
- No human handoff, no image handling, no product catalog — this bot is lead capture + review collection + campaign sending only

## Change history

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
- No admin dashboard (lead filtering, campaign sending, template creation/approval submission,
  delivery stats) yet.
- No authentication for the admin dashboard yet.
- gmb_review_link is NULL for all 13 branches — needs to be filled in with real Google My
  Business review links before the bot can send them (the webhook logs a console warning and
  sends a generic thank-you in the meantime).
- Schema/RLS/seed SQL have not yet been run against a live Supabase project.
- The webhook hasn't been tested against a real Meta WhatsApp Business account/webhook
  subscription yet — only type-checked and build-verified.
