import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/dashboard/ui/PageHeader";
import EmptyState from "@/components/dashboard/ui/EmptyState";
import Badge from "@/components/dashboard/ui/Badge";
import { ConversationsIcon } from "@/components/dashboard/icons";

interface CustomerRow {
  phone_number: string;
  name: string | null;
  state: string;
  last_seen: string;
  branch: { name: string; location: { name: string } | null } | null;
}

function stateBadge(state: string): { label: string; tone: "gray" | "amber" | "green" } {
  if (state === "active") return { label: "Active", tone: "green" };
  if (state.startsWith("awaiting_branch")) return { label: "Awaiting branch", tone: "amber" };
  if (state === "awaiting_location") return { label: "Awaiting location", tone: "amber" };
  return { label: "New", tone: "gray" };
}

export default async function ConversationsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .select("phone_number, name, state, last_seen, branch:branches(name, location:locations(name))")
    .order("last_seen", { ascending: false });

  const customers = (data ?? []) as unknown as CustomerRow[];

  return (
    <div>
      <PageHeader
        title="Conversations"
        description="Every customer chat handled by the WhatsApp bot, newest first."
      />

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load conversations: {error.message}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {customers.length === 0 ? (
          <EmptyState
            icon={<ConversationsIcon className="h-6 w-6" />}
            title="No conversations yet"
            description="Chats will appear here once customers start messaging the WhatsApp bot."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Branch
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    State
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Last seen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((customer) => {
                  const badge = stateBadge(customer.state);
                  return (
                    <tr
                      key={customer.phone_number}
                      className="odd:bg-white even:bg-slate-50/40 transition-colors hover:bg-indigo-50/40"
                    >
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/dashboard/conversations/${encodeURIComponent(customer.phone_number)}`}
                          className="font-medium text-slate-800 hover:text-indigo-600"
                        >
                          {customer.name ?? "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{customer.phone_number}</td>
                      <td className="px-4 py-3.5 text-slate-600">{customer.branch?.location?.name ?? "—"}</td>
                      <td className="px-4 py-3.5 text-slate-600">{customer.branch?.name ?? "—"}</td>
                      <td className="px-4 py-3.5">
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400">
                        {new Date(customer.last_seen).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
