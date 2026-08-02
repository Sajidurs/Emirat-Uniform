"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Template } from "@/lib/types";
import Button from "./ui/Button";
import Select from "./ui/Select";
import { PaperPlaneIcon } from "./icons";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <PaperPlaneIcon className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">Send Campaign</h2>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Recipients</p>
            <p className="mt-0.5 font-medium text-slate-800">{phoneNumbers.length}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Branch</p>
            <p className="mt-0.5 font-medium text-slate-800">{branchLabel}</p>
          </div>
        </div>

        <label className="mb-1.5 block text-sm font-medium text-slate-700">Template (approved only)</label>
        {loadingTemplates ? (
          <p className="text-sm text-slate-400">Loading templates...</p>
        ) : (
          <Select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value ? Number(e.target.value) : "")}
            wrapperClassName="mb-4 block w-full"
          >
            <option value="">Select a template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        )}

        {!loadingTemplates && templates.length === 0 && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            No approved templates yet. Create and get one approved from the Campaigns page first.
          </p>
        )}

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={sending || !selectedTemplateId}>
            {sending ? "Sending..." : "Confirm & Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
