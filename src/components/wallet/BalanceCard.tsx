"use client";

import React from "react";
import { formatUsd, formatChange } from "@/lib/wallet/format";
import { shortAddress } from "@/lib/wallet/format";
import { Eye, EyeOff, ChevronRight } from "./Icons";

export function BalanceCard({
  total,
  change,
  hidden,
  onToggleHidden,
  address,
  accountName,
  onAccountClick,
}: {
  total: number;
  change: number;
  hidden: boolean;
  onToggleHidden: () => void;
  address: string | null;
  accountName?: string;
  onAccountClick?: () => void;
}) {
  const up = change >= 0;

  return (
    <div className="dw-glass-strong dw-glow-violet relative overflow-hidden rounded-[28px] p-5">
      {/* แสงไล่เฉดมุมการ์ด */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-50 blur-2xl"
        style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)" }}
      />
      <div className="relative flex items-center justify-between gap-2">
        <button
          onClick={onAccountClick}
          className="dw-btn-ghost flex min-w-0 max-w-[78%] items-center gap-1.5 rounded-full px-3 py-1 text-xs"
        >
          <span className="shrink-0 font-medium text-white">{accountName || "บัญชี"}</span>
          <span className="truncate text-[var(--dw-muted)]">{address ? shortAddress(address) : "—"}</span>
          <ChevronRight size={13} className="shrink-0 text-[var(--dw-muted)]" />
        </button>
        <button
          onClick={onToggleHidden}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--dw-muted)] hover:text-white"
          aria-label="สลับการแสดงยอด"
        >
          {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      <div className="relative mt-4 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[var(--dw-muted)]">ยอดรวมทั้งหมด</p>
          <p className="mt-1 truncate text-[clamp(1.75rem,9vw,2.25rem)] font-bold leading-tight tabular-nums tracking-tight">
            {hidden ? "••••••" : formatUsd(total)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                up
                  ? "bg-[var(--dw-green)]/12 text-[var(--dw-green)]"
                  : "bg-[var(--dw-rose)]/12 text-[var(--dw-rose)]"
              }`}
            >
              {up ? "▲" : "▼"} {formatChange(change)}
            </span>
            <span className="text-xs text-[var(--dw-muted)]">24 ชม.</span>
          </div>
        </div>
        {/* รูป Mockup เหรียญ DAN ด้านขวา (แทนโลโก้ DX) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/danny-mockup1.png"
          alt="เหรียญ DAN"
          draggable={false}
          className="dw-float h-20 w-auto max-w-[104px] shrink-0 object-contain opacity-95 drop-shadow-[0_8px_22px_rgba(249,187,75,0.4)]"
        />
      </div>
    </div>
  );
}
