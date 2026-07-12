import { NextResponse } from "next/server";
import { Contract, JsonRpcProvider } from "ethers";

// กราฟราคาย้อนหลัง ~24 ชม. — ดึง Sync event ของ pool บนเชนมาคำนวณราคาเอง (วาดในธีมเรา)
export const revalidate = 60;

const RPC = "https://rpc.dannyscan.com";
const DANCHARTS_ALL = "https://dexchart.dancharts.com/pair/history/all";
const SYNC_TOPIC = "0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1";
const USDT = "0xb9bfa68b6774612e66eb693c7a0d00b2eb6bcdee";
const WDAN = "0xbee33b6b1c3df2c4468510e87d6330daa5709f3e";
const FACTORY = "0x15acc1512ef2826d474a3ff9a8980eb9ce1471b9"; // dandex factory (UniswapV2)
const ZERO = "0x0000000000000000000000000000000000000000";
const CHUNK = 5000; // ลิมิต getLogs ของ RPC

type PoolMeta = { pair: string; depIs0: boolean; depDec: number; quoteDec: number; quoteIsUsdt: boolean };

// resolve pool + metadata จาก factory on-chain (สำหรับ token ที่ไม่อยู่บน dancharts เช่น GMX/SDC)
// — หา pair กับ USDT ก่อน แล้วค่อย WDAN, เลือกอันที่มีสภาพคล่อง
async function resolvePoolOnchain(opts: { token: string | null; pair: string | null }): Promise<PoolMeta | null> {
  const provider = new JsonRpcProvider(RPC, 5069);
  const pairAbi = [
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function getReserves() view returns (uint112,uint112,uint32)",
  ];
  const ercAbi = ["function decimals() view returns (uint8)"];

  async function build(pairAddr: string, token: string, base: string): Promise<PoolMeta | null> {
    const c = new Contract(pairAddr, pairAbi, provider);
    let r0: bigint, r1: bigint;
    try { const rr = await c.getReserves(); r0 = rr[0]; r1 = rr[1]; } catch { return null; }
    if (r0 === 0n || r1 === 0n) return null;
    const t0 = (await c.token0()).toLowerCase();
    const depIs0 = t0 === token;
    const depDec = Number(await new Contract(token, ercAbi, provider).decimals());
    const quoteDec = Number(await new Contract(base, ercAbi, provider).decimals());
    return { pair: pairAddr.toLowerCase(), depIs0, depDec, quoteDec, quoteIsUsdt: base === USDT };
  }

  if (opts.token) {
    const factory = new Contract(FACTORY, ["function getPair(address,address) view returns (address)"], provider);
    for (const base of [USDT, WDAN]) {
      if (opts.token === base) continue;
      let pairAddr: string;
      try { pairAddr = (await factory.getPair(opts.token, base)).toLowerCase(); } catch { continue; }
      if (!pairAddr || pairAddr === ZERO) continue;
      const built = await build(pairAddr, opts.token, base);
      if (built) return built;
    }
    return null;
  }
  if (opts.pair) {
    // มีแต่ pair (ไม่อยู่ dancharts) → อ่าน token0/token1 หา base เพื่อกำหนดฝั่ง dep
    const c = new Contract(opts.pair, pairAbi, provider);
    let t0: string, t1: string;
    try { t0 = (await c.token0()).toLowerCase(); t1 = (await c.token1()).toLowerCase(); } catch { return null; }
    const base = [USDT, WDAN].find((b) => b === t0 || b === t1);
    if (!base) return null;
    const token = base === t0 ? t1 : t0;
    return build(opts.pair, token, base);
  }
  return null;
}
const BLOCK_SEC = 2;
// ช่วงเวลา → จำนวนบล็อก (~2 วิ/บล็อก) + จำนวนจุดเป้าหมายหลัง downsample
const RANGES: Record<string, { blocks: number; target: number }> = {
  "1h": { blocks: 1800, target: 60 },
  "24h": { blocks: 43200, target: 90 },
  "7d": { blocks: 302400, target: 140 },
};

async function rpc(method: string, params: any[], rv: number): Promise<any> {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    next: { revalidate: rv },
  });
  return (await r.json()).result;
}

