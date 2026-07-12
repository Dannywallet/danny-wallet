import { NextResponse } from "next/server";
import { Contract, JsonRpcProvider } from "ethers";

// 24h volume (USD) ของ token — คำนวณจาก Swap events on-chain ของ pool บน dandex
// ใช้เป็น fallback สำหรับเหรียญที่ไม่อยู่บน dancharts (dancharts ไม่มีวอลุ่มให้ดึง)
export const revalidate = 60;

const RPC = "https://rpc.dannyscan.com";
const DANCHARTS_ALL = "https://dexchart.dancharts.com/pair/history/all";
const SWAP_TOPIC = "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";
const USDT = "0xb9bfa68b6774612e66eb693c7a0d00b2eb6bcdee";
const WDAN = "0xbee33b6b1c3df2c4468510e87d6330daa5709f3e";
const FACTORY = "0x15acc1512ef2826d474a3ff9a8980eb9ce1471b9";
const ZERO = "0x0000000000000000000000000000000000000000";
const CHUNK = 5000;
const BLOCKS_24H = 43200; // ~2 วิ/บล็อก

async function rpc(method: string, params: any[], rv: number): Promise<any> {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    next: { revalidate: rv },
  });
  return (await r.json()).result;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const ret: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      ret[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, worker));
  return ret;
}

// หา pool (USDT ก่อน แล้ว WDAN) + ฝั่ง quote/decimals จาก factory on-chain
async function resolvePool(token: string) {
  const provider = new JsonRpcProvider(RPC, 5069);
  const factory = new Contract(FACTORY, ["function getPair(address,address) view returns (address)"], provider);
  const pairAbi = [
    "function token0() view returns (address)",
    "function getReserves() view returns (uint112,uint112,uint32)",
  ];
  const ercAbi = ["function decimals() view returns (uint8)"];
  for (const base of [USDT, WDAN]) {
    if (token === base) continue;
    let pair: string;
    try { pair = (await factory.getPair(token, base)).toLowerCase(); } catch { continue; }
    if (!pair || pair === ZERO) continue;
    const c = new Contract(pair, pairAbi, provider);
    let r0: bigint, r1: bigint;
    try { const rr = await c.getReserves(); r0 = rr[0]; r1 = rr[1]; } catch { continue; }
    if (r0 === 0n || r1 === 0n) continue;
    const t0 = (await c.token0()).toLowerCase();
    const quoteIs0 = t0 === base;
    const quoteDec = Number(await new Contract(base, ercAbi, provider).decimals());
    return { pair, base, quoteIs0, quoteDec, quoteIsUsdt: base === USDT };
  }
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = (url.searchParams.get("token") || "").trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(token)) {
    return NextResponse.json({ error: "token ไม่ถูกต้อง", vol24hUSD: null }, { status: 400 });
  }

  try {
    const pool = await resolvePool(token);
    if (!pool) return NextResponse.json({ vol24hUSD: null, source: "no-pool" });

    // ราคา WDAN (USD) จาก dancharts — ใช้แปลงเฉพาะ pool ที่ quote เป็น WDAN
    let wdanUsd: number | null = null;
    if (!pool.quoteIsUsdt) {
      wdanUsd = await fetch(DANCHARTS_ALL, { headers: { Accept: "application/json" }, next: { revalidate } })
        .then((r) => r.json())
        .then((j) => (j?.success?.data || []).find((e: any) => (e.dependantToken || "").toLowerCase() === WDAN)?.value ?? null)
        .catch(() => null);
      if (!wdanUsd) return NextResponse.json({ vol24hUSD: null, source: "no-wdan-price" });
    }

    const curHex = await rpc("eth_blockNumber", [], revalidate);
    const cur = parseInt(curHex, 16);
    const from = Math.max(1, cur - BLOCKS_24H);
    const ranges: [number, number][] = [];
    for (let b = from; b <= cur; b += CHUNK) ranges.push([b, Math.min(b + CHUNK - 1, cur)]);

    const logsArr = await mapLimit(ranges, 8, ([f, t]) =>
      rpc("eth_getLogs", [{ address: pool.pair, topics: [SWAP_TOPIC], fromBlock: "0x" + f.toString(16), toBlock: "0x" + t.toString(16) }], revalidate)
        .catch(() => [])
    );

    let volQuote = 0;
    let swaps = 0;
    for (const logs of logsArr) {
      for (const log of logs || []) {
        const d = (log.data || "0x").slice(2);
        if (d.length < 256) continue;
        // Swap(amount0In, amount1In, amount0Out, amount1Out)
        const a = [0, 1, 2, 3].map((i) => Number(BigInt("0x" + d.slice(i * 64, i * 64 + 64))));
        const qIn = pool.quoteIs0 ? a[0] : a[1];
        const qOut = pool.quoteIs0 ? a[2] : a[3];
        volQuote += (qIn + qOut) / 10 ** pool.quoteDec;
        swaps++;
      }
    }
    const vol24hUSD = pool.quoteIsUsdt ? volQuote : volQuote * (wdanUsd as number);

    return NextResponse.json({
      token,
      pair: pool.pair,
      vol24hUSD,
      swaps,
      source: "on-chain Swap events (dannyscan RPC)",
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "fetch ล้มเหลว", vol24hUSD: null }, { status: 500 });
  }
}
