"use client";

// แจ้งเตือนธุรกรรม: poll /api/danny/activity ทุก 30 วิ → คืนจำนวนที่ยังไม่อ่าน (badge) + toast รายการใหม่
import React from "react";
import type { Tx } from "@/lib/wallet/mock-data";

export function useTxAlerts(address: string | null) {
  const [unread, setUnread] = React.useState(0);
  const [toast, setToast] = React.useState<Tx | null>(null);
  const lastSeen = React.useRef<string | null>(null);
  const prevLatest = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!address) return;
    let alive = true;
    const SEEN_KEY = "dannywallet.lastSeenTx." + address.toLowerCase();
    lastSeen.current = (() => { try { return localStorage.getItem(SEEN_KEY); } catch { return null; } })();
    prevLatest.current = null;

    const poll = async () => {
      try {
        const j = await fetch(`/api/danny/activity?address=${address}`).then((r) => r.json());
        const txs: Tx[] = j.txs || [];
        if (!alive || !txs.length) return;
        const latest = txs[0].id;
        // นับที่ใหม่กว่า lastSeen
        const seenIdx = lastSeen.current ? txs.findIndex((t) => t.id === lastSeen.current) : -1;
        setUnread(seenIdx < 0 ? txs.length : seenIdx);
        // ถ้ามีรายการใหม่หลังเปิดแอป → เด้ง toast
        if (prevLatest.current && latest !== prevLatest.current) setToast(txs[0]);
        prevLatest.current = latest;
        if (!lastSeen.current) { lastSeen.current = latest; try { localStorage.setItem(SEEN_KEY, latest); } catch {} }
      } catch { /* noop */ }
    };
    poll();
    const id = setInterval(poll, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, [address]);

  // ซ่อน toast อัตโนมัติ
  React.useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  const markSeen = React.useCallback(() => {
    if (!address) return;
    setUnread(0);
    if (prevLatest.current) { lastSeen.current = prevLatest.current; try { localStorage.setItem("dannywallet.lastSeenTx." + address.toLowerCase(), prevLatest.current); } catch {} }
  }, [address]);

  return { unread, toast, dismissToast: () => setToast(null), markSeen };
}
