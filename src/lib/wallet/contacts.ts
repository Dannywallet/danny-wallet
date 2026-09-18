/**
 * สร้างรายชื่อ "ที่อยู่ที่เคยส่งไป" สำหรับแนะนำในหน้าส่ง จากประวัติบน explorer
 *
 * ⚠️ กันการหลอกด้วยที่อยู่ปลอม (address poisoning) — รายงาน bug bounty 18 ก.ย. 2026
 * เดิมรวมทุกคู่ธุรกรรม รวมถึงคนที่ "ส่งเข้ามา" ผู้โจมตีจึงแค่แอร์ดรอปโทเคนขยะให้เหยื่อ
 * ที่อยู่ของตัวเองก็โผล่เป็นรายชื่อแนะนำ กดทีเดียวเป็นปลายทาง และยังทำให้คำเตือน
 * "ส่งครั้งแรก" ไม่ขึ้น เพราะหน้าส่งถือว่าอยู่ในรายชื่อแล้ว
 *
 * กติกา: นับเฉพาะการส่งที่ผู้ใช้ "เซ็นเอง" จริง ๆ
 *  - ธุรกรรมเหรียญหลัก: from = เรา สำเร็จ และมีมูลค่า
 *  - token transfer: from = เรา และ tx นั้นต้องเป็นธุรกรรมที่เราเป็นผู้ส่ง
 *    ต้องเช็คข้อนี้ เพราะ log Transfer ปลอมได้ — สัญญาปลอมยิง Transfer(เหยื่อ → ที่อยู่ปลอม)
 *    หรือเรียก transferFrom มูลค่า 0 ได้โดยไม่ต้องมีสิทธิ์ log จะขึ้น from = เหยื่อ
 *    ทั้งที่เหยื่อไม่ได้เซ็นอะไรเลย
 *  - ไม่นับสัญญา (pair/router/token) เพราะไม่ใช่ปลายทางที่คนตั้งใจโอนให้
 * ที่อยู่ที่ "ส่งเข้ามาอย่างเดียว" จะไม่ถูกแนะนำอีก
 *
 * โมดูลนี้ไม่ import อะไรจากแอป จะได้ทดสอบด้วย node ตรง ๆ ได้
 */

export type Party = { hash?: string | null; is_contract?: boolean | null } | null;

export type RawTx = {
  hash?: string;
  from?: Party;
  to?: Party;
  timestamp?: string;
  value?: string | null;
  status?: string | null;
};

export type RawTransfer = {
  from?: Party;
  to?: Party;
  timestamp?: string;
  type?: string;
  // Blockscout รุ่นนี้ใช้ tx_hash รุ่นใหม่เปลี่ยนเป็น transaction_hash — รองรับทั้งคู่
  tx_hash?: string;
  transaction_hash?: string;
};

export type SentContact = {
  address: string;
  short: string;
  direction: "sent";
  lastTs: number;
};

const lc = (s?: string | null) => (s || "").toLowerCase();

export function shortAddr(a: string): string {
  return a && a.length >= 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

export function buildSentContacts(
  me: string,
  txs: RawTx[],
  transfers: RawTransfer[],
  limit = 8
): SentContact[] {
  const self = lc(me);
  const signedByMe = new Set<string>(); // hash ของธุรกรรมที่เราเป็นผู้เซ็น
  const entries: { addr: string; ts: number }[] = [];

  for (const t of txs) {
    if (lc(t.from?.hash) !== self) continue; // ต้องเป็นธุรกรรมที่เราเซ็นเอง
    if (t.status && t.status !== "ok") continue; // ส่งไม่สำเร็จ = ยังไม่เคยส่ง
    if (t.hash) signedByMe.add(lc(t.hash));
    const to = t.to?.hash;
    if (!to || lc(to) === self || t.to?.is_contract) continue;
    if (!t.value || t.value === "0") continue; // มูลค่า 0 = เรียกสัญญา ไม่ใช่โอนเหรียญหลัก
    entries.push({ addr: to, ts: Date.parse(t.timestamp || "") || 0 });
  }

  for (const t of transfers) {
    if (t.type && t.type !== "token_transfer") continue;
    if (lc(t.from?.hash) !== self) continue;
    const txh = lc(t.tx_hash ?? t.transaction_hash);
    // log บอกว่า from = เรา แต่เราไม่ได้เซ็น tx นี้ = transfer ปลอม/ถูกยัดเยียด
    if (!txh || !signedByMe.has(txh)) continue;
    const to = t.to?.hash;
    if (!to || lc(to) === self || t.to?.is_contract) continue;
    entries.push({ addr: to, ts: Date.parse(t.timestamp || "") || 0 });
  }

  const byAddr = new Map<string, SentContact>();
  for (const e of entries) {
    const key = lc(e.addr);
    const prev = byAddr.get(key);
    if (!prev || e.ts > prev.lastTs) {
      byAddr.set(key, { address: e.addr, short: shortAddr(e.addr), direction: "sent", lastTs: e.ts });
    }
  }
  return [...byAddr.values()].sort((a, b) => b.lastTs - a.lastTs).slice(0, limit);
}

/**
 * hash ของ token transfer ขาออกที่ยังยืนยันไม่ได้ว่าเราเซ็นเอง เพราะ tx อยู่นอกหน้าแรกของประวัติ
 * (หน้าแรกได้แค่ 50 รายการ ผู้ใช้ที่ธุรกรรมเยอะจะหลุด) ผู้เรียกดึง tx ตาม hash มาเช็ค from อีกที
 * จำกัดจำนวนไว้ กันผู้โจมตีสแปม transfer ปลอมจนต้องยิงไม่จบ
 * tx ที่อยู่ในหน้าแรกอยู่แล้วไม่ต้องดึงซ้ำ — ถ้า from ไม่ใช่เรา ก็คือของปลอมแน่นอน
 */
export function unverifiedTokenTxHashes(
  me: string,
  txs: RawTx[],
  transfers: RawTransfer[],
  limit = 10
): string[] {
  const self = lc(me);
  const inPage = new Set(txs.filter((t) => t.hash).map((t) => lc(t.hash)));
  const out: string[] = [];
  for (const t of transfers) {
    if (out.length >= limit) break;
    if (t.type && t.type !== "token_transfer") continue;
    if (lc(t.from?.hash) !== self) continue;
    const to = t.to?.hash;
    if (!to || lc(to) === self || t.to?.is_contract) continue;
    const h = lc(t.tx_hash ?? t.transaction_hash);
    if (!h || inPage.has(h) || out.includes(h)) continue;
    out.push(h);
  }
  return out;
}
