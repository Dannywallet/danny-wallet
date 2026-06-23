"use client";

import React from "react";
import type { Tx } from "@/lib/wallet/mock-data";
import { formatToken } from "@/lib/wallet/format";
import { ArrowUp, ArrowDown, Swap } from "./Icons";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ชม.ที่แล้ว`;
  const d = Math.round(h / 24);
  return `${d} วันที่แล้ว`;
}

const META = {
  send: { label: "ส่ง", color: "var(--dw-rose)", Icon: ArrowUp, sign: "-" },
  receive: { label: "รับ", color: "var(--dw-green)", Icon: ArrowDown, sign: "+" },
  swap: { label: "สลับ", color: "var(--dw-cyan)", Icon: Swap, sign: "" },
} as const;

const STATUS = {
  confirmed: { label: "สำเร็จ", cls: "text-[var(--dw-green)]" },
  pending: { label: "กำลังดำเนินการ", cls: "text-[var(--dw-amber)]" },
  failed: { label: "ล้มเหลว", cls: "text-[var(--dw-rose)]" },
} as const;

export function TxRow({ tx }: { tx: Tx }) {
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
          {m.label} {tx.token}
          {tx.type === "swap" && tx.toToken ? ` → ${tx.toToken}` : ""}
        </p>
        <p className="truncate text-xs text-[var(--dw-muted)]">
          {tx.counterparty} · {timeAgo(tx.timestamp)}
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
            <span className={`ml-1.5 ${s.cls}`}>{s.label}</span>
          </p>
        ) : (
          <p className={`text-[11px] ${s.cls}`}>{s.label}</p>
        )}
      </div>
    </div>
  );
}
