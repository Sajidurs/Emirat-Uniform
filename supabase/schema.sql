-- Emirat Uniform WhatsApp Bot — core schema
-- Run this once against a fresh Supabase project (SQL editor or `supabase db push`).

-- =========================================================
-- locations
-- =========================================================
create table if not exists locations (
  id bigint generated always as identity primary key,
  name text not null unique
);

-- =========================================================
-- branches
-- =========================================================
create table if not exists branches (
  id bigint generated always as identity primary key,
  location_id bigint not null references locations (id) on delete cascade,
  name text not null,
  gmb_review_link text
);

create index if not exists idx_branches_location_id on branches (location_id);

-- =========================================================
-- customers
-- one row per WhatsApp phone number; `state` tracks conversation progress
-- (e.g. 'new', 'awaiting_location', 'awaiting_branch', 'awaiting_name', 'done')
-- =========================================================
create table if not exists customers (
  phone_number text primary key,
  name text,
  branch_id bigint references branches (id) on delete set null,
  state text not null default 'new',
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create index if not exists idx_customers_branch_id on customers (branch_id);

-- =========================================================
-- messages
-- full inbound/outbound conversation log per customer
-- =========================================================
create table if not exists messages (
  id bigint generated always as identity primary key,
  phone_number text references customers (phone_number) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text,
  wa_message_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_phone_created on messages (phone_number, created_at);

create unique index if not exists uq_messages_wa_message_id
  on messages (wa_message_id)
  where wa_message_id is not null;

-- =========================================================
-- templates
-- Meta-approved WhatsApp message templates used for marketing campaigns
-- =========================================================
create table if not exists templates (
  id bigint generated always as identity primary key,
  name text not null,
  meta_template_id text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  body text,
  category text check (category in ('marketing', 'utility')),
  language text not null default 'en_US',
  created_at timestamptz not null default now()
);

-- =========================================================
-- campaigns
-- one marketing send-out, targeting a branch's leads with a template
-- =========================================================
create table if not exists campaigns (
  id bigint generated always as identity primary key,
  branch_id bigint references branches (id) on delete set null,
  template_id bigint references templates (id) on delete set null,
  created_at timestamptz not null default now()
);

-- =========================================================
-- campaign_sends
-- per-recipient delivery record for a campaign, updated via WhatsApp status webhooks
-- =========================================================
create table if not exists campaign_sends (
  id bigint generated always as identity primary key,
  campaign_id bigint references campaigns (id) on delete cascade,
  phone_number text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'read', 'failed')),
  error_reason text,
  wa_message_id text,
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_campaign_sends_campaign_id on campaign_sends (campaign_id);

-- Lets the WhatsApp status webhook (sent/delivered/read/failed) find the row
-- to update by the outbound message id returned when the campaign send fired.
create unique index if not exists uq_campaign_sends_wa_message_id
  on campaign_sends (wa_message_id)
  where wa_message_id is not null;
