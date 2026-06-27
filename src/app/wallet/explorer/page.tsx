"use client";

import React from "react";
import Link from "next/link";
import { Screen } from "@/components/wallet/PhoneShell";
import { BottomNav } from "@/components/wallet/BottomNav";
import { SecurityBadge } from "@/components/wallet/SecurityBadge";
import { Sheet } from "@/components/wallet/Sheet";
import { DappBrowser } from "@/components/wallet/DappBrowser";
import { CHAIN } from "@/lib/wallet/mock-data";
import { formatUsd } from "@/lib/wallet/format";
import { Warn, Scan, Swap, ChevronRight, Globe, Check, Copy } from "@/components/wallet/Icons";
import { useI18n } from "@/lib/wallet/i18n";

const EXPLORER = "https://dannyscan.com";

// dApp ในระบบนิเวศ Danny Chain
const DAPPS = [
  { name: "dandex", desc: "connect.descDex", url: "https://dandex.io", tag: "DX", gradient: "linear-gradient(135deg,#7c3aed,#22d3ee)" },
  { name: "Dannybridge", desc: "connect.descBridge", url: "https://dannybridge.com", tag: "BR", gradient: "linear-gradient(135deg,#22d3ee,#34d399)" },
  { name: "Dancharts", desc: "connect.descCharts", url: "https://dancharts.com", tag: "CH", gradient: "linear-gradient(135deg,#f59e0b,#f43f5e)" },
  { name: "Dannyscan", desc: "connect.descExplorer", url: "https://dannyscan.com", tag: "SC", gradient: "linear-gradient(135deg,#6366f1,#a855f7)" },
];

type LookupResult =
  | { type: "tx"; hash: string; status: string; from: string; to: string; valueDan: number; feeDan: number; block: number | null; method: string | null; timestamp: number | null }
  | { type: "address"; address: string; balanceDan: number; isContract: boolean; hasTokens: boolean; hasTransfers: boolean }
  | { type: "block"; height: number; txCount: number; miner: string; minerShort: string; gasUsedPct: number; hash: string; timestamp: number | null }
  | { type: "notfound" | "invalid" | "empty" | "error" | "loading"; q?: string };

type Block = { height: number; txCount: number; miner: string; timestamp: number; gasUsedPct: number };
type Tx = {
  hash: string; hashShort: string; from: string; to: string;
  valueDan: number; method: string | null; status: string; timestamp: number;
};
type Resp = {
  stats: {
    totalBlocks: number; totalTransactions: number; totalAddresses: number;
    txToday: number; avgBlockTimeSec: number; gasPrice: number | null; utilizationPct: number;
  };
  blocks: Block[];
  txs: Tx[];
  error?: string;
};

function compact(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(n);
}
function ago(ts: number, tr: (k: string) => string): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s} ${tr("time.sec")}`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} ${tr("time.min")}`;
  return `${Math.round(m / 60)} ${tr("time.hour")}`;
}

