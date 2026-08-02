"use client";

import Link from "next/link";
import type { CampaignListItem } from "@/lib/types";

export default function CampaignHistoryTab({ campaigns }: { campaigns: CampaignListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Branch</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Template</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Date Sent</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Recipients</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {campaigns.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <Link href={`/dashboard/campaigns/${c.id}`} className="text-gray-900 hover:underline">
                  {c.branch_name ?? "Multiple branches"}
                </Link>
              </td>
              <td className="px-4 py-3 text-gray-700">{c.template_name ?? "—"}</td>
              <td className="px-4 py-3 text-gray-500">{new Date(c.created_at).toLocaleString()}</td>
              <td className="px-4 py-3 text-gray-700">{c.total_recipients}</td>
            </tr>
          ))}
          {campaigns.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                No campaigns sent yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
