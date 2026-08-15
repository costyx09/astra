"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/auction/live", label: "Asta" },
  { href: "/auction/reparto", label: "Reparto" },
  { href: "/auction/teams", label: "Squadre" },
  { href: "/auction/roster", label: "Rosa" },
  { href: "/auction/market", label: "Mercato" },
  { href: "/auction/players", label: "Giocatori" },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b px-2 py-1.5"
      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="touch-target shrink-0 rounded-lg px-3.5 text-sm font-medium transition-colors"
            style={{
              color: active ? "#0b0e14" : "var(--color-text-muted)",
              backgroundColor: active ? "var(--color-brand)" : "transparent",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
