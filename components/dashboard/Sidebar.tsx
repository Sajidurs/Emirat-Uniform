"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConversationsIcon, LeadsIcon, CampaignsIcon } from "./icons";
import LogoutButton from "./LogoutButton";

const NAV_ITEMS = [
  { href: "/dashboard/conversations", label: "Conversations", icon: ConversationsIcon },
  { href: "/dashboard/leads", label: "Leads", icon: LeadsIcon },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: CampaignsIcon },
];

function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[._-]/).filter(Boolean);
  const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : local.slice(0, 2);
  return initials.toUpperCase();
}

export default function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-slate-200 bg-white px-3 py-5">
      <div className="mb-6 flex items-center gap-2 px-2">
        <Image src="/logo-mark.png" alt="" width={160} height={171} className="h-8 w-auto" />
        <div className="text-sm font-semibold text-slate-900">Emirat Uniform</div>
      </div>

      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-indigo-600" : "text-slate-400"}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
          {initialsFromEmail(userEmail)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-slate-700">{userEmail}</p>
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}
