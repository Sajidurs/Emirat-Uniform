import { createClient } from "@/lib/supabase/server";
import ConversationsList, { type ConversationListItem } from "@/components/dashboard/ConversationsList";
import PageHeader from "@/components/dashboard/ui/PageHeader";

export default async function ConversationsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .select("phone_number, name, state, last_seen, branch:branches(name, location:locations(name))")
    .order("last_seen", { ascending: false });

  const customers = (data ?? []) as unknown as ConversationListItem[];

  return (
    // Matches app/dashboard/layout.tsx's <main> vertical padding (py-7 = 3.5rem
    // total) so this panel fills the visible viewport exactly — <main> never
    // needs to scroll itself, and the two columns below scroll independently.
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <PageHeader
        title="Conversations"
        description="Every customer chat handled by the WhatsApp bot, newest first."
      />

      {error && (
        <p className="mb-4 shrink-0 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load conversations: {error.message}
        </p>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ConversationsList customers={customers} />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
