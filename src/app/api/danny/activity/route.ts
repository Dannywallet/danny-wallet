import { NextResponse } from "next/server";
import type { Tx } from "@/lib/wallet/mock-data";
import { fetchDannyPrices, nativeDanPrice } from "@/lib/wallet/danny-prices";

// ดึงธุรกรรมจริง (token transfers + native DAN) ของที่อยู่บน Danny Chain 5069
// พร้อมมูลค่า USD จากราคา dancharts
export const revalidate = 30;

const BASE = "https://dannyscan.com/api/v2/addresses";

type RawTransfer = {
  from: { hash: string };
  to: { hash: string };
  token: { symbol: string | null; decimals: string | null; address: string | null };
  total: { value: string | null; decimals?: string | null };
  timestamp: string;
  tx_hash: string;
  type: string;
  method: string | null;
};

type RawTx = {
  from: { hash: string } | null;
  to: { hash: string } | null;
  value: string | null;
  timestamp: string;
  hash: string;
  status: string | null; // "ok" | "error"
};

function short(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function amount(value: string | null, decimals: string | null): number {
  if (!value) return 0;
  const d = Number(decimals ?? "18") || 18;
  try {
    const v = Number(value) / Math.pow(10, d);
    return v;
  } catch {
    return 0;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const address = (url.searchParams.get("address") || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "address ไม่ถูกต้อง", txs: [] }, { status: 400 });
  }

  try {
    const opts = { headers: { Accept: "application/json" }, next: { revalidate } };
    // ดึงพร้อมกัน: token transfers + ธุรกรรม native (DAN)
    const [transferRes, txRes, prices] = await Promise.all([
      fetch(`${BASE}/${address}/token-transfers`, opts),
      fetch(`${BASE}/${address}/transactions`, opts),
      fetchDannyPrices(revalidate),
    ]);
    const danPrice = nativeDanPrice(prices);
    if (!transferRes.ok && !txRes.ok) {
      return NextResponse.json(
        { error: `explorer ตอบกลับ ${transferRes.status}/${txRes.status}`, txs: [] },
        { status: 502 }
      );
    }
    const lower = address.toLowerCase();

    // 1) token transfers (ERC-20)
    const transferData = transferRes.ok
      ? ((await transferRes.json()) as { items: RawTransfer[] })
      : { items: [] };
    const tokenTxs: Tx[] = (transferData.items || [])
      .filter((t) => t.type === "token_transfer" && t.token?.symbol)
      .map((t, i) => {
        const isOut = t.from?.hash?.toLowerCase() === lower;
        const amt = amount(t.total?.value, t.token?.decimals ?? t.total?.decimals ?? null);
        const price = prices.get((t.token?.address || "").toLowerCase())?.priceUsd ?? null;
        return {
          id: `${t.tx_hash}-tt${i}`,
          type: isOut ? "send" : "receive",
          token: t.token.symbol || "?",
          amount: amt,
          valueUsd: price != null ? amt * price : null,
          counterparty: short((isOut ? t.to?.hash : t.from?.hash) || ""),
          timestamp: Date.parse(t.timestamp) || Date.now(),
          status: "confirmed",
        } satisfies Tx;
      });

    // 2) native DAN — เฉพาะรายการที่มีการโอนมูลค่าจริง (value > 0)
    const txData = txRes.ok ? ((await txRes.json()) as { items: RawTx[] }) : { items: [] };
    const nativeTxs: Tx[] = (txData.items || [])
      .filter((t) => t.value && t.value !== "0")
      .map((t, i) => {
        const isOut = t.from?.hash?.toLowerCase() === lower;
        const amt = amount(t.value, "18");
        return {
          id: `${t.hash}-nt${i}`,
          type: isOut ? "send" : "receive",
          token: "DAN",
          amount: amt,
          valueUsd: danPrice != null ? amt * danPrice : null,
          counterparty: short((isOut ? t.to?.hash : t.from?.hash) || ""),
          timestamp: Date.parse(t.timestamp) || Date.now(),
          status: t.status === "ok" ? "confirmed" : "failed",
        } satisfies Tx;
      });

    // รวม + เรียงใหม่ตามเวลา
    const txs = [...tokenTxs, ...nativeTxs].sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json({
      chainId: 5069,
      source: "dannyscan.com (Blockscout)",
      address,
      count: txs.length,
      nativeCount: nativeTxs.length,
      tokenCount: tokenTxs.length,
      fetchedAt: new Date().toISOString(),
      txs,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fetch ล้มเหลว", txs: [] },
      { status: 500 }
    );
  }
}
