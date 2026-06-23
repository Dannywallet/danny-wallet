"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Activity, Compass, Swap, Settings } from "./Icons";

const ITEMS = [
  { href: "/wallet/home", label: "หน้าหลัก", Icon: Home },
  { href: "/wallet/activity", label: "กิจกรรม", Icon: Activity },
  { href: "/wallet/explorer", label: "Explorer", Icon: Compass },
  { href: "/wallet/swap", label: "สลับ", Icon: Swap },
  { href: "/wallet/settings", label: "ตั้งค่า", Icon: Settings },
];

export function BottomNav() {
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
                active ? "dw-btn-primary" : "text-[var(--dw-muted)] group-hover:text-white"
              }`}
            >
              <Icon size={21} />
            </span>
            <span
              className={`text-[10px] ${active ? "text-white" : "text-[var(--dw-muted)]"}`}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
