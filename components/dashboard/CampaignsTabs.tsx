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
      <div className="mb-6 flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab("templates")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "templates"
              ? "border-b-2 border-gray-900 text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Templates
        </button>
        <button
          onClick={() => setTab("history")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "history"
              ? "border-b-2 border-gray-900 text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Campaign History
        </button>
      </div>

      {tab === "templates" ? <TemplatesTab templates={templates} /> : <CampaignHistoryTab campaigns={campaigns} />}
    </div>
  );
}
