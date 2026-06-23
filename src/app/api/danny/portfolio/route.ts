import { NextResponse } from "next/server";
import { fetchDannyPrices, nativeDanPrice, fetchDannyLogos, WDAN } from "@/lib/wallet/danny-prices";
import { fetchDandexPrices } from "@/lib/wallet/dandex-prices";

// พอร์ตจริงของที่อยู่บน Danny Chain (5069):
// ยอดถือครองจริง (Blockscout) × ราคาจริง (dancharts) = มูลค่า USD
export const revalidate = 30;

const RPC = "https://rpc.dannyscan.com";
const BALANCES = (a: string) => `https://dannyscan.com/api/v2/addresses/${a}/token-balances`;

// LP / token ที่ซ่อน (lowercase)
const HIDDEN = new Set<string>(["0x984da6101dc51cf2d18ba389610db339b96e936a"]);
const isLp = (sym: string, name: string) =>
  /(^|[-_ ])lp$/i.test(sym) || /\blp\b/i.test(name) || /liquidity/i.test(name);

// เหรียญสแปม/หลอกลวง — ชื่อ/สัญลักษณ์มักมี URL, โดเมน, คำเชิญชวน หรืออิโมจิ
const SCAM_RE =
  /(https?:\/\/|www\.|t\.me|\btelegram\b|\.(?:com|io|org|net|xyz|app|fi|finance|site|click|vip|win|top|fun|pro|life|live|cc|info|ru|gift|cash|claim)\b|\bclaim\b|\bairdrop\b|\breward(?:s)?\b|\bvoucher\b|\bgiveaway\b|\bbonus\b|\bpresale\b|\bwhitelist\b|\bmint\b|\bvisit\b|\bfree\b|\baccess\b|\bunlock\b|\$\s?\d|🎁|🪂|💰|🎉|💵|🤑|👉|✅|→)/i;
const isScamName = (sym: string, name: string) => SCAM_RE.test(sym) || SCAM_RE.test(name);

export type Holding = {
  address: string | null; // null = native DAN
  symbol: string;
  name: string;
  balance: number;
  priceUsd: number | null;
  valueUsd: number | null;
  change24h: number | null;
  logo: string | null; // โลโก้จาก dandex (ถ้ามี)
  isNative?: boolean;
  spam?: boolean; // เหรียญสแปม/พูลฝุ่น (ซ่อนเป็นค่าเริ่มต้น, ไม่นับรวมยอด)
};

function units(value: string | null, decimals: number): number {
  if (!value) return 0;
  try {
    const neg = value.startsWith("-");
    const v = Number(BigInt(neg ? value.slice(1) : value)) / Math.pow(10, decimals);
    return neg ? -v : v;
  } catch {
    return Number(value) / Math.pow(10, decimals) || 0;
  }
}

