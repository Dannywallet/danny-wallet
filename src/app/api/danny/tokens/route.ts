import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { fetchDandexPrices } from "@/lib/wallet/dandex-prices";
import { fetchDannyLogos } from "@/lib/wallet/danny-prices";

// โลโก้ที่แอดมินอนุมัติผ่านหน้า /wallet/admin/listings (override โลโก้อัตโนมัติ)
async function readApprovedLogos(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "data", "approved-logos.json"), "utf8");
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

// Proxy ฝั่งเซิร์ฟเวอร์ — ดึงรายชื่อ token จริงบน Danny Chain (5069) ผ่าน Blockscout API
// + ราคาจริงจาก dancharts (DEX analytics) merge ตาม contract address
// เลี่ยงปัญหา CORS และ normalize ให้ฝั่ง client ใช้ง่าย
const BLOCKSCOUT = "https://dannyscan.com/api/v2/tokens";
const DANCHARTS = "https://dexchart.dancharts.com/pair/history/list";

export const revalidate = 60; // cache 60 วินาที

type PriceInfo = { priceUsd: number; change24h: number; vol24hUSD: number; mcap: number; pair: string | null };

/** ดึงราคาจาก dancharts → map: contract(lowercase) → ราคา (ใช้ dependantToken ของแต่ละคู่) */
async function fetchPrices(): Promise<Map<string, PriceInfo>> {
  const map = new Map<string, PriceInfo>();
  try {
    const res = await fetch(DANCHARTS, { headers: { Accept: "application/json" }, next: { revalidate } });
    if (!res.ok) return map;
    const j = (await res.json()) as {
      success?: { data?: { data?: any[] } };
    };
    const pairs = j.success?.data?.data || [];
    for (const p of pairs) {
      const dep = (p.dependantToken || "").toLowerCase();
      if (!dep || typeof p.price !== "number") continue;
      // ถ้ามีหลายคู่ของ token เดียวกัน เลือกคู่ที่ liquidity สูงกว่า
      const prev = map.get(dep);
      const liq = Number(p.liquidity) || 0;
      if (prev && (prev as any)._liq >= liq) continue;
      map.set(dep, Object.assign(
        { priceUsd: p.price, change24h: Number(p.change24h) || 0, vol24hUSD: Number(p.vol24hUSD) || 0, mcap: Number(p.mcap) || 0, pair: p.pair || null },
        { _liq: liq }
      ) as PriceInfo);
    }
  } catch {
    /* ปล่อยให้ map ว่าง = ไม่มีราคา */
  }
  return map;
}

// contract ที่ต้องการซ่อนจากรายการ (lowercase)
const HIDDEN = new Set<string>([
  "0x984da6101dc51cf2d18ba389610db339b96e936a", // stDAN (Staked DAN)
]);

type RawToken = {
  address: string;
  name: string | null;
  symbol: string | null;
  decimals: string | null;
  holders: string | null;
  total_supply: string | null;
  exchange_rate: string | null; // ราคา USD ถ้ามี (เชนนี้คืน null)
  circulating_market_cap: string | null;
  volume_24h: string | null;
  type: string | null;
};

export type DannyToken = {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  holders: number;
  totalSupply: number;
  priceUsd: number | null; // null = ยังไม่มีราคาจาก dancharts
  change24h: number | null;
  vol24hUSD: number | null;
  marketCap: number | null;
  logo: string | null; // โลโก้จาก dandex (ถ้ามี)
  pair: string | null; // pair address บน dancharts (สำหรับฝังกราฟ)
  type: string;
};

function toUnits(supply: string | null, decimals: number): number {
  if (!supply) return 0;
  try {
    return Number(BigInt(supply) / BigInt(10) ** BigInt(decimals));
  } catch {
    return 0;
  }
}

export async function GET() {
  try {
    const [res, priceMap, logoMap, approvedLogos] = await Promise.all([
      fetch(BLOCKSCOUT, { headers: { Accept: "application/json" }, next: { revalidate } }),
      fetchPrices(),
      fetchDannyLogos(),
      readApprovedLogos(),
    ]);
    // โลโก้ที่แอดมินอนุมัติ override โลโก้อัตโนมัติ
    for (const [addr, url] of Object.entries(approvedLogos)) logoMap.set(addr.toLowerCase(), url);
    if (!res.ok) {
      return NextResponse.json(
        { error: `explorer ตอบกลับ ${res.status}`, tokens: [] },
        { status: 502 }
      );
    }
    const data = (await res.json()) as { items: RawToken[] };
    // ตัด LP token (liquidity pool ของ DEX) ออก เช่น "DAN-LP"
    const isLp = (t: RawToken) => {
      const sym = (t.symbol || "").trim();
      const name = (t.name || "").trim();
      return /(^|[-_ ])lp$/i.test(sym) || /\blp\b/i.test(name) || /liquidity/i.test(name);
    };
    const filtered = (data.items || []).filter(
      (t) => t.type === "ERC-20" && !isLp(t) && !HIDDEN.has((t.address || "").toLowerCase())
    );

    // ราคาหลักจาก dandex (on-chain pool reserves)
    const dandex = await fetchDandexPrices(
      filtered.map((t) => ({ address: t.address, decimals: Number(t.decimals ?? "18") || 18 })),
      revalidate
    );

    const tokens: DannyToken[] = filtered
      .map((t) => {
        const decimals = Number(t.decimals ?? "18") || 18;
        const addrL = (t.address || "").toLowerCase();
        const dc = priceMap.get(addrL); // dancharts (สำหรับ %24ชม., วอลุ่ม, mcap)
        const onchain = dandex.prices.get(addrL); // dandex on-chain (ราคาหลัก)
        const priceUsd = onchain ?? dc?.priceUsd ?? (t.exchange_rate ? Number(t.exchange_rate) : null);
        return {
          address: t.address,
          name: t.name?.trim() || "Unknown",
          symbol: t.symbol?.trim() || "?",
          decimals,
          holders: Number(t.holders ?? "0") || 0,
          totalSupply: toUnits(t.total_supply, decimals),
          priceUsd,
          change24h: dandex.change24h.get(addrL) ?? dc?.change24h ?? null,
          vol24hUSD: dc?.vol24hUSD ?? null,
          marketCap: dc?.mcap ?? (t.circulating_market_cap ? Number(t.circulating_market_cap) : null),
          logo: logoMap.get(addrL) ?? null,
          pair: dc?.pair ?? null,
          type: t.type ?? "ERC-20",
        };
      })
      // เรียงตามมูลค่าตลาด (ถ้ามีราคา) แล้วค่อยตาม holders
      .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0) || b.holders - a.holders);

    const pricedCount = tokens.filter((t) => t.priceUsd != null).length;

    return NextResponse.json({
      chainId: 5069,
      source: "dannyscan (รายชื่อ) + dandex on-chain (ราคา) + dancharts (24ชม./วอลุ่ม)",
      count: tokens.length,
      pricedCount,
      fetchedAt: new Date().toISOString(),
      tokens,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fetch ล้มเหลว", tokens: [] },
      { status: 500 }
    );
  }
}
