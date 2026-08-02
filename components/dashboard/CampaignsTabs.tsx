"use client";

import { useState } from "react";
import type { CampaignListItem, Template } from "@/lib/types";
import TemplatesTab from "./TemplatesTab";
import CampaignHistoryTab from "./CampaignHistoryTab";

interface CampaignsTabsProps {
  templates: Template[];
  campaigns: CampaignListItem[];
}

export default function CampaignsTabs({ templates, campaigns }: CampaignsTabsProps) {
  const [tab, setTab] = useState<"templates" | "history">("templates");

  return (
    <div>
      <div className="mb-5 inline-flex gap-1 rounded-lg bg-slate-100 p-1">
        <button
          onClick={() => setTab("templates")}
          className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
            tab === "templates" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Templates
        </button>
        <button
          onClick={() => setTab("history")}
          className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
            tab === "history" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Campaign History
        </button>
      </div>

      {tab === "templates" ? <TemplatesTab templates={templates} /> : <CampaignHistoryTab campaigns={campaigns} />}
    </div>
  );
}
