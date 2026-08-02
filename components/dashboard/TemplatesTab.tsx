"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Template } from "@/lib/types";
import Button from "./ui/Button";
import Select from "./ui/Select";
import Badge from "./ui/Badge";
import EmptyState from "./ui/EmptyState";
import { CampaignsIcon, PlusIcon, RefreshIcon } from "./icons";

const STATUS_TONE: Record<Template["status"], "green" | "amber" | "red"> = {
  approved: "green",
  pending: "amber",
  rejected: "red",
};

export default function TemplatesTab({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<"marketing" | "utility">("marketing");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/dashboard/templates/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, body, category }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      setName("");
      setBody("");
      setCategory("marketing");
      setShowForm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setCreating(false);
    }
  }

  async function handleRefreshStatus(id: number) {
    setRefreshingId(id);
    try {
      const res = await fetch("/api/dashboard/templates/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) router.refresh();
    } finally {
      setRefreshingId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant={showForm ? "secondary" : "primary"} onClick={() => setShowForm((v) => !v)}>
          {!showForm && <PlusIcon className="h-4 w-4" />}
          {showForm ? "Cancel" : "Create New Template"}
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. weekend_promo"
              className="w-full rounded-lg border-0 px-3 py-2 text-sm text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Body (use {"{{1}}"}, {"{{2}}"} for variables)
            </label>
            <textarea
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="Hi {{1}}, enjoy 20% off this weekend at Emirat Uniform!"
              className="w-full rounded-lg border-0 px-3 py-2 text-sm text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Category</label>
            <Select value={category} onChange={(e) => setCategory(e.target.value as "marketing" | "utility")}>
              <option value="marketing">Marketing</option>
              <option value="utility">Utility</option>
            </Select>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <Button type="submit" variant="primary" disabled={creating}>
            {creating ? "Submitting to Meta..." : "Submit for Approval"}
          </Button>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {templates.length === 0 ? (
          <EmptyState
            icon={<CampaignsIcon className="h-6 w-6" />}
            title="No templates yet"
            description="Create a template above and submit it to Meta for approval."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {templates.map((t) => (
                  <tr key={t.id} className="odd:bg-white even:bg-slate-50/40 transition-colors hover:bg-indigo-50/40">
                    <td className="px-4 py-3.5 font-medium text-slate-800">{t.name}</td>
                    <td className="px-4 py-3.5 text-slate-600 capitalize">{t.category ?? "—"}</td>
                    <td className="px-4 py-3.5">
                      <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
                    </td>
                    <td className="px-4 py-3.5 text-slate-400">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRefreshStatus(t.id)}
                        disabled={refreshingId === t.id || !t.meta_template_id}
                      >
                        <RefreshIcon className={`h-3.5 w-3.5 ${refreshingId === t.id ? "animate-spin" : ""}`} />
                        {refreshingId === t.id ? "Checking..." : "Refresh Status"}
                      </Button>
                    </td>
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
