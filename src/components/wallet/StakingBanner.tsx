"use client";

// แบนเนอร์ Staking (mockup) — การ์ดโปรโมชันเข้าธีม neon ของกระเป๋า
import React from "react";
import Link from "next/link";
import { ChevronRight } from "./Icons";
import { useI18n } from "@/lib/wallet/i18n";

export function StakingBanner() {
  const { t } = useI18n();
  const uid = React.useId();
  const ring = `stk-ring-${uid}`;
  const coin = `stk-coin-${uid}`;
  const glow = `stk-glow-${uid}`;

  return (
    <Link
      href="/wallet/explorer"
      className="dw-glass-strong dw-glow-violet relative mt-5 block overflow-hidden rounded-[26px] p-5 transition active:scale-[0.99]"
    >
      {/* พื้นไล่เฉด + แสง */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(110deg, rgba(124,58,237,0.30), rgba(34,211,238,0.12) 60%, transparent)" }}
      />
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-44 w-44 rounded-full opacity-60 blur-2xl"
        style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)" }}
      />

      <div className="relative flex items-center gap-3">
        {/* ข้อความซ้าย */}
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--dw-violet)]/25 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--dw-purple)]">
            ✦ STAKING
          </span>
          <h3 className="mt-2 text-lg font-bold leading-snug">
            {t("banner.stakePre")} <span className="dw-text-grad">DAN</span> {t("banner.stakeSuf")}
          </h3>
          <p className="mt-1 text-xs text-[var(--dw-muted)]">
            {t("banner.stakeApyPre")} <span className="font-semibold text-[var(--dw-green)]">~18.2% APY</span> {t("banner.stakeApySuf")}
          </p>
          <span className="dw-btn-primary mt-3 inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold">
            {t("banner.startStake")} <ChevronRight size={14} />
          </span>
        </div>

        {/* ภาพประกอบ SVG */}
        <svg width="104" height="104" viewBox="0 0 104 104" fill="none" className="shrink-0 dw-float" aria-hidden="true">
          <defs>
            <linearGradient id={ring} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="55%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#d946ef" />
            </linearGradient>
            <linearGradient id={coin} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f9bb4b" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            <filter id={glow} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* วงแหวน APY */}
          <circle cx="52" cy="46" r="34" stroke="rgba(255,255,255,0.08)" strokeWidth="8" fill="none" />
          <circle
            cx="52" cy="46" r="34"
            stroke={`url(#${ring})`} strokeWidth="8" fill="none" strokeLinecap="round"
            strokeDasharray="214" strokeDashoffset="58"
            transform="rotate(-90 52 46)" filter={`url(#${glow})`}
          />
          <text x="52" y="44" textAnchor="middle" fontSize="18" fontWeight="800" fill="#ffffff">18%</text>
          <text x="52" y="58" textAnchor="middle" fontSize="9" fill="#8a97b1">APY</text>

          {/* เหรียญซ้อน */}
          <g filter={`url(#${glow})`}>
            <ellipse cx="34" cy="86" rx="20" ry="7" fill={`url(#${coin})`} opacity="0.55" />
            <ellipse cx="34" cy="81" rx="20" ry="7" fill={`url(#${coin})`} opacity="0.8" />
            <ellipse cx="34" cy="76" rx="20" ry="7" fill={`url(#${coin})`} />
            <text x="34" y="79.5" textAnchor="middle" fontSize="8" fontWeight="800" fill="#4a1b0c">DAN</text>
          </g>
          {/* ประกาย */}
          <path d="M86 70 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#22d3ee" opacity="0.9" />
          <circle cx="84" cy="30" r="2" fill="#d946ef" />
        </svg>
      </div>
    </Link>
  );
}
