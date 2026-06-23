"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet/wallet-store";
import { Screen } from "@/components/wallet/PhoneShell";
import { BottomNav } from "@/components/wallet/BottomNav";
import { BalanceCard } from "@/components/wallet/BalanceCard";
import { ActionButton } from "@/components/wallet/ActionButton";
import { TokenIcon } from "@/components/wallet/TokenIcon";
import { SecurityBadge } from "@/components/wallet/SecurityBadge";
import { CHAIN } from "@/lib/wallet/mock-data";
import { AccountSwitcher } from "@/components/wallet/AccountSwitcher";
import { formatUsd, formatToken } from "@/lib/wallet/format";
import { ArrowUp, ArrowDown, Swap, Card, Bell, Globe, ChevronRight, Warn } from "@/components/wallet/Icons";
import type { Holding } from "@/app/api/danny/portfolio/route";

const PALETTE: [string, string][] = [
  ["#7c3aed", "#22d3ee"], ["#22d3ee", "#34d399"], ["#f59e0b", "#f43f5e"],
  ["#6366f1", "#a855f7"], ["#ec4899", "#8b5cf6"], ["#0ea5e9", "#14b8a6"],
  ["#f43f5e", "#f59e0b"], ["#10b981", "#3b82f6"],
];
function gradientFor(key: string): [string, string] {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
function fmtPrice(p: number): string {
  if (p >= 1) return `$${p.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (p <= 0) return "$0";
  const d = Math.min(12, Math.max(2, -Math.floor(Math.log10(p)) + 2));
  return `$${p.toFixed(d)}`;
}

type Portfolio = {
  totalUsd: number;
  change24h: number;
  count: number;
  pricedCount: number;
  holdings: Holding[];
  error?: string;
};

function HoldingRow({ h, hidden }: { h: Holding; hidden: boolean }) {
  const g = gradientFor(h.address || h.symbol);
  const up = (h.change24h ?? 0) >= 0;
  return (
    <Link
      href={`/wallet/asset/${h.address ?? "native"}`}
      className="dw-glass flex items-center gap-3 rounded-2xl px-3.5 py-3 transition hover:bg-white/[0.07] active:scale-[0.99]">
      <TokenIcon symbol={h.symbol} gradient={g} logo={h.logo} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">{h.symbol}</p>
          {h.isNative && (
            <span className="rounded-full bg-[var(--dw-violet)]/20 px-1.5 py-0.5 text-[9px] text-[var(--dw-purple)]">
              เนทีฟ
            </span>
          )}
          {h.spam && (
            <span className="rounded-full bg-[var(--dw-rose)]/15 px-1.5 py-0.5 text-[9px] text-[var(--dw-rose)]">
              สแปม
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--dw-muted)]">
          {h.priceUsd != null ? fmtPrice(h.priceUsd) : "ไม่มีราคา"}
        </p>
      </div>
      <div className="text-right">
        <p className="font-semibold tabular-nums">
          {h.valueUsd != null ? (hidden ? "••••" : formatUsd(h.valueUsd)) : <span className="text-[var(--dw-muted)]">—</span>}
        </p>
        <p className="text-xs tabular-nums text-[var(--dw-muted)]">
          {hidden ? "•••" : formatToken(h.balance)} {h.symbol}
        </p>
      </div>
      <span
        className={`ml-1 w-12 text-right text-xs font-medium ${
          h.change24h == null ? "text-[var(--dw-muted)]" : up ? "text-[var(--dw-green)]" : "text-[var(--dw-rose)]"
        }`}
      >
        {h.change24h == null ? "—" : `${up ? "+" : ""}${h.change24h.toFixed(2)}%`}
      </span>
    </Link>
  );
}

export default function Home() {
  const router = useRouter();
  const { hydrated, created, locked, balanceHidden, toggleBalance, address, accounts, activeIndex } = useWallet();
  const [pf, setPf] = React.useState<Portfolio | null>(null);
  const [state, setState] = React.useState<"loading" | "ok" | "error">("loading");
  const [switcher, setSwitcher] = React.useState(false);
  const [showHidden, setShowHidden] = React.useState(false);

  React.useEffect(() => {
    if (!hydrated) return;
    if (!created) router.replace("/wallet");
    else if (locked) router.replace("/wallet/unlock");
    else if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      // ใช้ desktop เมื่อ (ก) ฝังใน iframe เช่น /webwallet หรือ (ข) ผู้ใช้กด Launch App มาทาง /desktop
      let prefer = false;
      try { prefer = sessionStorage.getItem("dw-prefer-desktop") === "1"; } catch { /* noop */ }
      if (window.self !== window.top || prefer) router.replace("/desktop");
    }
  }, [hydrated, created, locked, router]);

  const load = React.useCallback(() => {
    if (!address) return;
    setState("loading");
    fetch(`/api/danny/portfolio?address=${address}`)
      .then((r) => r.json())
      .then((j: Portfolio) => {
        if (j.error && !j.holdings?.length) setState("error");
        else {
          setPf(j);
          setState("ok");
        }
      })
      .catch(() => setState("error"));
  }, [address]);

  React.useEffect(() => {
    if (hydrated && created && !locked) load();
  }, [hydrated, created, locked, load]);

  if (!hydrated || !created || locked) {
    return (
      <Screen className="flex items-center justify-center">
        <div className="text-sm text-[var(--dw-muted)]">กำลังโหลด…</div>
      </Screen>
    );
  }

  return (
    <>
      {/* header */}
      <div className="relative z-10 flex items-center justify-between px-5 pb-1 pt-6">
        <div>
          <p className="text-xs text-[var(--dw-muted)]">เครือข่าย</p>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--dw-green)] dw-pulse-ring" />
            <span className="text-sm font-semibold">{CHAIN.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SecurityBadge label="ข้อมูลจริง" />
          <button className="dw-btn-ghost grid h-9 w-9 place-items-center rounded-full text-[var(--dw-muted)]">
            <Bell size={18} />
          </button>
        </div>
      </div>

      <Screen className="pt-2">
        <BalanceCard
          address={address}
          accountName={accounts[activeIndex]?.name}
          onAccountClick={() => setSwitcher(true)}
          total={pf?.totalUsd ?? 0}
          change={pf?.change24h ?? 0}
          hidden={balanceHidden}
          onToggleHidden={toggleBalance}
        />

        {/* ปุ่มลัด */}
        <div className="mt-5 flex gap-2">
          <ActionButton href="/wallet/send" label="ส่ง"><ArrowUp size={22} /></ActionButton>
          <ActionButton href="/wallet/receive" label="รับ"><ArrowDown size={22} /></ActionButton>
          <ActionButton href="/wallet/swap" label="สลับ"><Swap size={22} /></ActionButton>
          <ActionButton href="/wallet/tokens" label="สำรวจ"><Card size={22} /></ActionButton>
        </div>

        {/* รายการเหรียญจริง */}
        <div className="mt-6 flex items-center justify-between">
          <h2 className="font-semibold">สินทรัพย์ของฉัน</h2>
          <span className="text-xs text-[var(--dw-muted)]">
            {state === "ok" ? `${pf?.count ?? 0} เหรียญ` : ""}
          </span>
        </div>

        {state === "loading" && (
          <div className="mt-3 space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="dw-glass dw-shimmer h-16 rounded-2xl" />
            ))}
          </div>
        )}

        {state === "error" && (
          <div className="mt-3 flex flex-col items-center gap-3 py-10 text-center">
            <Warn size={30} className="text-[var(--dw-rose)]" />
            <p className="text-sm text-[var(--dw-muted)]">โหลดพอร์ตจากเชนไม่สำเร็จ</p>
            <button onClick={load} className="dw-btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold">
              ลองใหม่
            </button>
          </div>
        )}

        {state === "ok" && pf && (() => {
          const visible = pf.holdings.filter((h) => !h.spam);
          const hiddenList = pf.holdings.filter((h) => h.spam);
          return (
            <div className="mt-3 space-y-2.5">
              {visible.length === 0 && hiddenList.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--dw-muted)]">ที่อยู่นี้ยังไม่มีสินทรัพย์</p>
              ) : (
                <>
                  {visible.map((h) => (
                    <HoldingRow key={h.address ?? "native"} h={h} hidden={balanceHidden} />
                  ))}

                  {hiddenList.length > 0 && (
                    <>
                      <button
                        onClick={() => setShowHidden((v) => !v)}
                        className="dw-btn-ghost flex w-full items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs text-[var(--dw-muted)]"
                      >
                        {showHidden ? "ซ่อนเหรียญสแปม" : `แสดงเหรียญที่ซ่อน (${hiddenList.length})`}
                        <ChevronRight
                          size={14}
                          className={`transition-transform ${showHidden ? "rotate-90" : ""}`}
                        />
                      </button>
                      {showHidden &&
                        hiddenList.map((h) => (
                          <HoldingRow key={h.address ?? "native"} h={h} hidden={balanceHidden} />
                        ))}
                    </>
                  )}
                </>
              )}
            </div>
          );
        })()}

        <Link
          href="/wallet/tokens"
          className="dw-glass mt-3 flex items-center justify-between rounded-2xl px-4 py-3 transition hover:bg-white/[0.07]"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--dw-cyan)]/15 text-[var(--dw-cyan)]">
              <Globe size={16} />
            </span>
            สำรวจโทเคนทั้งหมดบนเชน
          </span>
          <ChevronRight size={18} className="text-[var(--dw-muted)]" />
        </Link>

        <p className="mt-5 text-center text-[11px] text-[var(--dw-muted)]">
          พอร์ตจริงของ {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "—"} · ยอดจาก dannyscan, ราคาจาก dancharts
        </p>
      </Screen>

      <AccountSwitcher open={switcher} onClose={() => setSwitcher(false)} />
      <BottomNav />
    </>
  );
}
