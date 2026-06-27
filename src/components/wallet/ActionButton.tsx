"use client";

import React from "react";
import Link from "next/link";

export function ActionButton({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="group flex flex-1 flex-col items-center gap-2">
      <span className="dw-btn-ghost grid h-14 w-14 place-items-center rounded-2xl text-[var(--dw-text)] transition group-hover:border-[var(--dw-cyan)]/50 group-hover:text-[var(--dw-cyan)] group-active:scale-95">
        {children}
      </span>
      <span className="text-xs text-[var(--dw-muted)]">{label}</span>
    </Link>
  );
}
