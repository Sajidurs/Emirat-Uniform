# Emirat Uniform WhatsApp Bot

WhatsApp bot for lead capture and Google review collection, plus an admin dashboard for
branch-targeted WhatsApp marketing campaigns. See [PROJECT_LOG.md](./PROJECT_LOG.md) for
project purpose, architecture, and change history.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Fill in environment variables**

   Copy the example file and fill in real values:

   ```bash
   cp .env.local.example .env.local
   ```

   | Variable | Description |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
   | `SUPABASE_URL` | Supabase project URL (server-side) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key — server-side only, never exposed to the client |
   | `ANTHROPIC_API_KEY` | Claude API key, used for conversation handling during branch selection |
   | `WHATSAPP_TOKEN` | WhatsApp Cloud API access token |
   | `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Cloud API phone number ID |
   | `WHATSAPP_VERIFY_TOKEN` | Token used to verify the WhatsApp webhook subscription |
   | `WHATSAPP_BUSINESS_ACCOUNT_ID` | WhatsApp Business Account ID, used by the dashboard to submit/check message templates via Meta's Template Management API |

3. **Run the database schema**

   In the Supabase SQL editor (or via `psql`/`supabase db push`), run in this order:

   ```bash
   supabase/schema.sql
   ```

4. **Apply Row Level Security policies**

   ```bash
   supabase/rls.sql
   ```

5. **Seed locations and branches**

   ```bash
   supabase/seed_locations_branches.sql
   ```

   Note: `gmb_review_link` is left `NULL` for all branches — update these rows with real
   Google My Business review links before going live.

6. **Run locally**

   ```bash
   npm run dev
   ```

7. **Deploy to Vercel**

   Connect the repo in Vercel and set all variables from `.env.local.example` in the
   project's Environment Variables settings before the first deploy.
