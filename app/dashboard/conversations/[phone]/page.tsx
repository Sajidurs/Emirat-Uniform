import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

interface CustomerDetail {
  phone_number: string;
  name: string | null;
  state: string;
  branch: { name: string; location: { name: string } | null } | null;
}

interface MessageRow {
  id: number;
  direction: "inbound" | "outbound";
  body: string | null;
  created_at: string;
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ phone: string }>;
}) {
  const { phone } = await params;
  const phoneNumber = decodeURIComponent(phone);
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("phone_number, name, state, branch:branches(name, location:locations(name))")
    .eq("phone_number", phoneNumber)
    .maybeSingle();

  if (!customer) notFound();

  const { data: messages } = await supabase
    .from("messages")
    .select("id, direction, body, created_at")
    .eq("phone_number", phoneNumber)
    .order("created_at", { ascending: true });

  const typedCustomer = customer as unknown as CustomerDetail;
  const typedMessages = (messages ?? []) as MessageRow[];
  const displayName = typedCustomer.name ?? typedCustomer.phone_number;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header stays fixed at the top of this pane — only the messages below scroll. */}
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-5 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700">
          {initials(displayName)}
        </div>
        <div>
          <h1 className="text-sm font-semibold text-slate-900">{displayName}</h1>
          <p className="text-xs text-slate-500">
            {typedCustomer.phone_number} · {typedCustomer.branch?.location?.name ?? "—"} /{" "}
            {typedCustomer.branch?.name ?? "—"} · state: {typedCustomer.state}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
        {typedMessages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-md whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                message.direction === "outbound"
                  ? "rounded-br-md bg-indigo-600 text-white"
                  : "rounded-bl-md bg-slate-100 text-slate-700"
              }`}
            >
              <p>{message.body}</p>
              <p
                className={`mt-1 text-[11px] ${
                  message.direction === "outbound" ? "text-indigo-100/80" : "text-slate-400"
                }`}
              >
                {new Date(message.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
        {typedMessages.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">No messages yet.</p>
        )}
      </div>
    </div>
  );
}
