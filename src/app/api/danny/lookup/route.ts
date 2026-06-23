import { NextResponse } from "next/server";

// ค้นหาในแอป: ตรวจชนิด (ธุรกรรม/บล็อก/ที่อยู่) แล้วดึงรายละเอียดจาก dannyscan
export const revalidate = 5;

const BASE = "https://dannyscan.com/api/v2";

function short(a: string): string {
  return a && a.length >= 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || "";
}
function toDan(v: string | null | undefined): number {
  if (!v) return 0;
  try {
    return Number(BigInt(v)) / 1e18;
  } catch {
    return Number(v) / 1e18 || 0;
  }
}

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ type: "empty" });

  const opts = { headers: { Accept: "application/json" }, next: { revalidate } };

  try {
    // ธุรกรรม
    if (/^0x[a-fA-F0-9]{64}$/.test(q)) {
      const r = await fetch(`${BASE}/transactions/${q}`, opts);
      if (!r.ok) return NextResponse.json({ type: "notfound", q });
      const t = await r.json();
      return NextResponse.json({
        type: "tx",
        hash: t.hash,
        status: t.result === "success" || t.status === "ok" ? "ok" : "error",
        from: t.from?.hash || "",
        to: t.to?.hash || "",
        valueDan: toDan(t.value),
        feeDan: toDan(t.fee?.value),
        block: t.block ?? t.block_number ?? null,
        method: t.method || null,
        timestamp: Date.parse(t.timestamp) || null,
      });
    }

    // ที่อยู่
    if (/^0x[a-fA-F0-9]{40}$/.test(q)) {
      const r = await fetch(`${BASE}/addresses/${q}`, opts);
      if (!r.ok) return NextResponse.json({ type: "notfound", q });
      const a = await r.json();
      return NextResponse.json({
        type: "address",
        address: a.hash || q,
        balanceDan: toDan(a.coin_balance),
        isContract: !!a.is_contract,
        hasTokens: !!a.has_tokens,
        hasTransfers: !!a.has_token_transfers,
      });
    }

    // บล็อก
    if (/^\d+$/.test(q)) {
      const r = await fetch(`${BASE}/blocks/${q}`, opts);
      if (!r.ok) return NextResponse.json({ type: "notfound", q });
      const b = await r.json();
      return NextResponse.json({
        type: "block",
        height: b.height,
        txCount: b.tx_count ?? b.transaction_count ?? 0,
        miner: b.miner?.hash || "",
        minerShort: short(b.miner?.hash || ""),
        gasUsedPct: Number(b.gas_used_percentage) || 0,
        hash: b.hash,
        timestamp: Date.parse(b.timestamp) || null,
      });
    }

    return NextResponse.json({ type: "invalid", q });
  } catch (e) {
    return NextResponse.json({ type: "error", message: e instanceof Error ? e.message : "fetch ล้มเหลว" }, { status: 500 });
  }
}
