/**
 * ค้นหาบัญชีลูก (BIP44) ที่เคยใช้งานบนเชน — ใช้ตอน import วลีกู้คืน
 *
 * ทำไมต้องมี: ตอน import ระบบสร้างให้แค่บัญชีแรก (index 0) ผู้ใช้ที่เคยกด
 * "เพิ่มบัญชี (จาก seed)" ไว้หลายใบจะไม่เห็นบัญชีเหล่านั้นและนึกว่าเงินหาย
 * ทั้งที่ที่อยู่คำนวณกลับมาจากวลีเดิมได้อยู่แล้ว
 *
 * เกณฑ์ว่า "เคยใช้": explorer ตอบ 200 = ที่อยู่เคยปรากฏบนเชน (รับ/ส่ง/รับโทเคน)
 * ตอบ 404 = ไม่เคยมีธุรกรรมเลย · ถ้า explorer ล่มจะถอยไปถาม RPC (nonce หรือยอดคงเหลือ)
 * ซึ่งจับได้แค่เหรียญหลักกับการส่งออก แต่ดีกว่าไม่เจออะไรเลย
 *
 * โมดูลนี้ตั้งใจไม่ import อะไรจากแอป (รับฟังก์ชัน derive เข้ามา) จะได้ทดสอบด้วย node ตรง ๆ ได้
 */

const EXPLORER = "https://dannyscan.com/api/v2/addresses";
const RPC = "https://rpc.dannyscan.com";

export const SCAN_GAP = 5; // เจอบัญชีที่ไม่เคยใช้ติดกันครบเท่านี้ = หยุดหา (gap limit)
export const SCAN_MAX_INDEX = 30; // เพดานกันไล่หาไม่รู้จบ
const SCAN_BATCH = 5; // ถามพร้อมกันทีละกี่ใบ

/** null = ตอบไม่ได้ (เน็ต/บริการล่ม) ซึ่งต่างจาก false ที่แปลว่าไม่เคยใช้แน่ ๆ */
export type UsedCheck = (address: string) => Promise<boolean | null>;

async function usedByExplorer(address: string, signal?: AbortSignal): Promise<boolean | null> {
  try {
    const res = await fetch(`${EXPLORER}/${address}`, { headers: { Accept: "application/json" }, signal });
    if (res.ok) return true;
    if (res.status === 404) return false; // explorer ไม่รู้จักที่อยู่นี้ = ยังไม่เคยมีธุรกรรม
    return null;
  } catch {
    return null;
  }
}

async function usedByRpc(address: string, signal?: AbortSignal): Promise<boolean | null> {
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { jsonrpc: "2.0", id: 1, method: "eth_getTransactionCount", params: [address, "latest"] },
        { jsonrpc: "2.0", id: 2, method: "eth_getBalance", params: [address, "latest"] },
      ]),
      signal,
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as { id: number; result?: string }[];
    const pick = (id: number) => arr.find((r) => r.id === id)?.result;
    const nonce = pick(1);
    const balance = pick(2);
    if (nonce == null || balance == null) return null;
    return BigInt(nonce) > 0n || BigInt(balance) > 0n;
  } catch {
    return null;
  }
}

/** explorer ก่อน (เห็นการรับโทเคนด้วย) แล้วค่อยถอยไป RPC */
export function defaultUsedCheck(signal?: AbortSignal): UsedCheck {
  return async (address) => {
    const viaExplorer = await usedByExplorer(address, signal);
    return viaExplorer !== null ? viaExplorer : usedByRpc(address, signal);
  };
}

export type ScanResult = {
  /** index ของบัญชีลูกที่เคยใช้งาน (ไม่รวม 0 ซึ่งสร้างให้อยู่แล้ว) */
  indexes: number[];
  /** ตรวจไปกี่ใบ */
  scanned: number;
  /** มีอย่างน้อย 1 ใบที่ได้คำตอบจริง — false = เน็ต/บริการล่ม ผลลัพธ์เชื่อไม่ได้ */
  ok: boolean;
};

/**
 * ไล่หาบัญชีลูกที่เคยใช้งาน ตั้งแต่ index 1 ขึ้นไป
 * หยุดเมื่อเจอช่องว่างติดกันครบ gap ใบ หรือถึง maxIndex หรือหมดเวลา
 */
export async function scanUsedAccounts(
  derive: (index: number) => string,
  opts: {
    isUsed?: UsedCheck;
    gap?: number;
    maxIndex?: number;
    batch?: number;
    timeoutMs?: number;
  } = {}
): Promise<ScanResult> {
  const gap = opts.gap ?? SCAN_GAP;
  const maxIndex = opts.maxIndex ?? SCAN_MAX_INDEX;
  const batch = opts.batch ?? SCAN_BATCH;

  const ctrl = new AbortController();
  const timer = opts.timeoutMs ? setTimeout(() => ctrl.abort(), opts.timeoutMs) : null;
  const isUsed = opts.isUsed ?? defaultUsedCheck(ctrl.signal);

  const indexes: number[] = [];
  let missStreak = 0;
  let scanned = 0;
  let answered = 0;

  try {
    for (let start = 1; start <= maxIndex && missStreak < gap; start += batch) {
      const group: number[] = [];
      for (let i = start; i < start + batch && i <= maxIndex; i++) group.push(i);
      const results = await Promise.all(group.map((i) => isUsed(derive(i))));

      for (let k = 0; k < group.length; k++) {
        scanned++;
        const used = results[k];
        if (used !== null) answered++;
        if (used) {
          indexes.push(group[k]);
          missStreak = 0;
        } else {
          // ตอบไม่ได้ก็นับเป็นช่องว่าง เพื่อไม่ให้วนยาวตอนบริการล่ม (ok จะเป็น false เอง)
          missStreak++;
        }
        if (missStreak >= gap) break;
      }
    }
  } finally {
    if (timer) clearTimeout(timer);
  }

  return { indexes, scanned, ok: answered > 0 };
}
