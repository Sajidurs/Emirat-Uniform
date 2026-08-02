"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Branch, LeadRow, Location } from "@/lib/types";
import SendCampaignModal from "./SendCampaignModal";
import Button from "./ui/Button";
import Select from "./ui/Select";
import Checkbox from "./ui/Checkbox";
import EmptyState from "./ui/EmptyState";
import { DownloadIcon, LeadsIcon, PaperPlaneIcon } from "./icons";

interface LeadsTableProps {
  leads: LeadRow[];
  locations: Location[];
  branches: Branch[];
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default function LeadsTable({ leads, locations, branches }: LeadsTableProps) {
  const router = useRouter();
  const [locationFilter, setLocationFilter] = useState<number | "all">("all");
  const [branchFilter, setBranchFilter] = useState<number | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);

  const branchOptions = useMemo(
    () => (locationFilter === "all" ? [] : branches.filter((b) => b.location_id === locationFilter)),
    [branches, locationFilter]
  );

  const filteredLeads = useMemo(
    () =>
      leads.filter(
        (l) =>
          (locationFilter === "all" || l.location_id === locationFilter) &&
          (branchFilter === "all" || l.branch_id === branchFilter)
      ),
    [leads, locationFilter, branchFilter]
  );

  const allFilteredSelected = filteredLeads.length > 0 && filteredLeads.every((l) => selected.has(l.phone_number));

  function toggleSelectAll() {
    const next = new Set(selected);
    if (allFilteredSelected) {
      filteredLeads.forEach((l) => next.delete(l.phone_number));
    } else {
      filteredLeads.forEach((l) => next.add(l.phone_number));
    }
    setSelected(next);
  }

  function toggleOne(phoneNumber: string) {
    const next = new Set(selected);
    if (next.has(phoneNumber)) next.delete(phoneNumber);
    else next.add(phoneNumber);
    setSelected(next);
  }

  function handleExportCsv() {
    const rows = selected.size > 0 ? leads.filter((l) => selected.has(l.phone_number)) : filteredLeads;

    const header = ["Name", "Phone", "Location", "Branch", "First Seen"];
    const lines = [header.join(",")];
    for (const row of rows) {
      lines.push(
        [
          csvEscape(row.name ?? ""),
          csvEscape(row.phone_number),
          csvEscape(row.location_name ?? ""),
          csvEscape(row.branch_name ?? ""),
          csvEscape(new Date(row.first_seen).toISOString()),
        ].join(",")
      );
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `emirat-uniform-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectedLeads = leads.filter((l) => selected.has(l.phone_number));
  const distinctBranchIds = Array.from(new Set(selectedLeads.map((l) => l.branch_id)));
  const campaignBranchId = distinctBranchIds.length === 1 ? distinctBranchIds[0] : null;
  const campaignBranchLabel =
    distinctBranchIds.length === 1
      ? selectedLeads[0]?.branch_name ?? "—"
      : `Multiple branches (${distinctBranchIds.length})`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <Select
          value={locationFilter}
          onChange={(e) => {
            setLocationFilter(e.target.value === "all" ? "all" : Number(e.target.value));
            setBranchFilter("all");
          }}
        >
          <option value="all">All locations</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </Select>

        <Select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
          disabled={locationFilter === "all"}
        >
          <option value="all">All branches</option>
          {branchOptions.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>

        {selected.size > 0 && (
          <span className="text-sm text-slate-500">{selected.size} selected</span>
        )}

        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={handleExportCsv}>
            <DownloadIcon className="h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="primary" onClick={() => setShowModal(true)} disabled={selected.size === 0}>
            <PaperPlaneIcon className="h-4 w-4" />
            Send Campaign{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {filteredLeads.length === 0 ? (
          <EmptyState
            icon={<LeadsIcon className="h-6 w-6" />}
            title="No leads match this filter"
            description="Try a different location or branch, or clear the filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50/60">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <Checkbox checked={allFilteredSelected} onChange={toggleSelectAll} />
                  </th>
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
                    First Seen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.map((lead) => (
                  <tr
                    key={lead.phone_number}
                    className={`transition-colors hover:bg-indigo-50/40 ${
                      selected.has(lead.phone_number) ? "bg-indigo-50/60" : "odd:bg-white even:bg-slate-50/40"
                    }`}
                  >
                    <td className="px-4 py-3.5">
                      <Checkbox
                        checked={selected.has(lead.phone_number)}
                        onChange={() => toggleOne(lead.phone_number)}
                      />
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-800">{lead.name ?? "—"}</td>
                    <td className="px-4 py-3.5 text-slate-600">{lead.phone_number}</td>
                    <td className="px-4 py-3.5 text-slate-600">{lead.location_name ?? "—"}</td>
                    <td className="px-4 py-3.5 text-slate-600">{lead.branch_name ?? "—"}</td>
                    <td className="px-4 py-3.5 text-slate-400">
                      {new Date(lead.first_seen).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <SendCampaignModal
          branchId={campaignBranchId}
          branchLabel={campaignBranchLabel}
          phoneNumbers={selectedLeads.map((l) => l.phone_number)}
          onClose={() => setShowModal(false)}
          onSent={() => {
            setShowModal(false);
            setSelected(new Set());
            router.push("/dashboard/campaigns");
          }}
        />
      )}
    </div>
  );
}
