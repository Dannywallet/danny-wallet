// ดึงราคา USD จริงของโทเคนบน Danny Chain (5069) จาก dancharts (DEX analytics)
// ใช้ /pair/history/all เพราะมี field `value` = ราคา USD ของ dependantToken (รวม WDAN)
import { DANDEX_TOKEN_LOGOS } from "./dandex-token-logos";

const DANCHARTS_ALL = "https://dexchart.dancharts.com/pair/history/all";

// Wrapped DAN — ใช้เป็นราคาอ้างอิงของเหรียญหลัก DAN (native)
export const WDAN = "0xBEe33b6B1C3df2c4468510E87d6330daA5709F3E";

export type PriceInfo = {
  priceUsd: number;
  change24h: number;
  mcap: number;
  liquidity: number;
};

/** map: contract(lowercase) → ข้อมูลราคา (เลือกคู่ที่ liquidity สูงสุดเมื่อมีหลายคู่) */
export async function fetchDannyPrices(revalidate = 60): Promise<Map<string, PriceInfo>> {
  const map = new Map<string, PriceInfo>();
  try {
    const res = await fetch(DANCHARTS_ALL, {
      headers: { Accept: "application/json" },
      next: { revalidate },
    });
    if (!res.ok) return map;
    const j = (await res.json()) as { success?: { data?: any[] } };
    const pairs = j.success?.data || [];
    for (const p of pairs) {
      const dep = (p.dependantToken || "").toLowerCase();
      const price = typeof p.value === "number" ? p.value : Number(p.value);
      if (!dep || !Number.isFinite(price) || price <= 0) continue;
      const liquidity = Number(p.mainReserveValue) || 0;
      const prev = map.get(dep);
      if (prev && prev.liquidity >= liquidity) continue;
      map.set(dep, {
        priceUsd: price,
        change24h: Number(p.change24h) || 0,
        mcap: Number(p.mcap) || 0,
        liquidity,
      });
    }
  } catch {
    /* map ว่าง = ไม่มีราคา */
  }
  return map;
}

/** ราคา USD ของเหรียญหลัก DAN (= ราคา WDAN) */
export function nativeDanPrice(map: Map<string, PriceInfo>): number | null {
  return map.get(WDAN.toLowerCase())?.priceUsd ?? null;
}

const DANCHARTS_LIST = "https://dexchart.dancharts.com/pair/history/list";

/**
 * map: contract(lowercase) → URL โลโก้ token
 * รวม 2 แหล่ง: token list ของ dandex (static, ครบกว่า) + dancharts (live, เผื่อ token ใหม่)
 */
export async function fetchDannyLogos(revalidate = 300): Promise<Map<string, string>> {
  const logos = new Map<string, string>();
  // 1) static จาก token list ของ dandex (ครอบคลุม token ที่ listed ทั้งหมด)
  for (const [addr, url] of Object.entries(DANDEX_TOKEN_LOGOS)) logos.set(addr, url);
  // 2) live จาก dancharts (เผื่อมี token เพิ่มที่ยังไม่อยู่ใน list)
  try {
    const res = await fetch(DANCHARTS_LIST, {
      headers: { Accept: "application/json" },
      next: { revalidate },
    });
    if (res.ok) {
      const j = (await res.json()) as { success?: { data?: { data?: any[] } } };
      const pairs = j.success?.data?.data || [];
      for (const p of pairs) {
        for (const tk of [p.token0, p.token1]) {
          const addr = (tk?.contract || "").toLowerCase();
          if (addr && tk?.logo && !logos.has(addr)) logos.set(addr, tk.logo);
        }
      }
    }
  } catch {
    /* ใช้ static อย่างเดียว */
  }
  return logos;
}