export default function ExplorerPage() {
  const { t: tr } = useI18n();
  const [data, setData] = React.useState<Resp | null>(null);
  const [state, setState] = React.useState<"loading" | "ok" | "error">("loading");
  const [tab, setTab] = React.useState<"tx" | "block">("tx");
  const [q, setQ] = React.useState("");
  const [result, setResult] = React.useState<LookupResult | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);
  const [dappUrl, setDappUrl] = React.useState("");
  const [inAppUrl, setInAppUrl] = React.useState<string | null>(null);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1300);
    } catch {
      /* noop */
    }
  };

  const load = React.useCallback(() => {
    setState("loading");
    fetch("/api/danny/explorer")
      .then((r) => r.json())
      .then((j: Resp) => {
        if (j.error && !j.blocks?.length) setState("error");
        else {
          setData(j);
          setState("ok");
        }
      })
      .catch(() => setState("error"));
  }, []);

  React.useEffect(() => {
    load();
    const id = setInterval(load, 15000); // รีเฟรชสด
    return () => clearInterval(id);
  }, [load]);

  const search = async () => {
    const v = q.trim();
    if (!v) return;
    setResult({ type: "loading" });
    try {
      const r = await fetch(`/api/danny/lookup?q=${encodeURIComponent(v)}`);
      setResult(await r.json());
    } catch {
      setResult({ type: "error" });
    }
  };

  const openDapp = (url?: string) => {
    let u = (url ?? dappUrl).trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
      setInAppUrl(parsed.href); // เปิดใน dApp browser ในแอป
    } catch {
      /* URL ไม่ถูกต้อง */
    }
  };

  return (
    <>
      <div className="relative z-10 flex items-center justify-between px-5 pb-1 pt-6">
        <div>
          <h1 className="text-xl font-bold">Explorer</h1>
          <p className="flex items-center gap-1.5 text-xs text-[var(--dw-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--dw-green)] dw-pulse-ring" />
            {CHAIN.name} {tr("explorer.liveFrom")}
          </p>
        </div>
        <SecurityBadge label={tr("common.liveData")} />
      </div>

      <Screen className="pt-3">
        {/* ค้นหา */}
        <div className="dw-glass mb-4 flex items-center gap-2 rounded-2xl px-4 py-3 focus-within:border-[var(--dw-cyan)]/50">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder={tr("explorer.searchPlaceholder")}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--dw-muted)]"
            style={{ color: "var(--dw-text)" }}
          />
          <button onClick={search} className="text-[var(--dw-cyan)]"><Scan size={18} /></button>
        </div>

        {/* เปิด dApp */}
        <div className="mb-4">
          <p className="mb-2 px-1 text-xs font-medium text-[var(--dw-muted)]">{tr("explorer.openDapp")}</p>
          <div className="dw-glass flex items-center gap-2 rounded-2xl px-4 py-3 focus-within:border-[var(--dw-cyan)]/50">
            <Globe size={16} className="shrink-0 text-[var(--dw-muted)]" />
            <input
              value={dappUrl}
              onChange={(e) => setDappUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && openDapp()}
              placeholder={tr("explorer.dappUrlPlaceholder")}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--dw-muted)]"
              style={{ color: "var(--dw-text)" }}
            />
            <button
              onClick={() => openDapp()}
              disabled={!dappUrl.trim()}
              className="dw-btn-primary rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
            >
              {tr("common.open")}
            </button>
          </div>
          {/* ปุ่มลัด dApp ในระบบนิเวศ */}
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {DAPPS.map((d) => (
              <button
                key={d.url}
                onClick={() => openDapp(d.url)}
                className="dw-glass flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
              >
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-white"
                  style={{ background: d.gradient }}
                >
                  {d.tag}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.name}</p>
                  <p className="truncate text-[11px] text-[var(--dw-muted)]">{tr(d.desc)}</p>
                </div>
              </button>
            ))}
          </div>
          <Link
            href="/wallet/connect"
            className="dw-glass mt-2.5 flex items-center justify-between rounded-xl px-4 py-3 transition hover:bg-white/[0.06]"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--dw-cyan)]/15 text-[var(--dw-cyan)]">
                <Scan size={15} />
              </span>
              {tr("explorer.connectWc")}
            </span>
            <ChevronRight size={16} className="text-[var(--dw-muted)]" />
          </Link>
          <p className="mt-2 flex items-center gap-1 px-1 text-[11px] text-[var(--dw-muted)]">
            <Warn size={12} className="text-[var(--dw-amber)]" /> {tr("explorer.dappWarn")}
          </p>
        </div>

        {state === "error" && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Warn size={30} className="text-[var(--dw-rose)]" />
            <p className="text-sm text-[var(--dw-muted)]">{tr("activity.connectFailed")}</p>
            <button onClick={load} className="dw-btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold">{tr("common.retry")}</button>
          </div>
        )}

        {state === "loading" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="dw-glass dw-shimmer h-20 rounded-2xl" />)}
            </div>
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="dw-glass dw-shimmer h-14 rounded-2xl" />)}
          </div>
        )}

        {state === "ok" && data && (
          <>
            {/* สถิติเครือข่าย */}
            <div className="grid grid-cols-2 gap-2.5">
              <Stat label={tr("explorer.latestBlock")} value={`#${compact(data.stats.totalBlocks)}`} />
              <Stat label={tr("explorer.totalTx")} value={compact(data.stats.totalTransactions)} />
              <Stat label={tr("explorer.totalAddr")} value={compact(data.stats.totalAddresses)} />
              <Stat label={tr("explorer.blockTime")} value={`${data.stats.avgBlockTimeSec.toFixed(1)} ${tr("time.sec")}`} />
            </div>
            <div className="dw-glass mt-2.5 flex items-center justify-between rounded-2xl px-4 py-3 text-sm">
              <span className="text-[var(--dw-muted)]">{tr("explorer.txToday")}</span>
              <span className="font-semibold tabular-nums">{compact(data.stats.txToday)}</span>
              <span className="text-[var(--dw-muted)]">{tr("explorer.networkUsage")}</span>
              <span className="font-semibold tabular-nums">{(data.stats.utilizationPct * 100).toFixed(2)}%</span>
            </div>

            {/* แท็บ */}
            <div className="dw-glass mt-4 flex gap-1 rounded-2xl p-1">
              {([["tx", tr("activity.recentTx")], ["block", tr("explorer.recentBlocks")]] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${
                    tab === k ? "dw-btn-primary" : "text-[var(--dw-muted)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-3 space-y-2.5">
              {tab === "tx"
                ? data.txs.map((t) => (
                    <a
                      key={t.hash}
                      href={`${EXPLORER}/tx/${t.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dw-glass flex items-center gap-3 rounded-2xl px-3.5 py-3 transition hover:bg-white/[0.06]"
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                          t.status === "ok"
                            ? "bg-[var(--dw-green)]/12 text-[var(--dw-green)]"
                            : t.status === "error"
                            ? "bg-[var(--dw-rose)]/12 text-[var(--dw-rose)]"
                            : "bg-[var(--dw-amber)]/12 text-[var(--dw-amber)]"
                        }`}
                      >
                        <Swap size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-sm">{t.hashShort}</p>
                        <p className="truncate text-xs text-[var(--dw-muted)]">
                          {t.from} → {t.to || tr("explorer.createContract")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">{t.valueDan > 0 ? `${compact(t.valueDan)} DAN` : "—"}</p>
                        <p className="text-[11px] text-[var(--dw-muted)]">{ago(t.timestamp, tr)}</p>
                      </div>
                    </a>
                  ))
                : data.blocks.map((b) => (
                    <a
                      key={b.height}
                      href={`${EXPLORER}/block/${b.height}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dw-glass flex items-center gap-3 rounded-2xl px-3.5 py-3 transition hover:bg-white/[0.06]"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--dw-violet)]/15 text-[var(--dw-purple)]">
                        <Globe size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold tabular-nums">#{b.height}</p>
                        <p className="truncate text-xs text-[var(--dw-muted)]">{tr("explorer.minerPre")} {b.miner}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">{b.txCount} {tr("explorer.txCountSuf")}</p>
                        <p className="text-[11px] text-[var(--dw-muted)]">{ago(b.timestamp, tr)}</p>
                      </div>
                    </a>
                  ))}
            </div>

            <a
              href={EXPLORER}
              target="_blank"
              rel="noopener noreferrer"
              className="dw-glass mt-3 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm text-[var(--dw-muted)] hover:text-white"
            >
              {tr("explorer.openFullDannyscan")} <ChevronRight size={16} />
            </a>
          </>
        )}
      </Screen>

      {/* ผลค้นหา (ในแอป) */}
      <Sheet open={!!result} onClose={() => setResult(null)} title={tr("explorer.searchResult")}>
        {!result ? null : result.type === "loading" ? (
          <div className="space-y-2.5">
            <div className="dw-glass dw-shimmer h-16 rounded-2xl" />
            <div className="dw-glass dw-shimmer h-24 rounded-2xl" />
          </div>
        ) : result.type === "tx" ? (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  result.status === "ok" ? "bg-[var(--dw-green)]/12 text-[var(--dw-green)]" : "bg-[var(--dw-rose)]/12 text-[var(--dw-rose)]"
                }`}
              >
                {result.status === "ok" ? tr("tx.statusSuccess") : tr("tx.statusFailed")}
              </span>
              <span className="text-xs text-[var(--dw-muted)]">{tr("explorer.txLabel")}</span>
            </div>
            <div className="dw-glass space-y-3 rounded-2xl p-4 text-sm">
              <RowCopy label="Hash" value={result.hash} short onCopy={copy} copied={copied} />
              <RowCopy label={tr("send.from")} value={result.from} short onCopy={copy} copied={copied} />
              <RowCopy label={tr("send.to")} value={result.to || tr("explorer.createContract")} short onCopy={copy} copied={copied} />
              <Row label={tr("explorer.value")} value={result.valueDan > 0 ? `${result.valueDan.toLocaleString("en-US", { maximumFractionDigits: 6 })} DAN` : "0 DAN"} />
              <Row label={tr("explorer.fee")} value={`${result.feeDan.toLocaleString("en-US", { maximumFractionDigits: 8 })} DAN`} />
              <Row label={tr("explorer.block")} value={result.block != null ? `#${result.block}` : "—"} />
              {result.method && <Row label={tr("explorer.function")} value={result.method} />}
            </div>
            <ExplorerLink href={`${EXPLORER}/tx/${result.hash}`} />
          </div>
        ) : result.type === "address" ? (
          <div>
            <div className="dw-glass-strong mb-3 rounded-2xl p-4 text-center">
              <p className="text-xs text-[var(--dw-muted)]">{result.isContract ? tr("explorer.smartContract") : tr("explorer.wallet")}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {result.balanceDan.toLocaleString("en-US", { maximumFractionDigits: 4 })} DAN
              </p>
            </div>
            <div className="dw-glass space-y-3 rounded-2xl p-4 text-sm">
              <RowCopy label={tr("explorer.address")} value={result.address} short onCopy={copy} copied={copied} />
              <Row label={tr("explorer.type")} value={result.isContract ? "Contract" : tr("explorer.eoaWallet")} />
              <Row label={tr("explorer.hasTokens")} value={result.hasTokens ? tr("common.yes") : tr("common.no")} />
            </div>
            <ExplorerLink href={`${EXPLORER}/address/${result.address}`} />
          </div>
        ) : result.type === "block" ? (
          <div>
            <div className="dw-glass-strong mb-3 rounded-2xl p-4 text-center">
              <p className="text-xs text-[var(--dw-muted)]">{tr("explorer.block")}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">#{result.height}</p>
            </div>
            <div className="dw-glass space-y-3 rounded-2xl p-4 text-sm">
              <Row label={tr("explorer.txLabel")} value={`${result.txCount} ${tr("explorer.itemsSuf")}`} />
              <RowCopy label={tr("explorer.minerPre")} value={result.miner} short onCopy={copy} copied={copied} />
              <Row label={tr("explorer.gasUsed")} value={`${result.gasUsedPct.toFixed(2)}%`} />
            </div>
            <ExplorerLink href={`${EXPLORER}/block/${result.height}`} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Warn size={28} className="text-[var(--dw-amber)]" />
            <p className="text-sm text-[var(--dw-muted)]">
              {result.type === "notfound" ? tr("explorer.notFound") : result.type === "invalid" ? tr("explorer.invalidFormat") : tr("explorer.error")}
            </p>
          </div>
        )}
      </Sheet>

      {/* dApp browser ในแอป */}
      {inAppUrl && <DappBrowser url={inAppUrl} onClose={() => setInAppUrl(null)} />}

      <BottomNav />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-[var(--dw-muted)]">{label}</span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  );
}

function RowCopy({
  label, value, short, onCopy, copied,
}: {
  label: string; value: string; short?: boolean; onCopy: (v: string) => void; copied: string | null;
}) {
  const display = short && value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
  return (
    <button onClick={() => onCopy(value)} className="flex w-full items-center justify-between gap-3 text-left">
      <span className="shrink-0 text-[var(--dw-muted)]">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs font-medium">
        <span className="truncate">{display}</span>
        {copied === value ? <Check size={13} className="shrink-0 text-[var(--dw-green)]" /> : <Copy size={13} className="shrink-0 text-[var(--dw-muted)]" />}
      </span>
    </button>
  );
}

function ExplorerLink({ href }: { href: string }) {
  const { t: tr } = useI18n();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="dw-glass mt-3 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs text-[var(--dw-muted)] hover:text-white"
    >
      <Globe size={14} /> {tr("explorer.viewFullDannyscan")}
    </a>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="dw-glass rounded-2xl px-4 py-3">
      <p className="text-xs text-[var(--dw-muted)]">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
