"use client";

import React from "react";
import { Screen } from "@/components/wallet/PhoneShell";
import { TopBar } from "@/components/wallet/TopBar";
import { QrCode } from "@/components/wallet/QrCode";
import { CHAIN } from "@/lib/wallet/mock-data";
import { useWallet } from "@/lib/wallet/wallet-store";
import { Copy, Check, Share, Warn } from "@/components/wallet/Icons";

export default function Receive() {
  const { address } = useWallet();
  const MY_ADDRESS = address ?? "";
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(MY_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "ที่อยู่ Danny Wallet", text: MY_ADDRESS });
      else copy();
    } catch {
      /* noop */
    }
  };

  return (
    <>
      <TopBar title="รับเหรียญ" />
      <Screen className="flex flex-col items-center">
        <div className="mt-2 flex items-center gap-1.5 rounded-full bg-[var(--dw-violet)]/15 px-3 py-1 text-xs font-medium text-[var(--dw-purple)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--dw-green)]" /> เครือข่าย {CHAIN.name}
        </div>

        <div className="dw-glass-strong dw-glow-cyan mt-5 rounded-[32px] p-5">
          <div className="rounded-2xl bg-white p-3">
            <QrCode value={MY_ADDRESS} size={216} />
          </div>
        </div>

        <p className="mt-5 text-sm text-[var(--dw-muted)]">ที่อยู่กระเป๋าของคุณ</p>
        <button
          onClick={copy}
          className="dw-glass mt-2 max-w-full break-all rounded-2xl px-4 py-3 text-center text-sm font-medium"
        >
          {MY_ADDRESS}
        </button>

        <div className="mt-5 flex w-full gap-3">
          <button onClick={copy} className="dw-btn-primary flex flex-1 items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold">
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? "คัดลอกแล้ว" : "คัดลอก"}
          </button>
          <button onClick={share} className="dw-btn-ghost flex flex-1 items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold">
            <Share size={18} /> แชร์
          </button>
        </div>

        <div className="dw-glass mt-5 flex items-start gap-2 rounded-2xl border-[var(--dw-amber)]/25 bg-[var(--dw-amber)]/[0.06] p-3.5 text-xs text-[var(--dw-muted)]">
          <Warn size={16} className="mt-0.5 shrink-0 text-[var(--dw-amber)]" />
          ส่งเฉพาะสินทรัพย์บนเครือข่าย {CHAIN.name} มายังที่อยู่นี้ การส่งข้ามเครือข่ายอาจทำให้สูญหาย
        </div>
        <p className="mt-3 text-[11px] text-[var(--dw-muted)]">QR นี้เป็นภาพสาธิต ไม่ใช่โค้ดสำหรับสแกนจริง</p>
      </Screen>
    </>
  );
}
