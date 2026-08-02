"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Template } from "@/lib/types";

interface SendCampaignModalProps {
  branchId: number | null;
  branchLabel: string;
  phoneNumbers: string[];
  onClose: () => void;
  onSent: () => void;
}

export default function SendCampaignModal({
  branchId,
  branchLabel,
  phoneNumbers,
  onClose,
  onSent,
}: SendCampaignModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | "">("");
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTemplates() {
      const supabase = createClient();
      const { data } = await supabase
        .from("templates")
        .select("id, name, meta_template_id, status, body, category, language, created_at")
        .eq("status", "approved")
        .order("name");
      setTemplates((data ?? []) as Template[]);
      setLoadingTemplates(false);
    }
    loadTemplates();
  }, []);

  async function handleConfirm() {
    if (!selectedTemplateId) return;
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/dashboard/campaigns/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: branchId,
          template_id: selectedTemplateId,
          phone_numbers: phoneNumbers,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send campaign");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Send Campaign</h2>

        <div className="mb-4 space-y-1 text-sm text-gray-600">
          <p>
            <span className="font-medium text-gray-900">Recipients:</span> {phoneNumbers.length}
          </p>
          <p>
            <span className="font-medium text-gray-900">Branch:</span> {branchLabel}
          </p>
        </div>

        <label className="mb-1 block text-sm font-medium text-gray-700">Template (approved only)</label>
        {loadingTemplates ? (
          <p className="text-sm text-gray-500">Loading templates...</p>
        ) : (
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value ? Number(e.target.value) : "")}
            className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select a template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}

        {!loadingTemplates && templates.length === 0 && (
          <p className="mb-4 text-sm text-amber-600">
            No approved templates yet. Create and get one approved from the Campaigns page first.
          </p>
        )}

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={sending}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={sending || !selectedTemplateId}
            className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {sending ? "Sending..." : "Confirm & Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
