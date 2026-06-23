"use client";

// hook กลาง: ดึง token จริงที่ถือครอง (จากพอร์ต dandex on-chain) ไปใช้ในหน้า Send/Swap
import React from "react";
import { useWallet } from "@/lib/wallet/wallet-store";
import type { Holding } from "@/app/api/danny/portfolio/route";
import type { DannyToken } from "@/app/api/danny/tokens/route";
import { WDAN } from "@/lib/wallet/danny-prices";

const PALETTE: [string, string][] = [
  ["#7c3aed", "#22d3ee"], ["#22d3ee", "#34d399"], ["#f59e0b", "#f43f5e"],
  ["#6366f1", "#a855f7"], ["#ec4899", "#8b5cf6"], ["#0ea5e9", "#14b8a6"],
  ["#f43f5e", "#f59e0b"], ["#10b981", "#3b82f6"],
];
export function gradientFor(key: string): [string, string] {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export type WToken = {
  symbol: string;
  name: string;
  address: string | null; // null = native DAN
  balance: number;
  priceUsd: number | null;
  gradient: [string, string];
  logo: string | null;
  isNative?: boolean;
};

export function useHoldings() {
  const { address } = useWallet();
  const [tokens, setTokens] = React.useState<WToken[]>([]);
  const [state, setState] = React.useState<"loading" | "ok" | "error">("loading");

  React.useEffect(() => {
    if (!address) return;
    let alive = true;
    setState("loading");
    fetch(`/api/danny/portfolio?address=${address}`)
      .then((r) => r.json())
      .then((j: { holdings?: Holding[]; error?: string }) => {
        if (!alive) return;
        if (j.error && !j.holdings?.length) {
          setState("error");
          return;
        }
        const list: WToken[] = (j.holdings || [])
          .filter((h) => !h.spam) // ไม่เอาเหรียญสแปม/พูลฝุ่นมาให้ส่ง/สลับ
          .map((h) => ({
            symbol: h.symbol,
            name: h.name,
            address: h.address,
            balance: h.balance,
            priceUsd: h.priceUsd,
            gradient: gradientFor(h.address || h.symbol),
            logo: h.logo,
            isNative: h.isNative,
          }));
        setTokens(list);
        setState("ok");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [address]);

  return { tokens, state };
}

/**
 * hook สำหรับหน้า Swap — รวม "ทุกเหรียญที่เทรดได้บนเชน" (ไม่ใช่แค่ที่ถือ)
 * โดย merge ยอดคงเหลือเข้าไป (0 ถ้ายังไม่มี) + ใส่ native DAN ไว้บนสุด
 * ทำให้หน้า swap โหลดได้เสมอและเลือกสลับได้แม้ wallet ยังไม่มีเงิน
 */
export function useSwapTokens() {
  const { address } = useWallet();
  const [tokens, setTokens] = React.useState<WToken[]>([]);
  const [state, setState] = React.useState<"loading" | "ok" | "error">("loading");

  React.useEffect(() => {
    let alive = true;
    setState("loading");
    Promise.all([
      fetch(`/api/danny/tokens`).then((r) => r.json()),
      address
        ? fetch(`/api/danny/portfolio?address=${address}`).then((r) => r.json())
        : Promise.resolve({ holdings: [] }),
    ])
      .then(([tj, pj]: [{ tokens?: DannyToken[]; error?: string }, { holdings?: Holding[] }]) => {
        if (!alive) return;
        const universe = tj.tokens || [];
        if (!universe.length) {
          setState("error");
          return;
        }
        // map ยอดคงเหลือ: key = contract (lowercase) | "native"
        const balByKey = new Map<string, number>();
        const native = (pj.holdings || []).find((h) => h.isNative);
        for (const h of pj.holdings || []) {
          if (h.spam) continue; // ข้ามเหรียญสแปม
          balByKey.set((h.address || "native").toLowerCase(), h.balance);
        }

        const wdan = universe.find((t) => t.address.toLowerCase() === WDAN.toLowerCase());
        const danPrice = native?.priceUsd ?? wdan?.priceUsd ?? null;

        const list: WToken[] = [
          // native DAN บนสุดเสมอ
          {
            symbol: "DAN",
            name: native?.name || "Danny",
            address: null,
            balance: balByKey.get("native") ?? 0,
            priceUsd: danPrice,
            gradient: gradientFor("DAN"),
            logo: native?.logo ?? wdan?.logo ?? null,
            isNative: true,
          },
          ...universe.map((t) => ({
            symbol: t.symbol,
            name: t.name,
            address: t.address,
            balance: balByKey.get(t.address.toLowerCase()) ?? 0,
            priceUsd: t.priceUsd,
            gradient: gradientFor(t.address || t.symbol),
            logo: t.logo,
          })),
        ];

        // เรียง: เหรียญที่ถือ (มูลค่าสูงสุดก่อน) → ที่เหลือคงลำดับเดิม (DAN ยังอยู่บนสุดถ้าไม่มียอด)
        list.sort((a, b) => {
          const va = a.balance * (a.priceUsd ?? 0);
          const vb = b.balance * (b.priceUsd ?? 0);
          if (vb !== va) return vb - va;
          return 0;
        });

        setTokens(list);
        setState("ok");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [address]);

  return { tokens, state };
}
