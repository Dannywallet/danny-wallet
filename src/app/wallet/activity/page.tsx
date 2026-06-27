"use client";

import React from "react";
import { Screen } from "@/components/wallet/PhoneShell";
import { BottomNav } from "@/components/wallet/BottomNav";
import { TxRow } from "@/components/wallet/TxRow";
import { SecurityBadge } from "@/components/wallet/SecurityBadge";
import { shortAddress } from "@/lib/wallet/format";
import { Warn } from "@/components/wallet/Icons";
import { type Tx } from "@/lib/wallet/mock-data";
import { useWallet } from "@/lib/wallet/wallet-store";
import { useI18n } from "@/lib/wallet/i18n";

const FILTERS = [
  { key: "all", label: "common.all" },
  { key: "send", label: "common.send" },
  { key: "receive", label: "common.receive" },
] as const;

function dayLabel(ts: number, t: (k: string) => string): string {
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  const isYest = d.toDateString() === yest.toDateString();
  if (isToday) return t("time.today");
  if (isYest) return t("time.yesterday");
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

type ApiResp = { count: number; address: string; source: string; txs: Tx[]; error?: string };

export default function Activity() {
  const { t } = useI18n();
  const { address } = useWallet();
  const DEMO_ADDRESS = address ?? "";
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]["key"]>("all");
  const [data, setData] = React.useState<ApiResp | null>(null);
  const [state, setState] = React.useState<"loading" | "ok" | "error">("loading");

  const load = React.useCallback(() => {
    if (!address) return;
    setState("loading");
    fetch(`/api/danny/activity?address=${address}`)
      .then((r) => r.json())
      .then((j: ApiResp) => {
        if (j.error && !j.txs?.length) setState("error");
        else {
          setData(j);
          setState("ok");
        }
      })
      .catch(() => setState("error"));
  }, [address]);

  React.useEffect(() => {
    load();
  }, [load]);

  const list = (data?.txs || []).filter((t) => filter === "all" || t.type === filter);
  const groups: Record<string, Tx[]> = {};
  for (const tx of list) {
    const k = dayLabel(tx.timestamp, t);
    (groups[k] ||= []).push(tx);
  }

  return (
    <>
      <div className="relative z-10 flex items-center justify-between px-5 pb-1 pt-6">
        <div>
          <h1 className="text-xl font-bold">{t("nav.activityTab")}</h1>
          <p className="flex items-center gap-1.5 text-xs text-[var(--dw-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--dw-green)]" />
            {t("activity.liveFromPre")} {shortAddress(DEMO_ADDRESS)}
          </p>
        </div>
        <SecurityBadge label={t("common.liveData")} />
      </div>
      <Screen className="pt-3">
        {/* ตัวกรอง */}
        <div className="mb-4 flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                filter === f.key ? "dw-btn-primary" : "dw-btn-ghost text-[var(--dw-muted)]"
              }`}
            >
              {t(f.label)}
            </button>
          ))}
        </div>

        {state === "loading" && (
          <div className="space-y-2.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="dw-glass dw-shimmer h-16 rounded-2xl" />
            ))}
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Warn size={32} className="text-[var(--dw-rose)]" />
            <p className="text-sm text-[var(--dw-muted)]">{t("activity.connectFailed")}</p>
            <button onClick={load} className="dw-btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold">
              {t("common.retry")}
            </button>
          </div>
        )}

        {state === "ok" &&
          (Object.keys(groups).length === 0 ? (
            <p className="py-16 text-center text-sm text-[var(--dw-muted)]">{t("activity.empty")}</p>
          ) : (
            <>
              {Object.entries(groups).map(([day, txs]) => (
                <div key={day} className="mb-5">
                  <p className="mb-2 px-1 text-xs font-medium text-[var(--dw-muted)]">{day}</p>
                  <div className="space-y-2.5">
                    {txs.map((tx) => (
                      <TxRow key={tx.id} tx={tx} />
                    ))}
                  </div>
                </div>
              ))}
              <p className="mt-1 text-center text-[11px] text-[var(--dw-muted)]">
                {data?.count} {t("activity.recentTx")} · {t("activity.source")} {data?.source}
              </p>
            </>
          ))}
      </Screen>
      <BottomNav />
    </>
  );
}
