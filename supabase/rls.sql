-- Emirat Uniform WhatsApp Bot — Row Level Security
-- All writes happen server-side via API routes using the Supabase service-role
-- key, which bypasses RLS entirely. These policies only govern what the
-- `anon` and `authenticated` roles (i.e. the browser/dashboard session) can
-- see directly through the Supabase client.
--
-- - `anon` gets no policies at all -> effectively no access.
-- - `authenticated` (logged-in admin/staff) gets read-only (SELECT) access,
--   so the dashboard can query data directly, but all writes (creating
--   templates, launching campaigns, updating leads, etc.) must go through
--   API routes using the service-role key.
-- - Table grants are revoked for anon/authenticated at the grant layer as a
--   second line of defense, independent of policy configuration.

-- =========================================================
-- Enable RLS
-- =========================================================
alter table locations enable row level security;
alter table branches enable row level security;
alter table customers enable row level security;
alter table messages enable row level security;
alter table templates enable row level security;
alter table campaigns enable row level security;
alter table campaign_sends enable row level security;

-- =========================================================
-- SELECT-only policies for `authenticated`
-- =========================================================
create policy "authenticated_select_locations"
  on locations for select
  to authenticated
  using (true);

create policy "authenticated_select_branches"
  on branches for select
  to authenticated
  using (true);

create policy "authenticated_select_customers"
  on customers for select
  to authenticated
  using (true);

create policy "authenticated_select_messages"
  on messages for select
  to authenticated
  using (true);

create policy "authenticated_select_templates"
  on templates for select
  to authenticated
  using (true);

create policy "authenticated_select_campaigns"
  on campaigns for select
  to authenticated
  using (true);

create policy "authenticated_select_campaign_sends"
  on campaign_sends for select
  to authenticated
  using (true);

-- No policies are created for `anon` -> anon has zero access to these tables.

-- =========================================================
-- Revoke write grants from anon/authenticated at the grant layer.
-- Writes only ever happen via the service-role key in API routes, which
-- bypasses RLS and grants entirely.
-- =========================================================
revoke insert, update, delete on locations from anon, authenticated;
revoke insert, update, delete on branches from anon, authenticated;
revoke insert, update, delete on customers from anon, authenticated;
revoke insert, update, delete on messages from anon, authenticated;
revoke insert, update, delete on templates from anon, authenticated;
revoke insert, update, delete on campaigns from anon, authenticated;
revoke insert, update, delete on campaign_sends from anon, authenticated;

revoke all on locations from anon;
revoke all on branches from anon;
revoke all on customers from anon;
revoke all on messages from anon;
revoke all on templates from anon;
revoke all on campaigns from anon;
revoke all on campaign_sends from anon;
