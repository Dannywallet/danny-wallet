"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Activity, Compass, Swap, Settings } from "./Icons";
import { useI18n } from "@/lib/wallet/i18n";

const ITEMS = [
  { href: "/wallet/home", label: "nav.home", Icon: Home },
  { href: "/wallet/activity", label: "nav.activityTab", Icon: Activity },
  { href: "/wallet/explorer", label: "Explorer", Icon: Compass },
  { href: "/wallet/swap", label: "common.swap", Icon: Swap },
  { href: "/wallet/settings", label: "settings.title", Icon: Settings },
];

export function BottomNav() {
  const { t } = useI18n();
  const path = usePathname();
  return (
    <nav className="dw-glass-strong relative z-20 grid grid-cols-5 gap-1 border-t border-white/10 px-2 pb-5 pt-2">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = path === href;
        return (
          <Link
            key={href}
            href={href}
            className="group flex flex-col items-center gap-1 rounded-2xl py-1.5 transition"
          >
            <span
              className={`grid h-10 w-10 place-items-center rounded-2xl transition ${
                active ? "dw-btn-primary" : "text-[var(--dw-muted)] group-hover:text-[var(--dw-text)]"
              }`}
            >
              <Icon size={21} />
            </span>
            <span
              className={`text-[10px] ${active ? "text-[var(--dw-text)]" : "text-[var(--dw-muted)]"}`}
            >
              {t(label)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
