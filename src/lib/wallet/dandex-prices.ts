// ดึงราคา USD จาก dandex.io โดยตรง — อ่าน reserves ของ pool บนเชน (on-chain) ผ่าน RPC
// แหล่งราคาจริงที่สุด เพราะคำนวณจาก liquidity pool ของ DEX เอง
const RPC = "https://rpc.dannyscan.com";
const FACTORY = "0x15acc1512ef2826d474a3ff9a8980eb9ce1471b9"; // dandex factory (จาก router.factory())
export const WDAN = "0xBEe33b6B1C3df2c4468510E87d6330daA5709F3E"; // Wrapped DAN
const USDT = "0xb9BFa68B6774612e66eB693C7a0D00B2Eb6BCdee"; // Bridge USDT (8 decimals)
const USDT_DEC = 8;
const WDAN_DEC = 18;
const ZERO = "0x0000000000000000000000000000000000000000";

// มูลค่าสภาพคล่องขั้นต่ำฝั่ง WDAN (USD) ที่จะเชื่อราคาจากพูลได้
// พูลที่ถูกทิ้ง/ปั่น (เช่น เหลือ token เพียง 1 wei) จะให้ราคาพุ่งมหาศาลและเชื่อถือไม่ได้
// ต่ำกว่านี้ → ข้าม ให้ fallback ไปใช้ราคาจาก dancharts (ซึ่งเลือกคู่สภาพคล่องสูงสุด)
const MIN_POOL_LIQ_USD = 500;

// selector ของฟังก์ชัน Uniswap V2
const SEL_GET_PAIR = "0xe6a43905"; // factory.getPair(address,address)
const SEL_RESERVES = "0x0902f1ac"; // pair.getReserves()

function pad(addr: string): string {
  return addr.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

async function ethCall(to: string, data: string, revalidate: number): Promise<string> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to, data }, "latest"], id: 1 }),
    next: { revalidate },
  });
  const j = (await res.json()) as { result?: string };
  return j.result || "0x";
}

async function getPair(a: string, b: string, rv: number): Promise<string> {
  const r = await ethCall(FACTORY, SEL_GET_PAIR + pad(a) + pad(b), rv);
  if (!r || r.length < 66) return ZERO;
  return "0x" + r.slice(-40);
}

async function getReserves(pair: string, rv: number): Promise<[bigint, bigint] | null> {
  const r = await ethCall(pair, SEL_RESERVES, rv);
  if (!r || r.length < 130) return null;
  return [BigInt("0x" + r.slice(2, 66)), BigInt("0x" + r.slice(66, 130))];
}

/** token เป็น token0 ของคู่หรือไม่ (Uniswap V2 จัดเรียงตามค่า address) */
function isToken0(token: string, other: string): boolean {
  return token.toLowerCase() < other.toLowerCase();
}

// --- ส่วนคำนวณ %24ชม. แบบ on-chain (จาก Sync event ของ pool) ---
const SYNC_TOPIC = "0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1";
const BLOCKS_24H = 43200; // ~2 วินาที/บล็อก → 24 ชม.
const LOG_WINDOW = 5000; // ช่วงบล็อกย้อนหา Sync event ก่อนจุด 24 ชม. (RPC จำกัด ~5000)

/** ราคาของ base เทียบ quote จาก reserves (decimal-adjusted) */
function priceFromReserves(
  res: [bigint, bigint],
  base: string,
  baseDec: number,
  quote: string,
  quoteDec: number
): number | null {
  const baseIs0 = isToken0(base, quote);
  const [rBase, rQuote] = baseIs0 ? res : [res[1], res[0]];
  const b = Number(rBase) / 10 ** baseDec;
  const q = Number(rQuote) / 10 ** quoteDec;
  return b > 0 ? q / b : null;
}

async function blockNumber(rv: number): Promise<number | null> {
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
      next: { revalidate: rv },
    });
    const j = (await res.json()) as { result?: string };
    return j.result ? parseInt(j.result, 16) : null;
  } catch {
    return null;
  }
}

/** reserves จาก Sync event ล่าสุดในช่วง [from, to] (= ใกล้จุด 24 ชม.ก่อนมากที่สุด) */
async function lastSyncReserves(
  pair: string,
  from: number,
  to: number,
  rv: number
): Promise<[bigint, bigint] | null> {
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getLogs",
        params: [{ address: pair, topics: [SYNC_TOPIC], fromBlock: "0x" + from.toString(16), toBlock: "0x" + to.toString(16) }],
        id: 1,
      }),
      next: { revalidate: rv },
    });
    const j = (await res.json()) as { result?: { data: string }[] };
    const logs = j.result || [];
    if (!logs.length) return null;
    const d = logs[logs.length - 1].data.slice(2);
    return [BigInt("0x" + d.slice(0, 64)), BigInt("0x" + d.slice(64, 128))];
  } catch {
    return null;
  }
}

