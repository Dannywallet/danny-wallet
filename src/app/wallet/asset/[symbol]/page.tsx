"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Screen } from "@/components/wallet/PhoneShell";
import { TopBar } from "@/components/wallet/TopBar";
import { TokenIcon } from "@/components/wallet/TokenIcon";
import { PriceChart, type ChartPoint } from "@/components/wallet/PriceChart";
import { CandleChart } from "@/components/wallet/CandleChart";
import { TxRow } from "@/components/wallet/TxRow";
import { CHAIN, type Tx } from "@/lib/wallet/mock-data";
import { useWallet } from "@/lib/wallet/wallet-store";
import { formatUsd, formatToken, shortAddress } from "@/lib/wallet/format";
import { ArrowUp, ArrowDown, Swap, Warn, Globe, Copy, Check } from "@/components/wallet/Icons";
import { useI18n } from "@/lib/wallet/i18n";
import type { Holding } from "@/app/api/danny/portfolio/route";
import type { DannyToken } from "@/app/api/danny/tokens/route";
import { WDAN } from "@/lib/wallet/danny-prices";

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
function compact(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(n);
}

// คู่ WDAN/USDT บน dancharts — ใช้แสดงกราฟราคา DAN (native)
const WDAN_USDT_PAIR = "0xce79470c765cfd64274b0d43128746bdf9e3a5d2";

