"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/funds", label: "Add Funds" },
  { href: "/funds/bulk", label: "Bulk" },
  { href: "/history", label: "History" },
  { href: "/batches", label: "Batches" },
  { href: "/panels", label: "Panels" },
  { href: "/settings", label: "Settings" },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-2 overflow-x-auto p-3">
      {LINKS.map((link) => {
        const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
              active ? "bg-white/10 text-white" : "text-slate-400"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