export type DandexResult = {
  wdanUsd: number | null;
  prices: Map<string, number>; // contract(lowercase) → ราคา USD ปัจจุบัน
  change24h: Map<string, number>; // contract(lowercase) → % เปลี่ยนแปลง 24 ชม. (on-chain)
};

/** ดึงราคา USD ปัจจุบัน + %24ชม. ของชุด token จาก pool ของ dandex บนเชน */
export async function fetchDandexPrices(
  tokens: { address: string; decimals: number }[],
  revalidate = 60
): Promise<DandexResult> {
  const prices = new Map<string, number>();
  const change24h = new Map<string, number>();

  const wdanPair = await getPair(WDAN, USDT, revalidate);
  if (wdanPair === ZERO) return { wdanUsd: null, prices, change24h };
  const wdanRes = await getReserves(wdanPair, revalidate);
  if (!wdanRes) return { wdanUsd: null, prices, change24h };
  const wUsd = priceFromReserves(wdanRes, WDAN, WDAN_DEC, USDT, USDT_DEC);
  if (wUsd == null || wUsd <= 0) return { wdanUsd: null, prices, change24h };

  // USDT คือตัวอ้างอิง USD (≈ $1) — ตั้งราคาตายตัวกันราคาหาย/เพี้ยนจาก RPC ที่แกว่ง
  prices.set(USDT.toLowerCase(), 1);

  // pair address ของแต่ละ token (คู่กับ WDAN)
  const pairs = await Promise.all(
    tokens.map((t) =>
      t.address.toLowerCase() === WDAN.toLowerCase()
        ? Promise.resolve(ZERO)
        : getPair(t.address, WDAN, revalidate).catch(() => ZERO)
    )
  );

  // ราคาปัจจุบันจาก reserves
  await Promise.all(
    tokens.map(async (t, i) => {
      const addrL = t.address.toLowerCase();
      if (addrL === WDAN.toLowerCase()) {
        prices.set(addrL, wUsd);
        return;
      }
      if (pairs[i] === ZERO) return;
      const res = await getReserves(pairs[i], revalidate).catch(() => null);
      if (!res) return;
      // กันพูลสภาพคล่องต่ำ/ถูกทิ้ง: ดูมูลค่าฝั่ง WDAN ของพูลนี้
      // (เช่น พูลที่เหลือ token เพียง 1 wei จะทำให้ราคา = reserveWDAN/reserveToken พุ่งมหาศาล)
      const wdanReserve = Number(isToken0(t.address, WDAN) ? res[1] : res[0]) / 10 ** WDAN_DEC;
      if (wdanReserve * wUsd < MIN_POOL_LIQ_USD) return; // เชื่อถือไม่ได้ → fallback ไป dancharts
      const p = priceFromReserves(res, t.address, t.decimals, WDAN, WDAN_DEC);
      if (p == null || p <= 0) return;
      prices.set(addrL, p * wUsd);
    })
  );

  // %24ชม. แบบ on-chain — best-effort (ถ้าล้มเหลว ปล่อยว่างให้ fallback)
  try {
    const cur = await blockNumber(revalidate);
    if (cur && cur > BLOCKS_24H) {
      const to = cur - BLOCKS_24H;
      const from = Math.max(1, to - LOG_WINDOW);
      // ราคา WDAN เมื่อ 24 ชม.ก่อน
      const wdanResThen = await lastSyncReserves(wdanPair, from, to, revalidate);
      const wUsdThen = wdanResThen
        ? priceFromReserves(wdanResThen, WDAN, WDAN_DEC, USDT, USDT_DEC)
        : null;

      await Promise.all(
        tokens.map(async (t, i) => {
          const addrL = t.address.toLowerCase();
          const now = prices.get(addrL);
          if (now == null) return;
          if (addrL === WDAN.toLowerCase()) {
            if (wUsdThen && wUsdThen > 0) change24h.set(addrL, ((now - wUsdThen) / wUsdThen) * 100);
            return;
          }
          if (pairs[i] === ZERO || !wUsdThen) return;
          const resThen = await lastSyncReserves(pairs[i], from, to, revalidate);
          if (!resThen) return;
          const inWdan = priceFromReserves(resThen, t.address, t.decimals, WDAN, WDAN_DEC);
          if (inWdan == null || inWdan <= 0) return;
          const thenUsd = inWdan * wUsdThen;
          if (thenUsd > 0) change24h.set(addrL, ((now - thenUsd) / thenUsd) * 100);
        })
      );
    }
  } catch {
    /* ปล่อย change24h ว่าง = fallback ไป dancharts */
  }

  return { wdanUsd: wUsd, prices, change24h };
}
