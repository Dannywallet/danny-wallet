"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet/wallet-store";
import { useSwapTokens, type WToken } from "@/lib/wallet/use-holdings";
import { useTxAlerts } from "@/lib/wallet/use-tx-alerts";
import { executeSwap, estimateSwapFee, executeSend, estimateSendFee, explorerTx, clearStuckTransactions, getStuckCount } from "@/lib/wallet/dandex-swap";
import { CHAIN, type Tx } from "@/lib/wallet/mock-data";
import { formatUsd, formatToken, shortAddress } from "@/lib/wallet/format";
import type { Holding } from "@/app/api/danny/portfolio/route";
import { TokenIcon } from "@/components/wallet/TokenIcon";
import { DannyLogo } from "@/components/wallet/DannyLogo";
import { LanguageToggle } from "@/components/wallet/LanguageToggle";
import { useI18n } from "@/lib/wallet/i18n";
import { QrCode } from "@/components/wallet/QrCode";
import { PriceChart, type ChartPoint } from "@/components/wallet/PriceChart";
import { CandleChart } from "@/components/wallet/CandleChart";
import { useAddressBook, isValidAddress } from "@/lib/wallet/address-book";
import {
  Home, Swap as SwapIcon, Activity as ActivityIcon, ArrowDown, ArrowUp,
  Copy, Check, Lock, Shield, Warn, EyeOff, Eye, ChevronRight, Plus, Settings, Card, Bell, Book, Globe,
} from "@/components/wallet/Icons";

// โหลดแบบ lazy — WalletConnect libs หนัก จึงโหลดเฉพาะตอนเปิดหน้า Connect
const DappConnect = dynamic(() => import("./DappConnect"), {
  ssr: false,
  loading: () => <div className="dw-glass dw-shimmer mx-auto h-64 max-w-xl rounded-3xl" />,
});

// transaction alerts (badge + toast) ย้ายไป shared hook: @/lib/wallet/use-tx-alerts

/* ---------- theme (light/dark) ---------- */
function useTheme() {
  const [light, setLight] = React.useState(false);
  React.useEffect(() => { setLight(document.documentElement.classList.contains("theme-light")); }, []);
  const toggle = React.useCallback(() => {
    setLight((v) => {
      const nv = !v;
      document.documentElement.classList.toggle("theme-light", nv);
      try { localStorage.setItem("dw-theme", nv ? "light" : "dark"); } catch {}
      return nv;
    });
  }, []);
  return { light, toggle };
}

// คู่ WDAN/USDT บน dancharts — ใช้แสดงกราฟราคา DAN (native) ในพอร์ต
const WDAN_USDT_PAIR = "0xce79470c765cfd64274b0d43128746bdf9e3a5d2";