export default function AssetDetail() {
  const { t: tr } = useI18n();
  const params = useParams();
  const { address } = useWallet();
  const MY_ADDRESS = address ?? "";
  const id = String(params.symbol || "").toLowerCase(); // contract address หรือ "native"
  const [holding, setHolding] = React.useState<Holding | null>(null);
  const [market, setMarket] = React.useState<DannyToken | null>(null);
  const [txs, setTxs] = React.useState<Tx[]>([]);
  const [state, setState] = React.useState<"loading" | "ok" | "notfound" | "error">("loading");
  const [copied, setCopied] = React.useState(false);
  const [chart, setChart] = React.useState<ChartPoint[] | null>(null);
  const [chartState, setChartState] = React.useState<"loading" | "ok" | "empty">("loading");
  const [chartType, setChartType] = React.useState<"candle" | "line">("candle");
  const [range, setRange] = React.useState<"1h" | "24h" | "7d">("24h");
  const [chartChange, setChartChange] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!MY_ADDRESS) return;
    let alive = true;
    setState("loading");
    Promise.all([
      fetch(`/api/danny/portfolio?address=${MY_ADDRESS}`).then((r) => r.json()),
      fetch(`/api/danny/tokens`).then((r) => r.json()),
      fetch(`/api/danny/activity?address=${MY_ADDRESS}`).then((r) => r.json()),
    ])
      .then(([pf, tk, act]) => {
        if (!alive) return;
        const h: Holding | undefined = (pf.holdings || []).find((x: Holding) =>
          id === "native" ? x.isNative : (x.address || "").toLowerCase() === id
        );
        if (!h) {
          setState("notfound");
          return;
        }
        // native DAN ไม่มี entry ใน /tokens (ลิสต์เฉพาะ ERC-20) → ใช้ข้อมูล WDAN เป็นตัวแทน
        // (marketCap/วอลุ่มจาก dancharts + holders/supply จาก dannyscan)
        const matchId = id === "native" ? WDAN.toLowerCase() : id;
        const m: DannyToken | undefined = (tk.tokens || []).find(
          (x: DannyToken) => (x.address || "").toLowerCase() === matchId
        );
        const related = (act.txs || []).filter((t: Tx) => t.token === h.symbol);
        setHolding(h);
        setMarket(m || null);
        setTxs(related);
        setState("ok");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [id, MY_ADDRESS]);

  // ดึงข้อมูลกราฟราคา (on-chain) เมื่อรู้ pair ของสินทรัพย์
  React.useEffect(() => {
    if (state !== "ok" || !holding) return;
    const pairAddr = market?.pair ?? (holding.isNative ? WDAN_USDT_PAIR : null);
    if (!pairAddr) {
      setChartState("empty");
      return;
    }
    let alive = true;
    setChartState("loading");
    fetch(`/api/danny/chart?pair=${pairAddr}&range=${range}`)
      .then((r) => r.json())
      .then((j: { points?: ChartPoint[]; change24h?: number | null }) => {
        if (!alive) return;
        if (j.points && j.points.length >= 2) {
          setChart(j.points);
          setChartChange(typeof j.change24h === "number" ? j.change24h : null);
          setChartState("ok");
        } else {
          setChartState("empty");
        }
      })
      .catch(() => alive && setChartState("empty"));
    return () => {
      alive = false;
    };
  }, [state, holding, market, range]);

  const copy = async () => {
    if (!holding?.address) return;
    try {
      await navigator.clipboard.writeText(holding.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1300);
    } catch {
      /* noop */
    }
  };

  if (state === "loading") {
    return (
      <>
        <TopBar title={tr("asset.asset")} />
        <Screen className="space-y-3">
          <div className="dw-glass dw-shimmer h-28 rounded-3xl" />
          <div className="dw-glass dw-shimmer h-24 rounded-2xl" />
          <div className="dw-glass dw-shimmer h-40 rounded-2xl" />
        </Screen>
      </>
    );
  }

  if (state === "notfound" || state === "error" || !holding) {
    return (
      <>
        <TopBar title={tr("asset.asset")} />
        <Screen className="flex flex-col items-center justify-center gap-3 pt-20 text-center">
          <Warn size={32} className="text-[var(--dw-rose)]" />
          <p className="text-sm text-[var(--dw-muted)]">
            {state === "notfound" ? tr("asset.notFound") : tr("asset.loadFailed")}
          </p>
          <Link href="/wallet/home" className="dw-btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold">
            {tr("asset.backHome")}
          </Link>
        </Screen>
      </>
    );
  }

  const up = (holding.change24h ?? 0) >= 0;
  const g = gradientFor(holding.address || holding.symbol);
  const explorerUrl = holding.address
    ? `${CHAIN.explorer}/token/${holding.address}`
    : `${CHAIN.explorer}/address/${MY_ADDRESS}`;

  return (
    <>
      <TopBar
        title={holding.name}
        right={<TokenIcon symbol={holding.symbol} gradient={g} size={30} logo={holding.logo} />}
      />
      <Screen>
        {/* ราคา */}
        <div className="flex flex-col items-center pt-2 text-center">
          <p className="text-sm text-[var(--dw-muted)]">{tr("asset.pricePre")} {holding.symbol}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            {holding.priceUsd != null ? fmtPrice(holding.priceUsd) : tr("common.noPrice")}
          </p>
          {holding.change24h != null && (
            <span
              className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                up ? "bg-[var(--dw-green)]/12 text-[var(--dw-green)]" : "bg-[var(--dw-rose)]/12 text-[var(--dw-rose)]"
              }`}
            >
              {up ? "▲" : "▼"} {Math.abs(holding.change24h).toFixed(2)}% · {tr("chart.24h")}
            </span>
          )}
        </div>

        {/* ยอดถือครอง */}
        <div className="dw-glass-strong mt-5 flex items-center justify-between rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <TokenIcon symbol={holding.symbol} gradient={g} logo={holding.logo} />
            <div>
              <p className="text-xs text-[var(--dw-muted)]">{tr("asset.holdings")}</p>
              <p className="font-semibold tabular-nums">{formatToken(holding.balance, holding.symbol)}</p>
            </div>
          </div>
          <p className="text-lg font-bold tabular-nums">
            {holding.valueUsd != null ? formatUsd(holding.valueUsd) : "—"}
          </p>
        </div>

        {/* กราฟราคา (วาดเองจากข้อมูล on-chain) */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">{tr("asset.priceChart")}</p>
              {chartState === "ok" && chartChange != null && (
                <span
                  className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                    chartChange >= 0
                      ? "bg-[var(--dw-green)]/12 text-[var(--dw-green)]"
                      : "bg-[var(--dw-rose)]/12 text-[var(--dw-rose)]"
                  }`}
                >
                  {chartChange >= 0 ? "▲" : "▼"} {Math.abs(chartChange).toFixed(2)}%
                  <span className="text-[var(--dw-muted)]">· {range === "1h" ? tr("chart.1h") : range === "7d" ? tr("chart.7dShort") : tr("chart.24hShort")}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {(["candle", "line"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setChartType(t)}
                  className={`rounded-lg px-2 py-0.5 text-[11px] font-medium ${
                    chartType === t ? "dw-btn-primary" : "dw-btn-ghost text-[var(--dw-muted)]"
                  }`}
                >
                  {t === "candle" ? tr("chart.candle") : tr("chart.line")}
                </button>
              ))}
            </div>
          </div>
          {/* เลือกช่วงเวลา */}
          <div className="mb-2 flex items-center gap-1.5 px-1">
            {([["1h", tr("chart.1h")], ["24h", tr("chart.24h")], ["7d", tr("chart.7d")]] as const).map(([r, label]) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-lg px-2.5 py-0.5 text-[11px] font-medium ${
                  range === r ? "dw-btn-primary" : "dw-btn-ghost text-[var(--dw-muted)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="dw-glass overflow-hidden rounded-2xl p-2">
            {chartState === "loading" ? (
              <div className="dw-shimmer h-[150px] rounded-xl" />
            ) : chartState === "ok" && chart ? (
              chartType === "candle" ? (
                <CandleChart points={chart} />
              ) : (
                <PriceChart points={chart} up={(holding.change24h ?? 0) >= 0} />
              )
            ) : (
              <div className="flex h-[120px] items-center justify-center text-center text-xs text-[var(--dw-muted)]">
                {tr("asset.noChartData")}
              </div>
            )}
          </div>
        </div>

        {/* สถิติตลาดจริง */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Stat label={tr("asset.marketCap")} value={market?.marketCap ? `$${compact(market.marketCap)}` : "—"} />
          <Stat label={tr("asset.vol24h")} value={market?.vol24hUSD != null ? `$${compact(market.vol24hUSD)}` : "—"} />
          <Stat label={tr("asset.holders")} value={market?.holders ? compact(market.holders) : "—"} />
          <Stat label={tr("asset.totalSupply")} value={market?.totalSupply ? compact(market.totalSupply) : "—"} />
        </div>

        {/* สัญญา */}
        {holding.address && (
          <button
            onClick={copy}
            className="dw-glass mt-3 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm"
          >
            <span className="text-[var(--dw-muted)]">{tr("asset.tokenContract")}</span>
            <span className="flex items-center gap-1.5 font-medium">
              {copied ? <Check size={14} className="text-[var(--dw-green)]" /> : <Copy size={14} />}
              {shortAddress(holding.address)}
            </span>
          </button>
        )}

        {/* ปุ่มลัด */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <Link href="/wallet/send" className="dw-btn-primary flex flex-col items-center gap-1 rounded-2xl py-3 text-xs text-white">
            <ArrowUp size={20} /> {tr("common.send")}
          </Link>
          <Link href="/wallet/receive" className="dw-btn-primary flex flex-col items-center gap-1 rounded-2xl py-3 text-xs text-white">
            <ArrowDown size={20} /> {tr("common.receive")}
          </Link>
          <Link href="/wallet/swap" className="dw-btn-primary flex flex-col items-center gap-1 rounded-2xl py-3 text-xs text-white">
            <Swap size={20} /> {tr("common.swap")}
          </Link>
        </div>

        {/* ลิงก์ explorer / charts */}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="dw-glass flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs text-[var(--dw-muted)] hover:text-white"
          >
            <Globe size={15} /> {tr("asset.viewDannyscan")}
          </a>
          <a
            href="https://dancharts.com"
            target="_blank"
            rel="noopener noreferrer"
            className="dw-glass flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs text-[var(--dw-muted)] hover:text-white"
          >
            <Globe size={15} /> {tr("asset.chartDancharts")}
          </a>
        </div>

        {/* ประวัติ */}
        <h2 className="mb-3 mt-6 font-semibold">{tr("activity.title")}</h2>
        <div className="space-y-2.5">
          {txs.length ? (
            txs.map((tx) => <TxRow key={tx.id} tx={tx} />)
          ) : (
            <p className="py-6 text-center text-sm text-[var(--dw-muted)]">{tr("asset.noTxForCoin")}</p>
          )}
        </div>

        <p className="mt-5 text-center text-[11px] text-[var(--dw-muted)]">
          {tr("asset.footer")}
        </p>
      </Screen>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="dw-glass rounded-2xl px-4 py-3">
      <p className="text-xs text-[var(--dw-muted)]">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums">{value}</p>
    </div>
  );
}
