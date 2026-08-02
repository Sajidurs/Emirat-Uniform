import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

interface CampaignDetail {
  id: number;
  created_at: string;
  branch: { name: string } | null;
  template: { name: string } | null;
}

interface SendRow {
  id: number;
  phone_number: string;
  status: "queued" | "sent" | "delivered" | "read" | "failed";
  error_reason: string | null;
  sent_at: string | null;
  updated_at: string;
}

const STATUS_STYLES: Record<SendRow["status"], string> = {
  queued: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-800",
  delivered: "bg-indigo-100 text-indigo-800",
  read: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, created_at, branch:branches(name), template:templates(name)")
    .eq("id", id)
    .maybeSingle();

  if (!campaign) notFound();

  const { data: sendsData } = await supabase
    .from("campaign_sends")
    .select("id, phone_number, status, error_reason, sent_at, updated_at")
    .eq("campaign_id", id)
    .order("updated_at", { ascending: false });

  const typedCampaign = campaign as unknown as CampaignDetail;
  const sends = (sendsData ?? []) as SendRow[];

  const counts = {
    total: sends.length,
    sent: sends.filter((s) => s.status === "sent").length,
    delivered: sends.filter((s) => s.status === "delivered").length,
    read: sends.filter((s) => s.status === "read").length,
    failed: sends.filter((s) => s.status === "failed").length,
    queued: sends.filter((s) => s.status === "queued").length,
  };

  return (
    <div>
      <Link href="/dashboard/campaigns" className="mb-4 inline-block text-sm text-gray-500 hover:underline">
        ← Back to campaigns
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          {typedCampaign.branch?.name ?? "Multiple branches"} — {typedCampaign.template?.name ?? "—"}
        </h1>
        <p className="text-sm text-gray-500">{new Date(typedCampaign.created_at).toLocaleString()}</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Total", value: counts.total },
          { label: "Sent", value: counts.sent },
          { label: "Delivered", value: counts.delivered },
          { label: "Read", value: counts.read },
          { label: "Failed", value: counts.failed },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-gray-200 bg-white p-4 text-center">
            <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Phone</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Failure Reason</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sends.map((send) => (
              <tr key={send.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-700">{send.phone_number}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[send.status]}`}>
                    {send.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{send.error_reason ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(send.updated_at).toLocaleString()}</td>
              </tr>
            ))}
            {sends.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                  No recipients recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
