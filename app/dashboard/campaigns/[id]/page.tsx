import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Badge from "@/components/dashboard/ui/Badge";
import EmptyState from "@/components/dashboard/ui/EmptyState";
import { ArrowLeftIcon, CampaignsIcon } from "@/components/dashboard/icons";

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

const STATUS_TONE: Record<SendRow["status"], "gray" | "blue" | "indigo" | "green" | "red"> = {
  queued: "gray",
  sent: "blue",
  delivered: "indigo",
  read: "green",
  failed: "red",
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
  };

  const stats: { label: string; value: number; tone: string }[] = [
    { label: "Total", value: counts.total, tone: "bg-slate-100 text-slate-600" },
    { label: "Sent", value: counts.sent, tone: "bg-blue-50 text-blue-600" },
    { label: "Delivered", value: counts.delivered, tone: "bg-indigo-50 text-indigo-600" },
    { label: "Read", value: counts.read, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Failed", value: counts.failed, tone: "bg-red-50 text-red-600" },
  ];

  return (
    <div>
      <Link
        href="/dashboard/campaigns"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Back to campaigns
      </Link>

      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-900">
          {typedCampaign.branch?.name ?? "Multiple branches"} — {typedCampaign.template?.name ?? "—"}
        </h1>
        <p className="text-sm text-slate-500">{new Date(typedCampaign.created_at).toLocaleString()}</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <div className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${stat.tone}`}>
              {stat.value}
            </div>
            <p className="text-xs font-medium text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {sends.length === 0 ? (
          <EmptyState icon={<CampaignsIcon className="h-6 w-6" />} title="No recipients recorded" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Failure Reason
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sends.map((send) => (
                  <tr key={send.id} className="odd:bg-white even:bg-slate-50/40 transition-colors hover:bg-indigo-50/40">
                    <td className="px-4 py-3.5 text-slate-600">{send.phone_number}</td>
                    <td className="px-4 py-3.5">
                      <Badge tone={STATUS_TONE[send.status]}>{send.status}</Badge>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">{send.error_reason ?? "—"}</td>
                    <td className="px-4 py-3.5 text-slate-400">{new Date(send.updated_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