/* ---------- helpers ---------- */
const PALETTE: [string, string][] = [
  ["#7c3aed", "#22d3ee"], ["#22d3ee", "#34d399"], ["#f59e0b", "#f43f5e"],
  ["#6366f1", "#a855f7"], ["#ec4899", "#8b5cf6"], ["#0ea5e9", "#14b8a6"],
];
function gradientFor(key: string): [string, string] {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
function fmtPrice(p: number | null): string {
  if (p == null) return "—";
  if (p >= 1) return `$${p.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (p <= 0) return "$0";
  const d = Math.min(10, Math.max(2, -Math.floor(Math.log10(p)) + 2));
  return `$${p.toFixed(d)}`;
}
function timeAgo(ms: number, tr: (k: string) => string): string {
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s} ${tr("time.sec")}`;
  const m = Math.floor(s / 60); if (m < 60) return `${m} ${tr("time.min")}`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} ${tr("time.hour")}`;
  return `${Math.floor(h / 24)} ${tr("time.day")}`;
}

type View = "portfolio" | "swap" | "activity" | "receive" | "send" | "settings" | "connect";

/* ---------- root ---------- */
export default function DesktopWallet() {
  const router = useRouter();
  const { t: tr } = useI18n();
  const w = useWallet();
  const { hydrated, created, locked, address, accounts, activeIndex, balanceHidden, toggleBalance, lock } = w;
  const [view, setView] = React.useState<View>("portfolio");
  const { light, toggle: toggleTheme } = useTheme();
  const [buyOpen, setBuyOpen] = React.useState(false);
  const { unread, toast, dismissToast, markSeen } = useTxAlerts(address);
  const goActivity = () => { setView("activity"); markSeen(); };

  // guards + responsive: เด้งไปหน้า phone เมื่อจอเล็ก / ยังไม่ unlock
  // จำว่าผู้ใช้ตั้งใจเปิดแบบ desktop (เช่นกดปุ่ม Launch App) — ให้ onboarding/unlock เด้งกลับ /desktop
  React.useEffect(() => {
    try { sessionStorage.setItem("dw-prefer-desktop", "1"); } catch { /* noop */ }
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    if (!created) { router.replace("/wallet"); return; }
    if (locked) { router.replace("/wallet/unlock"); return; }
    if (typeof window !== "undefined" && window.innerWidth < 1024) router.replace("/wallet/home");
  }, [hydrated, created, locked, router]);
  React.useEffect(() => {
    const onR = () => { if (window.innerWidth < 1024) router.replace("/wallet/home"); };
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, [router]);

  if (!hydrated || !created || locked) {
    return (
      <div className="dw-root grid min-h-screen place-items-center">
        <div className="dw-bg" />
        <p className="relative text-sm text-[var(--dw-muted)]">{tr("common.loading")}</p>
      </div>
    );
  }

  const NAV: { id: View; label: string; Icon: typeof Home }[] = [
    { id: "portfolio", label: tr("nav.portfolio"), Icon: Home },
    { id: "swap", label: tr("swap.title"), Icon: SwapIcon },
    { id: "send", label: tr("common.send"), Icon: ArrowUp },
    { id: "receive", label: tr("common.receive"), Icon: ArrowDown },
    { id: "activity", label: tr("nav.activity"), Icon: ActivityIcon },
    { id: "connect", label: tr("connect.title"), Icon: Globe },
    { id: "settings", label: tr("settings.title"), Icon: Settings },
  ];

  return (
    <div className="dw-root relative min-h-screen">
      <div className="dw-bg" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1380px] gap-0">
        {/* ===== Sidebar ===== */}
        <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-[var(--dw-border)] bg-black/20 px-4 py-5 backdrop-blur-xl">
          <div className="flex items-center gap-2 px-2">
            <DannyLogo size={36} />
            <span className="text-lg font-bold"><span className="dw-text-grad">Danny</span> Wallet</span>
            <button
              onClick={goActivity}
              aria-label={tr("settings.notifications")}
              className="relative ml-auto grid h-9 w-9 place-items-center rounded-xl text-[var(--dw-muted)] transition hover:bg-white/[0.06] hover:text-[var(--dw-text)]"
            >
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--dw-rose)] px-1 text-[9px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
          </div>

          <AccountSwitcherSidebar />

          <nav className="mt-2 space-y-1">
            {NAV.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => { setView(id); if (id === "activity") markSeen(); }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  view === id
                    ? "bg-[var(--dw-violet)]/20 text-[var(--dw-text)]"
                    : "text-[var(--dw-muted)] hover:bg-white/[0.05] hover:text-[var(--dw-text)]"
                }`}
              >
                <Icon size={18} /> {label}
              </button>
            ))}
          </nav>

          <button
            onClick={() => setBuyOpen(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--dw-violet)] to-[var(--dw-cyan)] py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            <Card size={16} /> {tr("desktop.buyCrypto")}
          </button>

          <div className="mt-auto space-y-3">
            <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-xs">
              <span className="h-2 w-2 rounded-full bg-[var(--dw-green)] dw-pulse-ring" />
              <span className="font-medium">{CHAIN.name}</span>
              <span className="ml-auto text-[var(--dw-muted)]">#{CHAIN.chainId}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--dw-border)] bg-white/[0.03] py-2.5 text-xs font-medium text-[var(--dw-muted)] transition hover:text-[var(--dw-text)]"
              >
                {light ? `🌙 ${tr("desktop.dark")}` : `☀️ ${tr("desktop.light")}`}
              </button>
              <button
                onClick={() => { lock(); router.replace("/wallet/unlock"); }}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--dw-border)] bg-white/[0.03] py-2.5 text-xs font-medium text-[var(--dw-muted)] transition hover:text-[var(--dw-text)]"
              >
                <Lock size={14} /> {tr("common.lock")}
              </button>
            </div>
          </div>
        </aside>

        {/* ===== Main ===== */}
        <main className="flex-1 px-8 py-8">
          {view === "portfolio" && <PortfolioView address={address} balanceHidden={balanceHidden} toggleBalance={toggleBalance} onGoto={setView} />}
          {view === "swap" && <SwapView />}
          {view === "send" && <SendView />}
          {view === "receive" && <ReceiveView address={address} name={accounts[activeIndex]?.name} />}
          {view === "activity" && <ActivityView address={address} />}
          {view === "settings" && <SettingsView light={light} toggleTheme={toggleTheme} onReset={() => router.replace("/wallet")} />}
          {view === "connect" && <DappConnect />}
        </main>
      </div>

      <BuyModal open={buyOpen} onClose={() => setBuyOpen(false)} onReceive={() => { setBuyOpen(false); setView("receive"); }} />

      {/* toast แจ้งเตือนธุรกรรมใหม่ */}
      {toast && (
        <button
          onClick={() => { dismissToast(); goActivity(); }}
          className="dw-glass-strong dw-rise fixed bottom-6 right-6 z-[3500] flex max-w-xs items-center gap-3 rounded-2xl border border-[var(--dw-border)] p-4 text-left shadow-2xl"
          style={{ background: "var(--dw-popover)" }}
        >
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${toast.type === "receive" ? "bg-[var(--dw-green)]/15 text-[var(--dw-green)]" : toast.type === "swap" ? "bg-[var(--dw-violet)]/15 text-[var(--dw-cyan)]" : "bg-white/[0.06] text-[var(--dw-muted)]"}`}>
            {toast.type === "swap" ? <SwapIcon size={18} /> : toast.type === "receive" ? <ArrowDown size={18} /> : <ArrowUp size={18} />}
          </span>
          <span>
            <span className="block text-sm font-semibold">{tr("tx.newTx")}</span>
            <span className="block text-xs text-[var(--dw-muted)]">
              {toast.type === "swap" ? `${tr("common.swap")} ${toast.token} → ${toast.toToken ?? ""}` : toast.type === "receive" ? `${tr("common.receive")} ${formatToken(toast.amount)} ${toast.token}` : `${tr("common.send")} ${formatToken(toast.amount)} ${toast.token}`}
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

/* ---------- sidebar account switcher (multi-account) ---------- */
function AccountSwitcherSidebar() {
  const { t: tr } = useI18n();
  const { accounts, activeIndex, address, switchAccount, addAccount, createAccount, importAccount, hasSeed, revealPrivateKey } = useWallet();
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [showKey, setShowKey] = React.useState(false);
  const [action, setAction] = React.useState<null | "add" | "create" | "import">(null);
  const [pin, setPin] = React.useState("");
  const [pk, setPk] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setAction(null); setShowKey(false); } };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  const active = accounts[activeIndex];
  const copy = async () => { if (!address) return; try { await navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {} };
  const startAction = (a: "add" | "create" | "import") => { setAction(a); setErr(null); setPin(""); setPk(""); };
  const reasonMsg = (r?: string) => r === "max" ? tr("tx.maxReached") : r === "invalid-key" ? tr("import.pkInvalid") : r === "exists" ? tr("acct.exists") : r === "pin" ? tr("tx.pinWrong") : tr("tx.addAccountFailed");
  const canRun = pin.length === 6 && (action !== "import" || pk.trim().length >= 60);
  const runAction = async () => {
    if (!action) return;
    setBusy(true); setErr(null);
    const res = action === "create" ? await createAccount(pin) : action === "import" ? await importAccount(pin, pk) : await addAccount(pin);
    setBusy(false);
    if (res.ok) { setAction(null); setPin(""); setPk(""); }
    else setErr(reasonMsg(res.reason));
  };

  return (
    <div ref={ref} className="relative my-5">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 rounded-2xl border border-[var(--dw-border)] bg-white/[0.04] px-3 py-2.5 text-left transition hover:bg-white/[0.07]">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[var(--dw-violet)] to-[var(--dw-cyan)] text-xs font-bold text-white">{(active?.name || tr("tx.account"))[0]}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{active?.name || tr("tx.account")}</span>
          <span className="block text-[11px] text-[var(--dw-muted)]">{address ? shortAddress(address) : ""}</span>
        </span>
        <ChevronRight size={15} className={`text-[var(--dw-muted)] transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="dw-glass-strong absolute left-0 right-0 z-40 mt-2 rounded-2xl border border-[var(--dw-border)] p-2 shadow-2xl" style={{ background: "var(--dw-popover)" }}>
          <div className="max-h-56 space-y-0.5 overflow-y-auto">
            {accounts.map((a, i) => (
              <button key={a.address} onClick={() => { switchAccount(i); setOpen(false); }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${i === activeIndex ? "bg-[var(--dw-violet)]/20" : "hover:bg-white/[0.06]"}`}>
                <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[var(--dw-violet)] to-[var(--dw-cyan)] text-[11px] font-bold text-white">{(a.name || tr("tx.account"))[0]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{a.name}</span>
                  <span className="block text-[10px] text-[var(--dw-muted)]">{shortAddress(a.address)}</span>
                </span>
                {i === activeIndex && <Check size={14} className="text-[var(--dw-green)]" />}
              </button>
            ))}
          </div>

          <div className="mt-1 border-t border-[var(--dw-border)] pt-1">
            <button onClick={copy} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-[var(--dw-muted)] hover:bg-white/[0.06] hover:text-[var(--dw-text)]">
              {copied ? <Check size={13} className="text-[var(--dw-green)]" /> : <Copy size={13} />} {tr("acct.copyAddress")}
            </button>
            {!action && (
              <>
                {hasSeed && (
                  <button onClick={() => startAction("add")} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-[var(--dw-muted)] hover:bg-white/[0.06] hover:text-[var(--dw-text)]">
                    <Plus size={13} /> {tr("acct.addAccount")}
                  </button>
                )}
                <button onClick={() => startAction("create")} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-[var(--dw-cyan)] hover:bg-white/[0.06]">
                  <Plus size={13} /> {tr("acct.createWallet")}
                </button>
                <button onClick={() => startAction("import")} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-[var(--dw-muted)] hover:bg-white/[0.06] hover:text-[var(--dw-text)]">
                  <Plus size={13} /> {tr("acct.importPk")}
                </button>
                <button onClick={() => setShowKey((v) => !v)} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-[var(--dw-muted)] hover:bg-white/[0.06] hover:text-[var(--dw-text)]">
                  <Eye size={13} /> {tr("acct.revealKey")}
                </button>
                {showKey && (
                  <div className="mt-1 border-t border-[var(--dw-border)] px-1.5 pt-2">
                    <SecretReveal label={tr("dset.pkLabel")} hint={tr("dset.pkHint")} onReveal={(pin) => revealPrivateKey(activeIndex, pin)} />
                  </div>
                )}
              </>
            )}
            {action && (
              <div className="px-1.5 pb-1 pt-1">
                {action === "import" && (
                  <textarea value={pk} onChange={(e) => setPk(e.target.value)} rows={2} autoFocus
                    placeholder={tr("acct.pkPlaceholder")}
                    className="dw-glass mb-1.5 w-full resize-none rounded-xl px-3 py-2 font-mono text-xs outline-none placeholder:text-[var(--dw-muted)] focus:border-[var(--dw-cyan)]/50" style={{ color: "var(--dw-text)" }} />
                )}
                <input type="password" inputMode="numeric" maxLength={6} value={pin} autoFocus={action !== "import"}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && canRun && !busy && runAction()}
                  placeholder={tr("acct.pinToAdd")}
                  className="dw-glass w-full rounded-xl px-3 py-2 text-center text-sm tracking-[0.3em] outline-none focus:border-[var(--dw-cyan)]/50" style={{ color: "var(--dw-text)" }} />
                {err && <p className="mt-1 text-center text-[10px] text-[var(--dw-rose)]">{err}</p>}
                <div className="mt-1.5 flex gap-1.5">
                  <button onClick={() => setAction(null)} className="dw-btn-ghost flex-1 rounded-xl py-2 text-xs font-semibold">{tr("common.cancel")}</button>
                  <button onClick={runAction} disabled={!canRun || busy} className="dw-btn-primary flex-1 rounded-xl py-2 text-xs font-semibold disabled:opacity-50">
                    {busy ? tr("acct.creating") : action === "import" ? tr("acct.import") : tr("acct.createAccount")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- portfolio: total value chart (composite from token price histories) ---------- */
type ChartHolding = { address: string | null; balance: number; priceUsd: number | null; isNative?: boolean };
function PortfolioChartCard({ holdings, totalUsd, change24h, hidden }: {
  holdings: ChartHolding[]; totalUsd: number; change24h: number; hidden: boolean;
}) {
  const { t: tr } = useI18n();
  const [range, setRange] = React.useState<"24h" | "7d">("24h");
  const [points, setPoints] = React.useState<ChartPoint[] | null>(null);
  const [state, setState] = React.useState<"loading" | "ok" | "empty">("loading");
  const [chartType, setChartType] = React.useState<"candle" | "line">("candle");

  // คีย์คงที่จากเนื้อหา holdings เพื่อกัน effect รันซ้ำทุก render
  const key = holdings.map((h) => `${h.address ?? "native"}:${h.balance}`).join(",");

  React.useEffect(() => {
    let alive = true;
    setState("loading");
    (async () => {
      try {
        const priced = holdings.filter((h) => h.priceUsd != null && h.balance > 0);
        if (!priced.length) { if (alive) setState("empty"); return; }
        // map contract -> pair จาก /tokens
        const tj = await fetch("/api/danny/tokens").then((r) => r.json());
        const pairOf = new Map<string, string>();
        for (const t of tj.tokens || []) if (t.pair) pairOf.set((t.address || "").toLowerCase(), t.pair);

        type S = { bal: number; price: number; pts: ChartPoint[] | null };
        const series: S[] = await Promise.all(priced.map(async (h) => {
          const pair = h.isNative ? WDAN_USDT_PAIR : pairOf.get((h.address || "").toLowerCase());
          const price = h.priceUsd as number;
          if (!pair) return { bal: h.balance, price, pts: null };
          try {
            const cj = await fetch(`/api/danny/chart?pair=${pair}&range=${range}`).then((r) => r.json());
            const pts = (cj.points || []) as ChartPoint[];
            return { bal: h.balance, price, pts: pts.length >= 2 ? pts : null };
          } catch { return { bal: h.balance, price, pts: null }; }
        }));

        // กริดเวลา = ซีรีส์ที่มีจุดมากสุด
        const ref = series.reduce<ChartPoint[] | null>((best, s) => (s.pts && (!best || s.pts.length > best.length) ? s.pts : best), null);
        if (!ref) {
          const now = Date.now();
          if (alive) { setPoints([{ t: now - 86_400_000, p: totalUsd / (1 + change24h / 100) }, { t: now, p: totalUsd }]); setState("ok"); }
          return;
        }
        const priceAt = (s: S, t: number) => {
          if (!s.pts) return s.price;
          let best = s.pts[0], bd = Math.abs(s.pts[0].t - t);
          for (const p of s.pts) { const d = Math.abs(p.t - t); if (d < bd) { bd = d; best = p; } }
          return best.p;
        };
        const composite: ChartPoint[] = ref.map((rp) => ({ t: rp.t, p: series.reduce((sum, s) => sum + s.bal * priceAt(s, rp.t), 0) }));
        if (alive) { setPoints(composite); setState(composite.length >= 2 ? "ok" : "empty"); }
      } catch { if (alive) setState("empty"); }
    })();
    return () => { alive = false; };
  }, [key, range, totalUsd, change24h]); // eslint-disable-line react-hooks/exhaustive-deps

  const first = points?.[0]?.p ?? null;
  const last = points?.[points.length - 1]?.p ?? null;
  const pct = first && last && first > 0 ? ((last - first) / first) * 100 : change24h;
  const up = pct >= 0;

  return (
    <div className="dw-glass flex flex-col rounded-3xl p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[var(--dw-muted)]">{tr("portfolio.value")}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{hidden ? "••••••" : formatUsd(last ?? totalUsd)}</p>
          <p className={`text-xs font-medium ${up ? "text-[var(--dw-green)]" : "text-[var(--dw-rose)]"}`}>
            {up ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}% · {range === "7d" ? tr("chart.7d") : tr("chart.24h")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(["candle", "line"] as const).map((ct) => (
              <button key={ct} onClick={() => setChartType(ct)} className={`rounded-lg px-2 py-0.5 text-[11px] font-medium ${chartType === ct ? "dw-btn-primary" : "dw-btn-ghost text-[var(--dw-muted)]"}`}>
                {ct === "candle" ? tr("chart.candle") : tr("chart.line")}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {(["24h", "7d"] as const).map((r) => (
              <button key={r} onClick={() => setRange(r)} className={`rounded-lg px-2 py-0.5 text-[11px] font-medium ${range === r ? "dw-btn-primary" : "dw-btn-ghost text-[var(--dw-muted)]"}`}>
                {r === "7d" ? tr("chart.7dShort") : tr("chart.24hShort")}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex-1">
        {state === "loading" ? <div className="dw-shimmer h-[120px] rounded-xl" />
          : state === "ok" && points ? (
              chartType === "candle" ? <CandleChart points={points} /> : <PriceChart points={points} up={up} />
            )
          : <div className="flex h-[120px] items-center justify-center text-center text-xs text-[var(--dw-muted)]">{tr("portfolio.noChartData")}</div>}
      </div>
    </div>
  );
}

/* ---------- Portfolio ---------- */
type Portfolio = { totalUsd: number; change24h: number; count: number; hiddenCount?: number; holdings: Holding[]; error?: string };

function PortfolioView({ address, balanceHidden, toggleBalance, onGoto }: {
  address: string | null; balanceHidden: boolean; toggleBalance: () => void; onGoto: (v: View) => void;
}) {
  const { t: tr } = useI18n();
  const [pf, setPf] = React.useState<Portfolio | null>(null);
  const [state, setState] = React.useState<"loading" | "ok" | "error">("loading");
  const [showHidden, setShowHidden] = React.useState(false);

  const load = React.useCallback(() => {
    if (!address) return;
    setState("loading");
    fetch(`/api/danny/portfolio?address=${address}`).then((r) => r.json())
      .then((j: Portfolio) => { if (j.error && !j.holdings?.length) setState("error"); else { setPf(j); setState("ok"); } })
      .catch(() => setState("error"));
  }, [address]);
  React.useEffect(() => { load(); }, [load]);

  const visible = (pf?.holdings || []).filter((h) => !h.spam);
  const hidden = (pf?.holdings || []).filter((h) => h.spam);
  const up = (pf?.change24h ?? 0) >= 0;

  return (
    <div className="dw-rise space-y-6">
      <Header title={tr("nav.portfolio")} />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* balance card */}
        <div className="dw-glass relative overflow-hidden rounded-3xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-[var(--dw-muted)]">{tr("portfolio.totalAll")}</p>
              <div className="mt-1 flex items-center gap-3">
                <p className="text-4xl font-extrabold tracking-tight">
                  {balanceHidden ? "••••••" : formatUsd(pf?.totalUsd ?? 0)}
                </p>
                <button onClick={toggleBalance} className="text-[var(--dw-muted)] hover:text-[var(--dw-text)]">
                  {balanceHidden ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
              <p className={`mt-1 text-sm font-medium ${up ? "text-[var(--dw-green)]" : "text-[var(--dw-rose)]"}`}>
                {up ? "▲" : "▼"} {Math.abs(pf?.change24h ?? 0).toFixed(2)}% · {tr("chart.24h")}
              </p>
            </div>
          </div>
          <div className="mt-6 flex gap-2">
            {([["send", tr("common.send"), ArrowUp], ["receive", tr("common.receive"), ArrowDown], ["swap", tr("common.swap"), SwapIcon]] as const).map(([v, label, Icon]) => (
              <button key={v} onClick={() => onGoto(v)} className="dw-btn-primary flex flex-1 flex-col items-center gap-1.5 rounded-2xl py-3 text-xs font-medium text-white transition">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/20 text-white"><Icon size={18} /></span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* กราฟมูลค่าพอร์ตรวม */}
        <PortfolioChartCard holdings={visible} totalUsd={pf?.totalUsd ?? 0} change24h={pf?.change24h ?? 0} hidden={balanceHidden} />
      </div>

      {/* holdings table */}
      <div className="dw-glass rounded-3xl p-2 sm:p-4">
        <div className="flex items-center justify-between px-3 py-2">
          <h2 className="font-semibold">{tr("home.myAssets")}</h2>
          <button onClick={load} className="text-xs text-[var(--dw-muted)] hover:text-[var(--dw-text)]">{tr("common.refresh")}</button>
        </div>
        {state === "loading" ? (
          <div className="space-y-2 p-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="dw-shimmer h-14 rounded-xl" />)}</div>
        ) : state === "error" ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Warn size={28} className="text-[var(--dw-rose)]" />
            <p className="text-sm text-[var(--dw-muted)]">{tr("home.loadFailed")}</p>
            <button onClick={load} className="dw-btn-primary rounded-xl px-4 py-2 text-sm font-semibold">{tr("common.retry")}</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--dw-muted)]">
                <th className="px-3 py-2 font-medium">{tr("table.coin")}</th>
                <th className="px-3 py-2 text-right font-medium">{tr("table.price")}</th>
                <th className="px-3 py-2 text-right font-medium">{tr("table.holding")}</th>
                <th className="px-3 py-2 text-right font-medium">{tr("table.value")}</th>
                <th className="px-3 py-2 text-right font-medium">{tr("chart.24hShort")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((h) => <HoldingRow key={h.address ?? "native"} h={h} hidden={balanceHidden} />)}
              {showHidden && hidden.map((h) => <HoldingRow key={h.address ?? "native"} h={h} hidden={balanceHidden} />)}
            </tbody>
          </table>
        )}
        {state === "ok" && hidden.length > 0 && (
          <button onClick={() => setShowHidden((v) => !v)} className="mt-1 w-full rounded-xl py-2 text-xs text-[var(--dw-muted)] hover:text-[var(--dw-text)]">
            {showHidden ? tr("home.hideSpam") : `${tr("home.showHidden")} (${hidden.length})`}
          </button>
        )}
      </div>
    </div>
  );
}

function HoldingRow({ h, hidden }: { h: Holding; hidden: boolean }) {
  const { t: tr } = useI18n();
  const g = gradientFor(h.address || h.symbol);
  const up = (h.change24h ?? 0) >= 0;
  return (
    <tr className="border-t border-[var(--dw-border)]/60 transition hover:bg-white/[0.03]">
      <td className="px-3 py-3">
        <div className="flex items-center gap-3">
          <TokenIcon symbol={h.symbol} gradient={g} logo={h.logo} size={34} />
          <div>
            <p className="flex items-center gap-1.5 font-semibold">
              {h.symbol}
              {h.isNative && <span className="rounded-full bg-[var(--dw-violet)]/20 px-1.5 py-0.5 text-[9px] text-[var(--dw-purple)]">{tr("common.native")}</span>}
              {h.spam && <span className="rounded-full bg-[var(--dw-rose)]/15 px-1.5 py-0.5 text-[9px] text-[var(--dw-rose)]">{tr("common.spam")}</span>}
            </p>
            <p className="text-xs text-[var(--dw-muted)]">{h.name}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-right tabular-nums">{fmtPrice(h.priceUsd)}</td>
      <td className="px-3 py-3 text-right tabular-nums text-[var(--dw-muted)]">{hidden ? "•••" : formatToken(h.balance)}</td>
      <td className="px-3 py-3 text-right font-semibold tabular-nums">{h.valueUsd != null ? (hidden ? "••••" : formatUsd(h.valueUsd)) : "—"}</td>
      <td className={`px-3 py-3 text-right tabular-nums ${h.change24h == null ? "text-[var(--dw-muted)]" : up ? "text-[var(--dw-green)]" : "text-[var(--dw-rose)]"}`}>
        {h.change24h == null ? "—" : `${up ? "+" : ""}${h.change24h.toFixed(2)}%`}
      </td>
    </tr>
  );
}

/* ---------- Swap ---------- */
function SwapView() {
  const { t: tr } = useI18n();
  const { tokens, state } = useSwapTokens();
  const { address, getActivePrivateKey } = useWallet();
  const [from, setFrom] = React.useState<WToken | null>(null);
  const [to, setTo] = React.useState<WToken | null>(null);
  const [amount, setAmount] = React.useState("");
  const [slippage, setSlippage] = React.useState(0.5);
  const [phase, setPhase] = React.useState<"idle" | "swapping" | "pending" | "done">("idle");
  const [statusText, setStatusText] = React.useState("");
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [pin, setPin] = React.useState("");
  const [askPin, setAskPin] = React.useState(false);
  const [gasFee, setGasFee] = React.useState<number | null | "loading">(null);

  React.useEffect(() => {
    if (state !== "ok" || tokens.length < 2 || from) return;
    const priced = tokens.filter((t) => t.priceUsd != null);
    const base = priced[0] || tokens[0];
    const quote = tokens.find((t) => t.symbol !== base.symbol && t.priceUsd != null) || tokens[1];
    setFrom(base); setTo(quote);
  }, [state, tokens, from]);

  const amt = parseFloat(amount) || 0;
  const rate = from?.priceUsd && to?.priceUsd ? from.priceUsd / to.priceUsd : null;
  const out = rate != null ? amt * rate : 0;
  const enough = !!from && amt > 0 && amt <= from.balance;
  const flip = () => { setFrom(to); setTo(from); setAmount(""); };

  const openPin = async () => {
    if (!from || !to || !address) return;
    setErr(null); setPin(""); setAskPin(true); setGasFee("loading");
    const fee = await estimateSwapFee({
      fromToken: { address: from.address, symbol: from.symbol },
      toToken: { address: to.address, symbol: to.symbol },
      amount, account: address, slippagePct: slippage,
    });
    setGasFee(fee);
  };

  const submit = async () => {
    if (!from || !to) return;
    setErr(null); setPhase("swapping"); setStatusText(tr("tx.preparing"));
    try {
      const pk = await getActivePrivateKey(pin);
      if (!pk) { setErr(tr("tx.pinWrong")); setPhase("idle"); setStatusText(""); return; }
      const res = await executeSwap({
        from: { address: from.address, symbol: from.symbol },
        to: { address: to.address, symbol: to.symbol },
        amount, slippagePct: slippage, privateKey: pk,
        onPhase: (p) => setStatusText(p === "unstick" ? tr("swap.clearingStuck") : p === "approve" ? `${tr("swap.approvingPrefix")} ${from.symbol}…` : p === "swap" ? tr("swap.signing") : tr("tx.preparing")),
        onHash: (h) => { setTxHash(h); setAskPin(false); setPin(""); setStatusText(""); setPhase("pending"); },
      });
      if (res.status === "confirmed") {
        setPhase("done");
        setTimeout(() => { setPhase("idle"); setAmount(""); setTxHash(null); }, 6000);
      }
    } catch (e: any) {
      setErr(e?.shortMessage || e?.message || tr("swap.failed")); setPhase("idle"); setStatusText("");
    }
  };

  return (
    <div className="dw-rise mx-auto max-w-xl space-y-6">
      <Header title={tr("swap.title")} right={<span className="text-xs text-[var(--dw-muted)]">{tr("swap.viaDandex")}</span>} />

      {state === "loading" || !from || !to ? (
        state === "error"
          ? <div className="dw-glass flex flex-col items-center gap-3 rounded-3xl py-16 text-center"><Warn size={28} className="text-[var(--dw-rose)]" /><p className="text-sm text-[var(--dw-muted)]">{tr("tx.loadTokensFailed")}</p></div>
          : <div className="space-y-3"><div className="dw-glass dw-shimmer h-32 rounded-3xl" /><div className="dw-glass dw-shimmer h-32 rounded-3xl" /></div>
      ) : phase === "done" || phase === "pending" ? (
        <div className="dw-glass flex flex-col items-center justify-center rounded-3xl py-16">
          {phase === "done" ? (
            <span className="grid h-20 w-20 place-items-center rounded-full bg-[var(--dw-green)]/15 text-[var(--dw-green)] dw-pulse-ring"><Check size={40} /></span>
          ) : (
            <span className="grid h-20 w-20 place-items-center rounded-full bg-[var(--dw-amber)]/15"><span className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--dw-amber)]/25 border-t-[var(--dw-amber)]" /></span>
          )}
          <h2 className="mt-5 text-xl font-semibold">{phase === "done" ? tr("swap.swapSuccess") : tr("swap.swapPending")}</h2>
          <p className="mt-2 text-sm text-[var(--dw-muted)]">{formatToken(amt, from.symbol)} → {formatToken(out, to.symbol)}</p>
          {phase === "pending" && <p className="mt-1 max-w-xs text-center text-xs text-[var(--dw-muted)]">{tr("swap.pendingHint")}</p>}
          {txHash && <a href={explorerTx(txHash)} target="_blank" rel="noopener noreferrer" className="dw-btn-ghost mt-5 rounded-xl px-4 py-2 text-xs">{tr("tx.viewOnDannyscan")}</a>}
        </div>
      ) : (
        <>
          <div className="relative space-y-2">
            <SwapBox label={tr("swap.pay")} token={from} tokens={tokens} amount={amount} onAmount={setAmount} onSelect={(t) => { if (t.symbol === to.symbol) setTo(from); setFrom(t); }} max onMax={() => setAmount(String(from.balance))} />
            <button onClick={flip} className="dw-btn-primary absolute left-1/2 top-1/2 z-10 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full" aria-label={tr("swap.flipDir")}><SwapIcon size={20} /></button>
            <SwapBox label={tr("common.receive")} token={to} tokens={tokens} amount={amt && rate != null ? formatToken(out) : ""} readOnly onSelect={(t) => { if (t.symbol === from.symbol) setFrom(to); setTo(t); }} />
          </div>

          <div className="dw-glass space-y-3 rounded-2xl p-4 text-sm">
            <div className="flex justify-between"><span className="text-[var(--dw-muted)]">{tr("swap.rate")}</span><span className="font-medium">{rate != null ? `1 ${from.symbol} ≈ ${formatToken(rate)} ${to.symbol}` : tr("common.noPrice")}</span></div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--dw-muted)]">Slippage</span>
              <div className="flex gap-1.5">{[0.5, 1, 2].map((s) => <button key={s} onClick={() => setSlippage(s)} className={`rounded-lg px-2.5 py-0.5 text-xs ${slippage === s ? "dw-btn-primary" : "dw-btn-ghost text-[var(--dw-muted)]"}`}>{s}%</button>)}</div>
            </div>
            <div className="flex justify-between"><span className="text-[var(--dw-muted)]">{tr("swap.estValue")}</span><span className="font-medium">{from.priceUsd != null ? formatUsd(amt * from.priceUsd) : "—"}</span></div>
          </div>

          <div className="dw-glass flex items-start gap-2 rounded-2xl border-[var(--dw-green)]/25 bg-[var(--dw-green)]/[0.06] p-3 text-xs text-[var(--dw-muted)]">
            <Shield size={15} className="mt-0.5 shrink-0 text-[var(--dw-green)]" /> {tr("swap.routerNote1")} {address ? shortAddress(address) : ""} {tr("swap.routerNote2")}
          </div>

          <button onClick={openPin} disabled={!enough || rate == null} className="dw-btn-primary w-full rounded-2xl py-4 font-semibold disabled:opacity-50">
            {rate == null ? tr("swap.noPair") : !amt ? tr("swap.enterAmount") : !enough ? tr("swap.insufficient") : tr("swap.swapPin")}
          </button>
        </>
      )}

      <PinModal
        open={askPin} onClose={() => { setAskPin(false); setPin(""); }}
        title={tr("swap.confirmTitle")}
        subtitle={from && to ? `${tr("swap.confirmPrefix")} ${formatToken(amt, from.symbol)} → ~${formatToken(out, to.symbol)}` : ""}
        fee={gasFee} pin={pin} setPin={setPin} onSubmit={submit}
        busy={phase === "swapping"} busyText={statusText} err={err}
        note={from && !from.isNative ? `${tr("swap.approveNote1")} ${from.symbol} ${tr("swap.approveNote2")}` : undefined}
      />
    </div>
  );
}

function SwapBox({ label, token, tokens, amount, onAmount, onSelect, readOnly, max, onMax }: {
  label: string; token: WToken; tokens: WToken[]; amount: string;
  onAmount?: (v: string) => void; onSelect: (t: WToken) => void; readOnly?: boolean; max?: boolean; onMax?: () => void;
}) {
  // ตอนเปิด dropdown เลือกเหรียญ ยกกล่องนี้ขึ้น z-50 ให้รายการโชว์เหนือกล่องอื่น (กัน backdrop-filter ขัง)
  const { t: tr } = useI18n();
  const [picking, setPicking] = React.useState(false);
  return (
    <div className={`dw-glass rounded-3xl p-4 ${picking ? "relative z-50" : ""}`}>
      <div className="flex items-center justify-between text-xs text-[var(--dw-muted)]">
        <span>{label}</span>
        <span>{tr("tx.balance")} {formatToken(token.balance, token.symbol)}{max && <button onClick={onMax} className="ml-2 font-medium text-[var(--dw-cyan)]">{tr("tx.max")}</button>}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input value={amount} onChange={(e) => onAmount?.(e.target.value)} readOnly={readOnly} type={readOnly ? "text" : "number"} placeholder="0.00"
          className="min-w-0 flex-1 bg-transparent text-3xl font-bold outline-none placeholder:text-[var(--dw-muted)]" style={{ color: "var(--dw-text)" }} />
        <TokenSelect token={token} tokens={tokens} onSelect={onSelect} onOpenChange={setPicking} />
      </div>
    </div>
  );
}

function TokenSelect({ token, tokens, onSelect, filterHeld, onOpenChange }: { token: WToken; tokens: WToken[]; onSelect: (t: WToken) => void; filterHeld?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);
  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  const list = filterHeld ? tokens.filter((t) => t.balance > 0) : tokens;
  return (
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen((v) => !v)} className="dw-btn-ghost flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 hover:bg-white/[0.08]">
        <TokenIcon symbol={token.symbol} gradient={token.gradient} size={28} logo={token.logo} />
        <span className="font-semibold">{token.symbol}</span>
        <ChevronRight size={16} className={`text-[var(--dw-muted)] transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="dw-glass-strong absolute right-0 z-30 mt-2 max-h-72 w-60 space-y-1 overflow-y-auto rounded-2xl border border-[var(--dw-border)] p-2 shadow-2xl" style={{ background: "var(--dw-popover)" }}>
          {list.map((t) => (
            <button key={t.address ?? "native"} onClick={() => { onSelect(t); setOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.07]">
              <TokenIcon symbol={t.symbol} gradient={t.gradient} size={30} logo={t.logo} />
              <span className="flex-1 text-left text-sm font-medium">{t.symbol}</span>
              <span className="text-xs text-[var(--dw-muted)]">{formatToken(t.balance)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Send ---------- */
function SendView() {
  const { t: tr } = useI18n();
  const { tokens, state } = useSwapTokens();
  const { address, getActivePrivateKey } = useWallet();
  const { list: contacts, add: addContact } = useAddressBook();
  const [token, setToken] = React.useState<WToken | null>(null);
  const [to, setTo] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [bookOpen, setBookOpen] = React.useState(false);
  const [saveName, setSaveName] = React.useState("");
  const bookRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (bookRef.current && !bookRef.current.contains(e.target as Node)) setBookOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  const [phase, setPhase] = React.useState<"idle" | "sending" | "pending" | "done">("idle");
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [pin, setPin] = React.useState("");
  const [askPin, setAskPin] = React.useState(false);
  const [fee, setFee] = React.useState<number | null | "loading">(null);
  const [statusText, setStatusText] = React.useState("");

  React.useEffect(() => {
    if (state !== "ok" || token) return;
    const held = tokens.filter((t) => t.balance > 0);
    if (held.length) setToken(held[0]);
  }, [state, tokens, token]);

  const amt = parseFloat(amount) || 0;
  const validAddr = /^0x[a-fA-F0-9]{40}$/.test(to.trim());
  const enough = !!token && amt > 0 && amt <= token.balance;

  const openPin = async () => {
    if (!token || !address) return;
    setErr(null); setPin(""); setAskPin(true); setFee("loading");
    const f = await estimateSendFee({ token: { address: token.address, symbol: token.symbol }, to: to.trim(), amount, from: address });
    setFee(f ? f.feeDan : null);
  };
  const submit = async () => {
    if (!token) return;
    setErr(null); setPhase("sending");
    try {
      const pk = await getActivePrivateKey(pin);
      if (!pk) { setErr(tr("tx.pinWrong")); setPhase("idle"); return; }
      const res = await executeSend({
        token: { address: token.address, symbol: token.symbol }, to: to.trim(), amount, privateKey: pk,
        onPhase: (p) => setStatusText(p === "unstick" ? tr("swap.clearingStuck") : ""),
        onHash: (h) => { setTxHash(h); setAskPin(false); setPin(""); setStatusText(""); setPhase("pending"); },
      });
      if (res.status === "confirmed") {
        setPhase("done");
        setTimeout(() => { setPhase("idle"); setAmount(""); setTo(""); setTxHash(null); }, 6000);
      }
    } catch (e: any) { setErr(e?.shortMessage || e?.message || tr("send.failed")); setPhase("idle"); setStatusText(""); }
  };

  return (
    <div className="dw-rise mx-auto max-w-xl space-y-6">
      <Header title={tr("send.sendCoins")} />
      {state === "loading" ? (
        <div className="dw-glass dw-shimmer h-64 rounded-3xl" />
      ) : !token ? (
        <div className="dw-glass flex flex-col items-center gap-3 rounded-3xl py-16 text-center">
          <Warn size={28} className="text-[var(--dw-amber)]" />
          <p className="text-sm text-[var(--dw-muted)]">{tr("send.noCoins")}</p>
        </div>
      ) : phase === "done" || phase === "pending" ? (
        <div className="dw-glass flex flex-col items-center justify-center rounded-3xl py-16">
          {phase === "done" ? (
            <span className="grid h-20 w-20 place-items-center rounded-full bg-[var(--dw-green)]/15 text-[var(--dw-green)] dw-pulse-ring"><Check size={40} /></span>
          ) : (
            <span className="grid h-20 w-20 place-items-center rounded-full bg-[var(--dw-amber)]/15"><span className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--dw-amber)]/25 border-t-[var(--dw-amber)]" /></span>
          )}
          <h2 className="mt-5 text-xl font-semibold">{phase === "done" ? tr("send.sendSuccess") : tr("send.sendPending")}</h2>
          <p className="mt-2 text-sm text-[var(--dw-muted)]">{formatToken(amt, token.symbol)} → {shortAddress(to.trim())}</p>
          {phase === "pending" && <p className="mt-1 max-w-xs text-center text-xs text-[var(--dw-muted)]">{tr("swap.pendingHint")}</p>}
          {txHash && <a href={explorerTx(txHash)} target="_blank" rel="noopener noreferrer" className="dw-btn-ghost mt-5 rounded-xl px-4 py-2 text-xs">{tr("tx.viewOnDannyscan")}</a>}
        </div>
      ) : (
        <>
          <div className="dw-glass rounded-3xl p-4">
            <div className="flex items-center justify-between text-xs text-[var(--dw-muted)]">
              <span>{tr("send.coinToSend")}</span>
              <span>{tr("tx.balance")} {formatToken(token.balance, token.symbol)}<button onClick={() => setAmount(String(token.balance))} className="ml-2 font-medium text-[var(--dw-cyan)]">{tr("tx.max")}</button></span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder="0.00" className="min-w-0 flex-1 bg-transparent text-3xl font-bold outline-none placeholder:text-[var(--dw-muted)]" style={{ color: "var(--dw-text)" }} />
              <TokenSelect token={token} tokens={tokens} onSelect={setToken} filterHeld />
            </div>
          </div>
          <div className="dw-glass rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <label className="text-xs text-[var(--dw-muted)]">{tr("send.recipient")}</label>
              <div ref={bookRef} className="relative">
                <button onClick={() => setBookOpen((v) => !v)} className="flex items-center gap-1 text-xs font-medium text-[var(--dw-cyan)]">
                  <Book size={13} /> {tr("settings.addressBook")}
                </button>
                {bookOpen && (
                  <div className="dw-glass-strong absolute right-0 z-30 mt-2 max-h-64 w-64 overflow-y-auto rounded-2xl border border-[var(--dw-border)] p-2 shadow-2xl" style={{ background: "var(--dw-popover)" }}>
                    {contacts.length === 0 ? (
                      <p className="px-2 py-3 text-center text-xs text-[var(--dw-muted)]">{tr("send.noSavedAddr")}</p>
                    ) : contacts.map((c) => (
                      <button key={c.id} onClick={() => { setTo(c.address); setBookOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/[0.07]">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--dw-violet)] to-[var(--dw-cyan)] text-[11px] font-bold text-white">{c.name[0]}</span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{c.name}</span><span className="block text-[10px] text-[var(--dw-muted)]">{shortAddress(c.address)}</span></span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x…" className="mt-2 w-full bg-transparent font-mono text-sm outline-none placeholder:text-[var(--dw-muted)]" style={{ color: "var(--dw-text)" }} />
            {to && !validAddr && <p className="mt-1 text-xs text-[var(--dw-rose)]">{tr("send.invalidAddr2")}</p>}
            {validAddr && !contacts.some((c) => c.id === to.trim().toLowerCase()) && (
              <div className="mt-3 flex items-center gap-2 border-t border-[var(--dw-border)] pt-3">
                <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder={tr("send.nameToSave")} className="dw-glass flex-1 rounded-lg px-3 py-1.5 text-xs outline-none" style={{ color: "var(--dw-text)" }} />
                <button onClick={() => { if (addContact(saveName, to.trim())) setSaveName(""); }} className="dw-btn-ghost flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs"><Plus size={12} /> {tr("common.save")}</button>
              </div>
            )}
          </div>
          <button onClick={openPin} disabled={!enough || !validAddr} className="dw-btn-primary w-full rounded-2xl py-4 font-semibold disabled:opacity-50">
            {!validAddr ? tr("send.enterRecipient") : !amt ? tr("swap.enterAmount") : !enough ? tr("swap.insufficient") : tr("send.sendPin")}
          </button>
        </>
      )}
      <PinModal open={askPin} onClose={() => { setAskPin(false); setPin(""); }} title={tr("send.confirmTitle2")}
        subtitle={token ? `${tr("send.sendPrefix")} ${formatToken(amt, token.symbol)} → ${shortAddress(to.trim())}` : ""}
        fee={fee} pin={pin} setPin={setPin} onSubmit={submit} busy={phase === "sending"} busyText={statusText || tr("send.sending")} err={err} />
    </div>
  );
}

/* ---------- Receive ---------- */
function ReceiveView({ address, name }: { address: string | null; name?: string }) {
  const { t: tr } = useI18n();
  const [copied, setCopied] = React.useState(false);
  const copy = async () => { if (!address) return; try { await navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 1300); } catch {} };
  return (
    <div className="dw-rise mx-auto max-w-md space-y-6">
      <Header title={tr("receive.title")} />
      <div className="dw-glass flex flex-col items-center rounded-3xl p-8 text-center">
        <p className="text-sm text-[var(--dw-muted)]">{tr("receive.scanCopyPre")} {name || tr("tx.account")} {tr("receive.scanCopyMid")} {CHAIN.name}</p>
        <div className="mt-6 rounded-2xl bg-white p-4">{address && <QrCode value={address} size={220} />}</div>
        <p className="mt-6 break-all rounded-2xl bg-white/[0.04] px-4 py-3 font-mono text-sm">{address}</p>
        <button onClick={copy} className="dw-btn-primary mt-4 flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold">
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? tr("receive.copied") : tr("acct.copyAddress")}
        </button>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-[var(--dw-amber)]"><Warn size={13} /> {tr("receive.onlyPre")} {CHAIN.name} {tr("receive.onlySuf")}</p>
      </div>
    </div>
  );
}

/* ---------- Activity ---------- */
function ActivityView({ address }: { address: string | null }) {
  const { t: tr } = useI18n();
  const { list: contacts } = useAddressBook();
  const [txs, setTxs] = React.useState<Tx[] | null>(null);
  const [state, setState] = React.useState<"loading" | "ok" | "error">("loading");

  // จับคู่ชื่อจากสมุดที่อยู่: ย่อ address ในสมุดให้ตรงรูปแบบ counterparty ของ API
  const nameByShort = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const c of contacts) {
      const a = c.address.toLowerCase();
      m.set(a.length < 12 ? a : `${a.slice(0, 6)}…${a.slice(-4)}`, c.name);
    }
    return m;
  }, [contacts]);
  React.useEffect(() => {
    if (!address) return;
    setState("loading");
    fetch(`/api/danny/activity?address=${address}`).then((r) => r.json())
      .then((j: { txs?: Tx[] }) => { setTxs(j.txs || []); setState("ok"); })
      .catch(() => setState("error"));
  }, [address]);

  return (
    <div className="dw-rise space-y-6">
      <Header title={tr("activity.title")} />
      <div className="dw-glass rounded-3xl p-2 sm:p-4">
        {state === "loading" ? (
          <div className="space-y-2 p-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="dw-shimmer h-14 rounded-xl" />)}</div>
        ) : state === "error" ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center"><Warn size={28} className="text-[var(--dw-rose)]" /><p className="text-sm text-[var(--dw-muted)]">{tr("activity.loadFailed")}</p></div>
        ) : !txs || txs.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--dw-muted)]">{tr("activity.empty")}</p>
        ) : (
          <div className="divide-y divide-[var(--dw-border)]/60">
            {txs.map((t) => {
              const inbound = t.type === "receive";
              const Icon = t.type === "swap" ? SwapIcon : inbound ? ArrowDown : ArrowUp;
              return (
                <a key={t.id} href={explorerTx(t.hash ?? "")} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-3 transition hover:bg-white/[0.03]">
                  <span className={`grid h-10 w-10 place-items-center rounded-full ${inbound ? "bg-[var(--dw-green)]/15 text-[var(--dw-green)]" : t.type === "swap" ? "bg-[var(--dw-violet)]/15 text-[var(--dw-cyan)]" : "bg-white/[0.06] text-[var(--dw-muted)]"}`}><Icon size={17} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {t.type === "swap" ? `${tr("common.swap")} ${t.token} → ${t.toToken ?? ""}` : t.type === "receive" ? `${tr("common.receive")} ${t.token}` : `${tr("common.send")} ${t.token}`}
                    </p>
                    <p className="truncate text-xs text-[var(--dw-muted)]">
                      {nameByShort.get(t.counterparty.toLowerCase()) ? (
                        <span className="text-[var(--dw-cyan)]">{nameByShort.get(t.counterparty.toLowerCase())}</span>
                      ) : t.counterparty} · {timeAgo(t.timestamp, tr)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold tabular-nums ${inbound ? "text-[var(--dw-green)]" : ""}`}>
                      {inbound ? "+" : t.type === "send" ? "-" : ""}{formatToken(t.amount)} {t.token}
                    </p>
                    <p className="text-xs text-[var(--dw-muted)]">{t.status === "pending" ? tr("tx.statusPending") : t.status === "failed" ? tr("tx.statusFailed") : tr("tx.statusSuccess")}</p>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- shared bits ---------- */
function Header({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {right}
    </div>
  );
}
function PinModal({ open, onClose, title, subtitle, fee, pin, setPin, onSubmit, busy, busyText, err, note }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string;
  fee: number | null | "loading"; pin: string; setPin: (v: string) => void;
  onSubmit: () => void; busy: boolean; busyText?: string; err: string | null; note?: string;
}) {
  const { t: tr } = useI18n();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[3000] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="dw-glass-strong w-full max-w-sm rounded-3xl border border-[var(--dw-border)] p-6" style={{ background: "var(--dw-popover)" }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-[var(--dw-muted)]">{subtitle}</p>}
        <p className="mt-3 text-xs text-[var(--dw-muted)]">
          {tr("tx.gasEst")}: {fee === "loading" ? tr("tx.estimating") : fee != null ? `≈ ${fee.toLocaleString("en-US", { maximumFractionDigits: 8 })} DAN` : tr("tx.gasUnavailable")}
        </p>
        {note && (
          <div className="dw-glass mt-3 flex items-start gap-2 rounded-2xl border-[var(--dw-amber)]/30 bg-[var(--dw-amber)]/[0.06] p-3 text-xs text-[var(--dw-muted)]">
            <Warn size={14} className="mt-0.5 shrink-0 text-[var(--dw-amber)]" /> {note}
          </div>
        )}
        <input type="password" inputMode="numeric" maxLength={6} value={pin} autoFocus
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && pin.length === 6 && !busy && onSubmit()}
          placeholder={tr("tx.enterPin")}
          className="dw-glass mt-4 w-full rounded-2xl px-4 py-3 text-center text-lg tracking-[0.4em] outline-none focus:border-[var(--dw-cyan)]/50" style={{ color: "var(--dw-text)" }} />
        {err && <p className="mt-2 flex items-center justify-center gap-1 text-xs text-[var(--dw-rose)]"><Warn size={13} /> {err}</p>}
        <button onClick={onSubmit} disabled={pin.length < 6 || busy} className="dw-btn-primary mt-4 w-full rounded-2xl py-3.5 font-semibold disabled:opacity-50">
          {busy ? busyText || tr("tx.processing") : tr("common.confirm")}
        </button>
      </div>
    </div>
  );
}

/* ---------- Settings ---------- */
function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="dw-glass rounded-3xl p-6">
      <h2 className="text-sm font-semibold text-[var(--dw-muted)]">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function SecretReveal({ label, hint, onReveal }: { label: string; hint: string; onReveal: (pin: string) => Promise<string | null> }) {
  const { t: tr } = useI18n();
  const [pin, setPin] = React.useState("");
  const [secret, setSecret] = React.useState<string | null>(null);
  const [err, setErr] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const go = async () => {
    setBusy(true); setErr(false);
    const s = await onReveal(pin); setBusy(false);
    if (s) { setSecret(s); setPin(""); } else setErr(true);
  };
  if (secret) {
    return (
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-2 break-all rounded-xl bg-[var(--dw-amber)]/[0.08] p-3 font-mono text-xs">{secret}</p>
        <div className="mt-2 flex gap-2">
          <button onClick={async () => { try { await navigator.clipboard.writeText(secret); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {} }} className="dw-btn-ghost flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs">
            {copied ? <Check size={13} className="text-[var(--dw-green)]" /> : <Copy size={13} />} {tr("common.copy")}
          </button>
          <button onClick={() => setSecret(null)} className="dw-btn-ghost rounded-lg px-3 py-1.5 text-xs">{tr("common.hide")}</button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-[var(--dw-muted)]">{hint}</p>
      <div className="mt-2 flex gap-2">
        <input type="password" inputMode="numeric" maxLength={6} value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setErr(false); }}
          placeholder={tr("tx.enterPin")} className="dw-glass w-32 rounded-xl px-3 py-2 text-center text-sm tracking-[0.3em] outline-none" style={{ color: "var(--dw-text)" }} />
        <button onClick={go} disabled={pin.length < 6 || busy} className="dw-btn-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy ? "…" : tr("common.show")}</button>
        {err && <span className="self-center text-xs text-[var(--dw-rose)]">{tr("tx.pinWrong")}</span>}
      </div>
    </div>
  );
}

function SettingsView({ light, toggleTheme, onReset }: { light: boolean; toggleTheme: () => void; onReset: () => void }) {
  const { t: tr } = useI18n();
  const { autoLockMin, balanceHidden, toggleBalance, setPref, changePin, revealMnemonic, revealPrivateKey, reset, hasSeed, activeIndex, address, getActivePrivateKey } = useWallet();
  const { list: contacts, add: addContact, remove: removeContact } = useAddressBook();
  const [cName, setCName] = React.useState(""), [cAddr, setCAddr] = React.useState("");
  const [op, setOp] = React.useState(""), [np, setNp] = React.useState(""), [cp, setCp] = React.useState("");
  const [pinMsg, setPinMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  // ล้างธุรกรรมค้าง / รีเซ็ต nonce
  const [stuckCount, setStuckCount] = React.useState<number | null>(null);
  const [noncePin, setNoncePin] = React.useState("");
  const [nonceBusy, setNonceBusy] = React.useState(false);
  const [nonceMsg, setNonceMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  React.useEffect(() => {
    if (address) getStuckCount(address).then(setStuckCount).catch(() => setStuckCount(0));
  }, [address]);
  const doResetNonce = async () => {
    setNonceMsg(null); setNonceBusy(true);
    try {
      const pk = await getActivePrivateKey(noncePin);
      if (!pk) { setNonceMsg({ ok: false, text: tr("tx.pinWrong") }); setNonceBusy(false); return; }
      const cleared = await clearStuckTransactions({ privateKey: pk });
      setNonceMsg({ ok: true, text: `${tr("settings.unblocked")} ${cleared} ${tr("settings.items")}` });
      setNoncePin("");
      if (address) { try { setStuckCount(await getStuckCount(address)); } catch { /* noop */ } }
    } catch (e: any) {
      setNonceMsg({ ok: false, text: e?.shortMessage || e?.message || tr("send.failed") });
    } finally {
      setNonceBusy(false);
    }
  };

  const doChangePin = async () => {
    if (np.length < 6 || np !== cp) { setPinMsg({ ok: false, text: tr("dset.pinMismatch") }); return; }
    setBusy(true);
    const ok = await changePin(op, np); setBusy(false);
    setPinMsg(ok ? { ok: true, text: tr("dset.pinChanged") } : { ok: false, text: tr("dset.pinOldWrong") });
    if (ok) { setOp(""); setNp(""); setCp(""); }
  };

  const fileRef = React.useRef<HTMLInputElement>(null);
  const exportBook = () => {
    const data = JSON.stringify(contacts.map(({ name, address }) => ({ name, address })), null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = "danny-addressbook.json"; a.click();
    URL.revokeObjectURL(url);
  };
  const importBook = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const arr = JSON.parse(String(reader.result));
          if (Array.isArray(arr)) arr.forEach((c) => { if (c && typeof c.address === "string") addContact(typeof c.name === "string" ? c.name : "", c.address); });
        } catch { /* ไฟล์ไม่ถูกต้อง */ }
      };
      reader.readAsText(f);
    }
    e.target.value = "";
  };

  return (
    <div className="dw-rise mx-auto max-w-2xl space-y-5">
      <Header title={tr("settings.title")} />

      <SettingsCard title={tr("settings.generalSection")}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">ภาษา / Language</p>
          <LanguageToggle />
        </div>
        <Toggle label={tr("dset.lightTheme")} desc={tr("dset.lightThemeDesc")} on={light} onClick={toggleTheme} />
        <Toggle label={tr("settings.hideBalance")} desc={tr("settings.hideBalanceDesc")} on={balanceHidden} onClick={toggleBalance} />
        <div className="flex items-center justify-between">
          <div><p className="text-sm font-medium">{tr("settings.autoLock")}</p><p className="text-xs text-[var(--dw-muted)]">{tr("dset.autoLockIdleDesc")}</p></div>
          <select value={autoLockMin} onChange={(e) => setPref({ autoLockMin: Number(e.target.value) })}
            className="dw-glass rounded-xl px-3 py-2 text-sm outline-none" style={{ color: "var(--dw-text)" }}>
            {[1, 3, 5, 15, 30].map((m) => <option key={m} value={m} className="text-black">{m} {tr("settings.minutes")}</option>)}
            <option value={0} className="text-black">{tr("settings.lockOff")}</option>
          </select>
        </div>
      </SettingsCard>

      <SettingsCard title={tr("settings.secSection")}>
        <div>
          <p className="text-sm font-medium">{tr("dset.changePin")}</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[[tr("dset.pinOld"), op, setOp], [tr("dset.pinNew"), np, setNp], [tr("dset.pinConfirmNew"), cp, setCp]].map(([ph, val, set]: any) => (
              <input key={ph} type="password" inputMode="numeric" maxLength={6} value={val} placeholder={ph}
                onChange={(e) => { set(e.target.value.replace(/\D/g, "")); setPinMsg(null); }}
                className="dw-glass rounded-xl px-3 py-2 text-center text-sm outline-none" style={{ color: "var(--dw-text)" }} />
            ))}
          </div>
          {pinMsg && <p className={`mt-2 text-xs ${pinMsg.ok ? "text-[var(--dw-green)]" : "text-[var(--dw-rose)]"}`}>{pinMsg.text}</p>}
          <button onClick={doChangePin} disabled={busy || !op || !np || !cp} className="dw-btn-primary mt-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {busy ? "…" : tr("dset.savePin")}
          </button>
        </div>
        {hasSeed && <SecretReveal label={tr("dset.recoveryLabel")} hint={tr("dset.recoveryHint")} onReveal={revealMnemonic} />}
        <SecretReveal label={tr("dset.pkLabel")} hint={tr("dset.pkHint")} onReveal={(pin) => revealPrivateKey(activeIndex, pin)} />
      </SettingsCard>

      <SettingsCard title={tr("settings.addressBook")}>
        {contacts.length > 0 ? (
          <div className="space-y-2">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--dw-violet)] to-[var(--dw-cyan)] text-xs font-bold text-white">{c.name[0]}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{c.name}</span><span className="block font-mono text-[11px] text-[var(--dw-muted)]">{shortAddress(c.address)}</span></span>
                <button onClick={() => removeContact(c.id)} className="text-xs text-[var(--dw-rose)] hover:underline">{tr("common.remove")}</button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--dw-muted)]">{tr("send.noSavedAddr")}</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input value={cName} onChange={(e) => setCName(e.target.value)} placeholder={tr("common.name")} className="dw-glass w-28 rounded-xl px-3 py-2 text-sm outline-none" style={{ color: "var(--dw-text)" }} />
          <input value={cAddr} onChange={(e) => setCAddr(e.target.value)} placeholder="0x…" className="dw-glass min-w-0 flex-1 rounded-xl px-3 py-2 font-mono text-sm outline-none" style={{ color: "var(--dw-text)" }} />
          <button onClick={() => { if (addContact(cName, cAddr)) { setCName(""); setCAddr(""); } }} disabled={!isValidAddress(cAddr)} className="dw-btn-primary flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"><Plus size={14} /> {tr("common.add")}</button>
        </div>
        <div className="flex items-center gap-2 border-t border-[var(--dw-border)] pt-3">
          <button onClick={exportBook} disabled={contacts.length === 0} className="dw-btn-ghost flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs disabled:opacity-40"><ArrowUp size={13} /> {tr("dset.export")}</button>
          <button onClick={() => fileRef.current?.click()} className="dw-btn-ghost flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"><ArrowDown size={13} /> {tr("dset.import")}</button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={importBook} className="hidden" />
          <span className="ml-auto text-[11px] text-[var(--dw-muted)]">{contacts.length} {tr("dset.addressesSuffix")}</span>
        </div>
      </SettingsCard>

      <SettingsCard title={tr("settings.resetNonce")}>
        <p className="text-xs text-[var(--dw-muted)]">{tr("settings.nonceSheetDesc")}</p>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--dw-muted)]">{tr("settings.stuckInQueue")}</span>
          <span className="font-semibold">{stuckCount === null ? tr("settings.checkingStuck") : `${stuckCount} ${tr("settings.items")}`}</span>
        </div>
        {stuckCount === 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-[var(--dw-green)]"><Check size={16} /> {tr("settings.noStuck")}</p>
        ) : (
          <>
            <p className="flex items-start gap-1.5 text-xs text-[var(--dw-amber)]"><Warn size={14} className="mt-0.5 shrink-0" /> {tr("settings.resetNonceWarn")}</p>
            <div className="flex items-center gap-2">
              <input type="password" inputMode="numeric" maxLength={6} value={noncePin}
                onChange={(e) => { setNoncePin(e.target.value.replace(/\D/g, "")); setNonceMsg(null); }}
                onKeyDown={(e) => e.key === "Enter" && noncePin.length === 6 && !nonceBusy && doResetNonce()}
                placeholder={tr("tx.enterPin")} className="dw-glass w-32 rounded-xl px-3 py-2 text-center text-sm outline-none" style={{ color: "var(--dw-text)" }} />
              <button onClick={doResetNonce} disabled={noncePin.length < 6 || nonceBusy || stuckCount === null}
                className="dw-btn-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50">
                {nonceBusy ? tr("settings.clearing") : tr("settings.resetNonceBtn")}
              </button>
            </div>
          </>
        )}
        {nonceMsg && <p className={`text-xs ${nonceMsg.ok ? "text-[var(--dw-green)]" : "text-[var(--dw-rose)]"}`}>{nonceMsg.text}</p>}
      </SettingsCard>

      <SettingsCard title={tr("dset.dangerZone")}>
        <div className="flex items-center justify-between">
          <div><p className="text-sm font-medium text-[var(--dw-rose)]">{tr("dset.wipeWallet")}</p><p className="text-xs text-[var(--dw-muted)]">{tr("dset.wipeDesc")}</p></div>
          <button onClick={() => { if (confirm(tr("dset.wipeConfirm"))) { reset(); onReset(); } }}
            className="rounded-xl border border-[var(--dw-rose)]/40 bg-[var(--dw-rose)]/10 px-4 py-2 text-sm font-semibold text-[var(--dw-rose)] transition hover:bg-[var(--dw-rose)]/20">
            {tr("dset.wipeBtn")}
          </button>
        </div>
      </SettingsCard>
    </div>
  );
}

function Toggle({ label, desc, on, onClick }: { label: string; desc: string; on: boolean; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-[var(--dw-muted)]">{desc}</p></div>
      <button onClick={onClick} className={`relative h-6 w-11 rounded-full transition ${on ? "bg-[var(--dw-violet)]" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[1.4rem]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

/* ---------- Buy / On-ramp ---------- */
function BuyModal({ open, onClose, onReceive }: { open: boolean; onClose: () => void; onReceive: () => void }) {
  const { t: tr } = useI18n();
  if (!open) return null;
  const methods: { name: string; note: string; url?: string }[] = [
    { name: tr("buy.creditCard"), note: tr("buy.comingSoon") },
    { name: tr("buy.bankTransfer"), note: tr("buy.comingSoon") },
    { name: tr("buy.bridge"), note: tr("buy.online"), url: "https://dannybridge.com/" },
  ];
  return (
    <div className="fixed inset-0 z-[3000] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="dw-glass-strong w-full max-w-md rounded-3xl border border-[var(--dw-border)] p-6" style={{ background: "var(--dw-popover)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[var(--dw-violet)] to-[var(--dw-cyan)] text-white"><Card size={20} /></span>
          <div><h3 className="text-lg font-semibold">{tr("desktop.buyCrypto")}</h3><p className="text-xs text-[var(--dw-muted)]">{tr("buy.subtitle")}</p></div>
        </div>

        <div className="mt-5 space-y-2">
          {methods.map((p) => {
            const online = !!p.url;
            const inner = (
              <>
                <span className="text-sm font-medium">{p.name}</span>
                <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] ${online ? "bg-[var(--dw-green)]/15 text-[var(--dw-green)]" : "bg-[var(--dw-amber)]/15 text-[var(--dw-amber)]"}`}>
                  {online && <span className="h-1.5 w-1.5 rounded-full bg-[var(--dw-green)] dw-pulse-ring" />}
                  {p.note}
                </span>
              </>
            );
            return p.url ? (
              <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-2xl border border-[var(--dw-border)] bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.06]">
                {inner}
              </a>
            ) : (
              <div key={p.name} className="flex items-center justify-between rounded-2xl border border-[var(--dw-border)] bg-white/[0.03] px-4 py-3">
                {inner}
              </div>
            );
          })}
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--dw-green)]/25 bg-[var(--dw-green)]/[0.06] p-4">
          <p className="text-sm font-medium">{tr("buy.haveCoins")}</p>
          <p className="mt-1 text-xs text-[var(--dw-muted)]">{tr("buy.haveCoinsDesc")}</p>
          <button onClick={onReceive} className="dw-btn-primary mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold">
            <ArrowDown size={16} /> {tr("buy.receiveDeposit")}
          </button>
        </div>

        <button onClick={onClose} className="dw-btn-ghost mt-3 w-full rounded-xl py-2.5 text-sm text-[var(--dw-muted)]">{tr("common.close")}</button>
      </div>
    </div>
  );
}
