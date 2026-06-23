"use client";

import React from "react";
import Link from "next/link";
import { Screen } from "@/components/wallet/PhoneShell";
import { TopBar } from "@/components/wallet/TopBar";
import { BottomNav } from "@/components/wallet/BottomNav";
import { TokenIcon } from "@/components/wallet/TokenIcon";
import { SecurityBadge } from "@/components/wallet/SecurityBadge";
import { shortAddress, formatUsd } from "@/lib/wallet/format";
import { CHAIN } from "@/lib/wallet/mock-data";
import { Warn, Check, Copy } from "@/components/wallet/Icons";
import type { DannyToken } from "@/app/api/danny/tokens/route";

const PALETTE: [string, string][] = [
  ["#7c3aed", "#22d3ee"], ["#22d3ee", "#34d399"], ["#f59e0b", "#f43f5e"],
  ["#6366f1", "#a855f7"], ["#ec4899", "#8b5cf6"], ["#0ea5e9", "#14b8a6"],
  ["#f43f5e", "#f59e0b"], ["#10b981", "#3b82f6"],
];
function gradientFor(addr: string): [string, string] {
  let h = 0;
  for (let i = 0; i < addr.length; i++) h = (h * 31 + addr.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function compact(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(n);
}

/** format ราคา USD รองรับค่าน้อยมาก (เช่น $0.0000171) */
function fmtPrice(p: number): string {
  if (p >= 1) return `$${p.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (p === 0) return "$0";
  const decimals = Math.min(12, Math.max(2, -Math.floor(Math.log10(p)) + 2));
  return `$${p.toFixed(decimals)}`;
}

type ApiResp = {
  count: number;
  pricedCount: number;
  source: string;
  fetchedAt: string;
  tokens: DannyToken[];
  error?: string;
};

export default function TokensPage() {
  const [data, setData] = React.useState<ApiResp | null>(null);
  const [state, setState] = React.useState<"loading" | "ok" | "error">("loading");
  const [copied, setCopied] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setState("loading");
    fetch("/api/danny/tokens")
      .then((r) => r.json())
      .then((j: ApiResp) => {
        if (j.error && !j.tokens?.length) setState("error");
        else {
          setData(j);
          setState("ok");
        }
      })
      .catch(() => setState("error"));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const copy = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(addr);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* noop */
    }
  };

  return (
    <>
      <div className="relative z-10 flex items-center justify-between px-5 pb-1 pt-6">
        <div>
          <h1 className="text-xl font-bold">โทเคนบนเชน</h1>
          <p className="flex items-center gap-1.5 text-xs text-[var(--dw-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--dw-green)]" />
            {CHAIN.name} · ดึงสดจาก dannyscan
          </p>
        </div>
        <SecurityBadge label="ข้อมูลจริง" />
      </div>

      <Screen className="pt-3">
        {/* แบนเนอร์เรื่องราคา */}
        <div className="dw-glass mb-4 flex items-start gap-2.5 rounded-2xl border-[var(--dw-amber)]/30 bg-[var(--dw-amber)]/[0.06] p-3.5 text-xs leading-relaxed text-[var(--dw-muted)]">
          <Warn size={16} className="mt-0.5 shrink-0 text-[var(--dw-amber)]" />
          รายชื่อโทเคนและราคาเป็นข้อมูลจริง — โทเคนจาก dannyscan, ราคา/24ชม. จาก dancharts (DEX)
          โทเคนที่ยังไม่มีคู่เทรดบน DEX จะแสดงราคาเป็น “—”
        </div>

        {state === "loading" && (
          <div className="space-y-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="dw-glass dw-shimmer h-16 rounded-2xl" />
            ))}
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Warn size={32} className="text-[var(--dw-rose)]" />
            <p className="text-sm text-[var(--dw-muted)]">เชื่อมต่อ explorer ไม่สำเร็จ</p>
            <button onClick={load} className="dw-btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold">
              ลองใหม่
            </button>
          </div>
        )}

        {state === "ok" && data && (
          <>
            <div className="mb-3 flex items-center justify-between text-xs text-[var(--dw-muted)]">
              <span>{data.count} โทเคน (ERC-20)</span>
              <span>มีราคา {data.pricedCount}/{data.count}</span>
            </div>
            <div className="space-y-2.5">
              {data.tokens.map((t) => {
                const g = gradientFor(t.address);
                return (
                  <div key={t.address} className="dw-glass flex items-center gap-3 rounded-2xl px-3.5 py-3">
                    <TokenIcon symbol={t.symbol} gradient={g} logo={t.logo} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{t.symbol}</p>
                      <button
                        onClick={() => copy(t.address)}
                        className="flex items-center gap-1 text-xs text-[var(--dw-muted)] hover:text-white"
                      >
                        {copied === t.address ? <Check size={11} /> : <Copy size={11} />}
                        {shortAddress(t.address)} · {compact(t.holders)} holders
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">
                        {t.priceUsd != null ? (
                          fmtPrice(t.priceUsd)
                        ) : (
                          <span className="text-[var(--dw-muted)]">—</span>
                        )}
                      </p>
                      {t.priceUsd != null && t.change24h != null ? (
                        <p
                          className={`text-[11px] font-medium tabular-nums ${
                            t.change24h >= 0 ? "text-[var(--dw-green)]" : "text-[var(--dw-rose)]"
                          }`}
                        >
                          {t.change24h >= 0 ? "+" : ""}
                          {t.change24h.toFixed(2)}%
                        </p>
                      ) : (
                        <p className="text-[11px] text-[var(--dw-muted)]">ไม่มีราคา</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* CTA: ขอลงลิสต์โทเคน */}
            <Link
              href="/wallet/listing"
              className="dw-glass-strong mt-4 flex items-center gap-3 rounded-2xl p-4 transition active:scale-[0.99]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">อยากให้โทเคนของคุณขึ้นที่นี่?</p>
                <p className="mt-0.5 text-xs text-[var(--dw-muted)]">ส่งคำขอลงลิสต์ + โลโก้ ให้ทีมงานตรวจสอบ</p>
              </div>
              <span className="dw-btn-primary shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold">ขอลงลิสต์</span>
            </Link>

            <p className="mt-4 text-center text-[11px] text-[var(--dw-muted)]">
              แหล่งข้อมูล: {data.source}
            </p>
          </>
        )}
      </Screen>
      <BottomNav />
    </>
  );
}