export async function GET(req: Request) {
  const address = (new URL(req.url).searchParams.get("address") || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "address ไม่ถูกต้อง", holdings: [] }, { status: 400 });
  }

  try {
    const [balRes, nativeRes, prices, logoMap] = await Promise.all([
      fetch(BALANCES(address), { headers: { Accept: "application/json" }, next: { revalidate } }),
      fetch(RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBalance", params: [address, "latest"], id: 1 }),
        next: { revalidate },
      }),
      fetchDannyPrices(revalidate),
      fetchDannyLogos(),
    ]);

    const holdings: Holding[] = [];

    // รวมรายการ ERC-20 ที่ถือจริง (กรอง LP/hidden/ยอด 0)
    const balances = balRes.ok ? ((await balRes.json()) as any[]) : [];
    const owned = (balances || [])
      .map((b) => {
        const tok = b.token || {};
        const decimals = Number(tok.decimals ?? "18") || 18;
        return {
          address: tok.address as string,
          symbol: (tok.symbol || "?").trim(),
          name: (tok.name || "").trim(),
          type: tok.type,
          decimals,
          balance: units(b.value, decimals),
        };
      })
      .filter(
        (t) =>
          t.type === "ERC-20" &&
          t.balance > 0 &&
          !HIDDEN.has((t.address || "").toLowerCase()) &&
          !isLp(t.symbol, t.name)
      );

    // ราคาหลักจาก dandex (on-chain) — รวม WDAN เพื่อตีราคา native DAN
    const dandex = await fetchDandexPrices(
      [...owned.map((t) => ({ address: t.address, decimals: t.decimals })), { address: WDAN, decimals: 18 }],
      revalidate
    );
    const danPrice = dandex.wdanUsd ?? nativeDanPrice(prices);

    // 1) native DAN
    try {
      const nj = (await nativeRes.json()) as { result?: string };
      const wei = nj.result ? BigInt(nj.result) : BigInt(0);
      const danBal = Number(wei) / 1e18;
      if (danBal > 0) {
        holdings.push({
          address: null,
          symbol: "DAN",
          name: "Danny",
          balance: danBal,
          priceUsd: danPrice,
          valueUsd: danPrice != null ? danBal * danPrice : null,
          change24h: dandex.change24h.get(WDAN.toLowerCase()) ?? prices.get(WDAN.toLowerCase())?.change24h ?? null,
          logo: logoMap.get(WDAN.toLowerCase()) ?? null,
          isNative: true,
          spam: false,
        });
      }
    } catch {
      /* skip native */
    }

    // 2) ERC-20 balances — ติด flag สแปม (ไม่มีราคาตลาดจริง/พูลฝุ่น หรือชื่อเข้าข่ายหลอกลวง)
    //    เก็บไว้ในรายการแต่ flag ไว้ ฝั่ง UI เลือกซ่อน/แสดงเองได้ และไม่นับรวมยอด
    for (const t of owned) {
      const addrL = (t.address || "").toLowerCase();
      const price = dandex.prices.get(addrL) ?? prices.get(addrL)?.priceUsd ?? null;
      const spam = price == null || isScamName(t.symbol, t.name);
      holdings.push({
        address: t.address,
        symbol: t.symbol,
        name: t.name || t.symbol,
        balance: t.balance,
        priceUsd: price,
        valueUsd: price != null ? t.balance * price : null,
        change24h: dandex.change24h.get(addrL) ?? prices.get(addrL)?.change24h ?? null,
        logo: logoMap.get(addrL) ?? null,
        spam,
      });
    }

    // เรียง: เหรียญปกติก่อน (มูลค่าสูงสุด) → เหรียญสแปมไว้ท้ายสุด
    holdings.sort((a, b) => {
      if (!!a.spam !== !!b.spam) return a.spam ? 1 : -1;
      return (b.valueUsd ?? 0) - (a.valueUsd ?? 0) || b.balance - a.balance;
    });

    // ยอดรวม/%เปลี่ยนแปลง คิดเฉพาะเหรียญที่ไม่ใช่สแปม
    const real = holdings.filter((h) => !h.spam);
    const totalUsd = real.reduce((s, h) => s + (h.valueUsd ?? 0), 0);
    const change24h =
      totalUsd > 0
        ? real.reduce((s, h) => s + (h.valueUsd ?? 0) * ((h.change24h ?? 0) / 100), 0) / totalUsd * 100
        : 0;

    return NextResponse.json({
      chainId: 5069,
      source: "dannyscan (ยอด) + dandex on-chain (ราคา)",
      address,
      totalUsd,
      change24h,
      pricedCount: real.filter((h) => h.priceUsd != null).length,
      count: real.length, // จำนวนเหรียญปกติ (ไม่รวมสแปม)
      hiddenCount: holdings.length - real.length, // จำนวนเหรียญสแปมที่ซ่อน
      holdings,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fetch ล้มเหลว", holdings: [] },
      { status: 500 }
    );
  }
}
