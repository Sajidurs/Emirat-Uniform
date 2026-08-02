import { createBrowserClient } from "@supabase/ssr";

/**
 * Auth-aware Supabase client for Client Components.
 * Respects the logged-in user's session and RLS (SELECT-only — see supabase/rls.sql).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
