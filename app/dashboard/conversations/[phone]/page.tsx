import Link from "next/link";
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

  return (
    <div>
      <Link href="/dashboard/conversations" className="mb-4 inline-block text-sm text-gray-500 hover:underline">
        ← Back to conversations
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">{typedCustomer.name ?? typedCustomer.phone_number}</h1>
        <p className="text-sm text-gray-500">
          {typedCustomer.phone_number} · {typedCustomer.branch?.location?.name ?? "—"} /{" "}
          {typedCustomer.branch?.name ?? "—"} · state: {typedCustomer.state}
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        {typedMessages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-md whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                message.direction === "outbound"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              <p>{message.body}</p>
              <p
                className={`mt-1 text-xs ${
                  message.direction === "outbound" ? "text-gray-300" : "text-gray-400"
                }`}
              >
                {new Date(message.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
        {typedMessages.length === 0 && <p className="text-sm text-gray-500">No messages yet.</p>}
      </div>
    </div>
  );
}
