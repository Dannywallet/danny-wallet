import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { fetchDandexPrices } from "@/lib/wallet/dandex-prices";
import { fetchDannyLogos } from "@/lib/wallet/danny-prices";

// อ่านไฟล์ logo override ใน data/ (runtime volume)
async function readLogoFile(name: string): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "data", name), "utf8");
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}
// dandex-logos.json = sync อัตโนมัติจาก dandex.io (cron) · approved-logos.json = override โดยแอดมิน (ทับสุด)
const readDandexLogos = () => readLogoFile("dandex-logos.json");
const readApprovedLogos = () => readLogoFile("approved-logos.json");

// Proxy ฝั่งเซิร์ฟเวอร์ — ดึงรายชื่อ token จริงบน Danny Chain (5069) ผ่าน Blockscout API
// + ราคาจริงจาก dancharts (DEX analytics) merge ตาม contract address
// เลี่ยงปัญหา CORS และ normalize ให้ฝั่ง client ใช้ง่าย
const BLOCKSCOUT = "https://dannyscan.com/api/v2/tokens";
const DANCHARTS = "https://dexchart.dancharts.com/pair/history/list";

export const revalidate = 60; // cache 60 วินาที

// Blockscout คืน 50 รายการ/หน้า และเรียงตาม market cap/holders — หน้าแรกถูก DAN-LP กินไปกว่าครึ่ง
// ทำให้เหรียญจริงที่ holders น้อย (ME, MEME, FZ, LFC, YUT ฯลฯ) ตกไปหน้า 2 แล้วหายจากลิสต์
// → ต้องไล่ตาม next_page_params ให้ครบ (จำกัดจำนวนหน้ากันลูปยาว)
const MAX_PAGES = 5;

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

type TokenPage = { items?: RawToken[]; next_page_params?: Record<string, unknown> | null };

/** ดึงรายชื่อ token ทุกหน้าจาก Blockscout (dedupe ตาม address) */
async function fetchAllTokens(): Promise<{
  items: RawToken[];
  status: number; // 200 = ได้ข้อมูล, อื่น ๆ = หน้าแรกล้มเหลว
  pages: number;
  truncated: boolean; // true = ยังมีหน้าถัดไปแต่ชน MAX_PAGES
}> {
  const byAddr = new Map<string, RawToken>();
  let next: Record<string, unknown> | null = null;
  let pages = 0;

  while (pages < MAX_PAGES) {
    const qs = next
      ? "?" +
        new URLSearchParams(
          Object.entries(next).map(([k, v]) => [k, v == null ? "" : String(v)])
        ).toString()
      : "";
    const res = await fetch(BLOCKSCOUT + qs, {
      headers: { Accept: "application/json" },
      next: { revalidate },
    });
    // หน้าแรกล้มเหลว = ไม่มีข้อมูลเลย → รายงาน error; หน้าถัด ๆ ล้มเหลว = ใช้เท่าที่ได้
    if (!res.ok) {
      if (pages === 0) return { items: [], status: res.status, pages: 0, truncated: false };
      break;
    }
    const j = (await res.json()) as TokenPage;
    for (const t of j.items || []) {
      const k = (t.address || "").toLowerCase();
      if (k && !byAddr.has(k)) byAddr.set(k, t);
    }
    pages++;
    next = j.next_page_params ?? null;
    if (!next) break;
  }

  return { items: [...byAddr.values()], status: 200, pages, truncated: !!next };
}

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
    const [page, priceMap, logoMap, dandexLogos, approvedLogos] = await Promise.all([
      fetchAllTokens(),
      fetchPrices(),
      fetchDannyLogos(),
      readDandexLogos(),
      readApprovedLogos(),
    ]);
    // ลำดับความสำคัญ: static/dancharts < dandex-sync (cron) < approved (แอดมิน)
    for (const [addr, url] of Object.entries(dandexLogos)) logoMap.set(addr.toLowerCase(), url);
    for (const [addr, url] of Object.entries(approvedLogos)) logoMap.set(addr.toLowerCase(), url);
    if (page.status !== 200) {
      return NextResponse.json(
        { error: `explorer ตอบกลับ ${page.status}`, tokens: [] },
        { status: 502 }
      );
    }
    const data = { items: page.items };
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
        const supply = toUnits(t.total_supply, decimals);
        const dc = priceMap.get(addrL); // dancharts (สำหรับ %24ชม., วอลุ่ม, mcap)
        const onchain = dandex.prices.get(addrL); // dandex on-chain (ราคาหลัก)
        let priceUsd = onchain ?? dc?.priceUsd ?? (t.exchange_rate ? Number(t.exchange_rate) : null);
        // กันราคา off-chain (dancharts) ที่เพี้ยนจนมูลค่าตลาดเป็นไปไม่ได้ (พูลถูกทิ้ง/ปั่น) — เช่น AOS/DS
        if (onchain == null && priceUsd != null && supply > 0 && priceUsd * supply > 1e11) priceUsd = null;
        const mcapRaw = dc?.mcap ?? (t.circulating_market_cap ? Number(t.circulating_market_cap) : null);
        const marketCap = mcapRaw != null && mcapRaw <= 1e11 ? mcapRaw : (priceUsd != null && supply > 0 ? priceUsd * supply : null);
        return {
          address: t.address,
          name: t.name?.trim() || "Unknown",
          symbol: t.symbol?.trim() || "?",
          decimals,
          holders: Number(t.holders ?? "0") || 0,
          totalSupply: supply,
          priceUsd,
          change24h: dandex.change24h.get(addrL) ?? dc?.change24h ?? null,
          vol24hUSD: dc?.vol24hUSD ?? null,
          marketCap,
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
      scanned: page.items.length, // จำนวน token ทั้งหมดที่อ่านมาก่อนกรอง LP/hidden
      pages: page.pages,
      truncated: page.truncated, // true = ยังมีหน้าถัดไปที่ไม่ได้อ่าน (ชน MAX_PAGES)
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
