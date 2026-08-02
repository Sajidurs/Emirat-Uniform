import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for server-side use only (API routes).
 * Bypasses RLS — see supabase/rls.sql. Never import this into client components.
 */
export function createServiceClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
