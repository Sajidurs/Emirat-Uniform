import { createClient } from "@/lib/supabase/server";

/** Returns the logged-in dashboard user, or null if the request is unauthenticated. */
export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
