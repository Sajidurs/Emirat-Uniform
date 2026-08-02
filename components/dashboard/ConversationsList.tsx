"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Badge from "./ui/Badge";
import EmptyState from "./ui/EmptyState";
import { ConversationsIcon } from "./icons";

export interface ConversationListItem {
  phone_number: string;
  name: string | null;
  state: string;
  last_seen: string;
  branch: { name: string; location: { name: string } | null } | null;
}

function stateBadge(state: string): { label: string; tone: "gray" | "amber" | "green" } {
  if (state === "active") return { label: "Active", tone: "green" };
  if (state.startsWith("awaiting_branch")) return { label: "Awaiting branch", tone: "amber" };
  if (state === "awaiting_location") return { label: "Awaiting location", tone: "amber" };
  return { label: "New", tone: "gray" };
}

export default function ConversationsList({ customers }: { customers: ConversationListItem[] }) {
  const pathname = usePathname();

  return (
    <div className="flex w-80 shrink-0 flex-col border-r border-slate-200">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {customers.length === 0 ? (
          <EmptyState
            icon={<ConversationsIcon className="h-6 w-6" />}
            title="No conversations yet"
            description="Chats will appear here once customers start messaging the WhatsApp bot."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {customers.map((customer) => {
              const href = `/dashboard/conversations/${encodeURIComponent(customer.phone_number)}`;
              const active = pathname === href;
              const badge = stateBadge(customer.state);
              return (
                <li key={customer.phone_number}>
                  <Link
                    href={href}
                    className={`block px-4 py-3 transition-colors ${
                      active ? "bg-indigo-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-sm font-medium ${
                          active ? "text-indigo-700" : "text-slate-800"
                        }`}
                      >
                        {customer.name ?? customer.phone_number}
                      </span>
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {customer.branch?.location?.name ?? "—"} / {customer.branch?.name ?? "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {new Date(customer.last_seen).toLocaleString()}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
