"use client";

import React from "react";
import type { Tx } from "@/lib/wallet/mock-data";
import { formatToken } from "@/lib/wallet/format";
import { ArrowUp, ArrowDown, Swap } from "./Icons";
import { useI18n } from "@/lib/wallet/i18n";

function timeAgo(ts: number, t: (k: string) => string): string {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 60) return `${m} ${t("time.min")} ${t("time.ago")}`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${t("time.hour")} ${t("time.ago")}`;
  const d = Math.round(h / 24);
  return `${d} ${t("time.day")} ${t("time.ago")}`;
}

const META = {
  send: { labelKey: "common.send", color: "var(--dw-rose)", Icon: ArrowUp, sign: "-" },
  receive: { labelKey: "common.receive", color: "var(--dw-green)", Icon: ArrowDown, sign: "+" },
  swap: { labelKey: "common.swap", color: "var(--dw-cyan)", Icon: Swap, sign: "" },
} as const;

const STATUS = {
  confirmed: { labelKey: "tx.statusSuccess", cls: "text-[var(--dw-green)]" },
  pending: { labelKey: "tx.statusPending", cls: "text-[var(--dw-amber)]" },
  failed: { labelKey: "tx.statusFailed", cls: "text-[var(--dw-rose)]" },
} as const;

export function TxRow({ tx }: { tx: Tx }) {
  const { t } = useI18n();
  const m = META[tx.type];
  const s = STATUS[tx.status];
  return (
    <div className="dw-glass flex items-center gap-3 rounded-2xl px-3.5 py-3">
      <span
        className="grid h-10 w-10 place-items-center rounded-full"
        style={{ background: `${m.color}1f`, color: m.color }}
      >
        <m.Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {t(m.labelKey)} {tx.token}
          {tx.type === "swap" && tx.toToken ? ` → ${tx.toToken}` : ""}
        </p>
        <p className="truncate text-xs text-[var(--dw-muted)]">
          {tx.counterparty} · {timeAgo(tx.timestamp, t)}
        </p>
      </div>
      <div className="text-right">
        <p className="font-semibold tabular-nums" style={{ color: m.color }}>
          {m.sign}
          {formatToken(tx.amount, tx.token)}
        </p>
        {tx.valueUsd != null ? (
          <p className="text-[11px] tabular-nums text-[var(--dw-muted)]">
            ≈ {tx.valueUsd < 0.01 ? "<$0.01" : `$${tx.valueUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
            <span className={`ml-1.5 ${s.cls}`}>{t(s.labelKey)}</span>
          </p>
        ) : (
          <p className={`text-[11px] ${s.cls}`}>{t(s.labelKey)}</p>
        )}
      </div>
    </div>
  );
}
