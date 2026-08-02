"use client";

import Link from "next/link";
import type { CampaignListItem } from "@/lib/types";
import EmptyState from "./ui/EmptyState";
import { CampaignsIcon } from "./icons";

export default function CampaignHistoryTab({ campaigns }: { campaigns: CampaignListItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {campaigns.length === 0 ? (
        <EmptyState
          icon={<CampaignsIcon className="h-6 w-6" />}
          title="No campaigns sent yet"
          description="Select leads on the Leads page and send your first campaign."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  Branch
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  Template
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  Date Sent
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  Recipients
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaigns.map((c) => (
                <tr key={c.id} className="odd:bg-white even:bg-slate-50/40 transition-colors hover:bg-indigo-50/40">
                  <td className="px-4 py-3.5">
                    <Link
                      href={`/dashboard/campaigns/${c.id}`}
                      className="font-medium text-slate-800 hover:text-indigo-600"
                    >
                      {c.branch_name ?? "Multiple branches"}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">{c.template_name ?? "—"}</td>
                  <td className="px-4 py-3.5 text-slate-400">{new Date(c.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-slate-600">{c.total_recipients}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
