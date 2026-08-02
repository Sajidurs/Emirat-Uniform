"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

const NAV_ITEMS = [
  { href: "/dashboard/conversations", label: "Conversations" },
  { href: "/dashboard/leads", label: "Leads" },
  { href: "/dashboard/campaigns", label: "Campaigns" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col justify-between bg-gray-900 px-3 py-6">
      <div>
        <div className="mb-6 px-3 text-sm font-semibold text-white">Emirat Uniform</div>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm font-medium ${
                  active ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <LogoutButton />
    </aside>
  );
}