// รัน async ทีละชุด (จำกัด concurrency) กัน RPC ล้มตอนช่วง 7 วัน (chunk เยอะ)
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const pairParam = (url.searchParams.get("pair") || "").trim().toLowerCase();
  const tokenParam = (url.searchParams.get("token") || "").trim().toLowerCase();
  const rangeKey = (url.searchParams.get("range") || "24h").toLowerCase();
  const range = RANGES[rangeKey] ?? RANGES["24h"];
  const hasPair = /^0x[a-f0-9]{40}$/.test(pairParam);
  const hasToken = /^0x[a-f0-9]{40}$/.test(tokenParam);
  if (!hasPair && !hasToken) {
    return NextResponse.json({ error: "ต้องระบุ pair หรือ token", points: [] }, { status: 400 });
  }

  try {
    // 1) metadata ของคู่เทรด + ราคา WDAN จาก dancharts
    const meta = await fetch(DANCHARTS_ALL, { headers: { Accept: "application/json" }, next: { revalidate } })
      .then((r) => r.json())
      .then((j) => (j?.success?.data || []) as any[]);
    const wdanUsd = meta.find((e) => (e.dependantToken || "").toLowerCase() === WDAN)?.value ?? null;

    // หา metadata ของ pool: dancharts ก่อน (มี pair ตรง) → ถ้าไม่มีก็ resolve เองจาก factory on-chain
    let pair: string, depIs0: boolean, depDec: number, quoteDec: number, quoteIsUsdt: boolean;
    const entry = hasPair ? meta.find((e) => (e.pair || "").toLowerCase() === pairParam) : undefined;
    if (entry) {
      const dep = (entry.dependantToken || "").toLowerCase();
      const quote = (entry.mainToken || "").toLowerCase();
      pair = pairParam;
      depIs0 = (entry.token0?.contract || "").toLowerCase() === dep;
      depDec = Number((depIs0 ? entry.token0 : entry.token1)?.decimals ?? 18);
      quoteDec = Number((depIs0 ? entry.token1 : entry.token0)?.decimals ?? 18);
      quoteIsUsdt = quote === USDT;
    } else {
      const resolved = await resolvePoolOnchain({ token: hasToken ? tokenParam : null, pair: hasPair ? pairParam : null });
      if (!resolved) return NextResponse.json({ error: "ไม่พบคู่เทรด/สภาพคล่อง", points: [] }, { status: 404 });
      ({ pair, depIs0, depDec, quoteDec, quoteIsUsdt } = resolved);
    }

    // 2) ช่วงบล็อก + เวลาปัจจุบัน
    const curHex = await rpc("eth_blockNumber", [], revalidate);
    const cur = parseInt(curHex, 16);
    const latest = await rpc("eth_getBlockByNumber", [curHex, false], revalidate);
    const curTs = parseInt(latest.timestamp, 16) * 1000;
    const fromBlock = Math.max(1, cur - range.blocks);

    // 3) ดึง Sync events เป็นช่วง ๆ (จำกัด concurrency 8 กัน RPC ล้มช่วง 7 วัน)
    const ranges: [number, number][] = [];
    for (let b = fromBlock; b <= cur; b += CHUNK) ranges.push([b, Math.min(b + CHUNK - 1, cur)]);
    const logsArr = await mapLimit(ranges, 8, ([f, t]) =>
      rpc("eth_getLogs", [{ address: pair, topics: [SYNC_TOPIC], fromBlock: "0x" + f.toString(16), toBlock: "0x" + t.toString(16) }], revalidate)
        .catch(() => [])
    );

    // 4) คำนวณราคาต่อ event + ประมาณเวลา
    type Pt = { t: number; p: number };
    let points: Pt[] = [];
    for (const logs of logsArr) {
      for (const log of logs || []) {
        const d = (log.data || "0x").slice(2);
        if (d.length < 128) continue;
        const r0 = Number(BigInt("0x" + d.slice(0, 64)));
        const r1 = Number(BigInt("0x" + d.slice(64, 128)));
        const rDep = depIs0 ? r0 : r1;
        const rQuote = depIs0 ? r1 : r0;
        const depAmt = rDep / 10 ** depDec;
        const quoteAmt = rQuote / 10 ** quoteDec;
        if (depAmt <= 0) continue;
        let price = quoteAmt / depAmt; // ราคา dep ในหน่วย quote
        if (!quoteIsUsdt) {
          if (!wdanUsd) continue;
          price = price * wdanUsd; // quote เป็น WDAN → แปลงเป็น USD
        }
        const blk = parseInt(log.blockNumber, 16);
        const t = curTs - (cur - blk) * BLOCK_SEC * 1000;
        if (Number.isFinite(price) && price > 0) points.push({ t, p: price });
      }
    }

    points.sort((a, b) => a.t - b.t);
    // downsample ตามช่วงเวลา
    if (points.length > range.target) {
      const step = Math.ceil(points.length / range.target);
      points = points.filter((_, i) => i % step === 0 || i === points.length - 1);
    }

    const first = points[0]?.p ?? null;
    const last = points[points.length - 1]?.p ?? null;
    const change = first && last ? ((last - first) / first) * 100 : null;

    return NextResponse.json({
      pair,
      range: rangeKey,
      source: "on-chain Sync events (dannyscan RPC)",
      count: points.length,
      change24h: change,
      points,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "fetch ล้มเหลว", points: [] }, { status: 500 });
  }
}
