import { NextResponse } from "next/server";

// Explorer — รวมสถิติเครือข่าย + บล็อกล่าสุด + ธุรกรรมล่าสุด จาก dannyscan (Blockscout)
export const revalidate = 10;

const BASE = "https://dannyscan.com/api/v2";

function short(a: string): string {
  return a && a.length >= 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || "";
}
function toDan(weiHexOrDec: string | null): number {
  if (!weiHexOrDec) return 0;
  try {
    return Number(BigInt(weiHexOrDec)) / 1e18;
  } catch {
    return Number(weiHexOrDec) / 1e18 || 0;
  }
}

export async function GET() {
  try {
    const opts = { headers: { Accept: "application/json" }, next: { revalidate } };
    const [statsRes, blocksRes, txRes] = await Promise.all([
      fetch(`${BASE}/stats`, opts),
      fetch(`${BASE}/blocks`, opts),
      fetch(`${BASE}/main-page/transactions`, opts),
    ]);

    const stats = statsRes.ok ? await statsRes.json() : {};
    const blocksJson = blocksRes.ok ? await blocksRes.json() : { items: [] };
    const txJson = txRes.ok ? await txRes.json() : [];

    const blocks = (blocksJson.items || []).slice(0, 8).map((b: any) => ({
      height: b.height,
      txCount: b.tx_count ?? b.txn ?? 0,
      miner: short(b.miner?.hash || ""),
      timestamp: Date.parse(b.timestamp) || Date.now(),
      gasUsedPct: Number(b.gas_used_percentage) || 0,
    }));

    const txs = (Array.isArray(txJson) ? txJson : txJson.items || [])
      .slice(0, 8)
      .map((t: any) => ({
        hash: t.hash,
        hashShort: short(t.hash),
        from: short(t.from?.hash || ""),
        to: short(t.to?.hash || ""),
        valueDan: toDan(t.value),
        method: t.method || null,
        status: t.status === "ok" ? "ok" : t.status === "error" ? "error" : "pending",
        timestamp: Date.parse(t.timestamp) || Date.now(),
      }));

    return NextResponse.json({
      chainId: 5069,
      source: "dannyscan.com (Blockscout)",
      stats: {
        totalBlocks: Number(stats.total_blocks) || blocks[0]?.height || 0,
        totalTransactions: Number(stats.total_transactions) || 0,
        totalAddresses: Number(stats.total_addresses) || 0,
        txToday: Number(stats.transactions_today) || 0,
        avgBlockTimeSec: (Number(stats.average_block_time) || 0) / 1000,
        gasPrice: stats.gas_prices?.average ?? null,
        utilizationPct: (Number(stats.network_utilization_percentage) || 0),
      },
      blocks,
      txs,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fetch ล้มเหลว", blocks: [], txs: [] },
      { status: 500 }
    );
  }
}
