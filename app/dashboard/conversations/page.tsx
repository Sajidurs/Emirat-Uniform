import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface CustomerRow {
  phone_number: string;
  name: string | null;
  state: string;
  last_seen: string;
  branch: { name: string; location: { name: string } | null } | null;
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
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Conversations</h1>

      {error && <p className="text-sm text-red-600">Failed to load conversations: {error.message}</p>}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Phone</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Location</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Branch</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">State</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Last seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.map((customer) => (
              <tr key={customer.phone_number} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/conversations/${encodeURIComponent(customer.phone_number)}`}
                    className="text-gray-900 hover:underline"
                  >
                    {customer.name ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-700">{customer.phone_number}</td>
                <td className="px-4 py-3 text-gray-700">{customer.branch?.location?.name ?? "—"}</td>
                <td className="px-4 py-3 text-gray-700">{customer.branch?.name ?? "—"}</td>
                <td className="px-4 py-3 text-gray-700">{customer.state}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(customer.last_seen).toLocaleString()}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  No conversations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
