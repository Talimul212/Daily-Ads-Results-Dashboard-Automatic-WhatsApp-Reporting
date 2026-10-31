"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, LineChart, Settings } from "lucide-react";

const LINKS = [
  { href: "/", label: "Daily Overview", icon: BarChart3, adminOnly: false },
  { href: "/ads-test", label: "Campaign Reports", icon: LineChart, adminOnly: true },
  { href: "/settings", label: "Clients & Accounts", icon: Settings, adminOnly: true },
];

export function AppNav({ admin, compact = false }: { admin: boolean; compact?: boolean }) {
  const pathname = usePathname();
  const links = LINKS.filter((l) => admin || !l.adminOnly);

  return (
    <nav className={compact ? "flex items-center gap-1" : "flex flex-col gap-1 p-3"}>
      {!compact && (
        <span className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Workspace
        </span>
      )}
      {links.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            className={`flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors ${
              compact ? "p-2" : "px-3 py-2"
            } ${
              active
                ? "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon className={`w-4 h-4 ${active ? "text-indigo-600" : "text-slate-400"}`} />
            {!compact && label}
          </Link>
        );
      })}
    </nav>
  );
}
