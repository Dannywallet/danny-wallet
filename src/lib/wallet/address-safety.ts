/**
 * ตรวจที่อยู่ "หน้าคล้าย" (address poisoning)
 *
 * ผู้โจมตีสร้างที่อยู่ที่หัวและท้ายเหมือนที่อยู่ที่เหยื่อเคยใช้ เพราะแอปส่วนใหญ่แสดงแค่หัวกับท้าย
 * (เช่น 0x1234…abcd) แล้วรอให้เหยื่อก๊อปจากประวัติหรือกดจากรายการแนะนำ
 *
 * เกณฑ์: ไม่ตรงกับที่อยู่ที่รู้จักตัวไหนเลย แต่
 *   - หัวและท้ายเหมือนกันฝั่งละ 3 ตัวขึ้นไป หรือ
 *   - หัวหรือท้ายฝั่งใดฝั่งหนึ่งเหมือนกัน 5 ตัวขึ้นไป (กันแบบเลียนแค่ท้าย)
 * โอกาสที่ที่อยู่สุ่มสองตัวเข้าเกณฑ์โดยบังเอิญ ≈ 2 ในล้านต่อคู่ จึงแทบไม่เตือนผิด
 *
 * โมดูลนี้ไม่ import อะไรจากแอป จะได้ทดสอบด้วย node ตรง ๆ ได้
 */

const ADDR_RE = /^0x[0-9a-f]{40}$/;

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function commonSuffix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return i;
}

/**
 * คืนที่อยู่จริงที่ `to` น่าจะเลียนแบบ (ตัวพิมพ์ตามต้นฉบับ) หรือ null ถ้าไม่เข้าข่าย
 * ถ้า `to` ตรงกับที่อยู่ที่รู้จักตัวใดตัวหนึ่งเป๊ะ ถือว่าไม่ใช่ของปลอม
 */
export function findLookalike(to: string, known: string[]): string | null {
  const t = (to || "").trim().toLowerCase();
  if (!ADDR_RE.test(t)) return null;
  const list = known
    .map((k) => ({ orig: (k || "").trim(), norm: (k || "").trim().toLowerCase() }))
    .filter((k) => ADDR_RE.test(k.norm));
  if (list.some((k) => k.norm === t)) return null;

  const body = t.slice(2);
  let best: { orig: string; score: number } | null = null;
  for (const k of list) {
    const kb = k.norm.slice(2);
    const pre = commonPrefix(body, kb);
    const suf = commonSuffix(body, kb);
    const suspicious = (pre >= 3 && suf >= 3) || pre >= 5 || suf >= 5;
    if (suspicious && (!best || pre + suf > best.score)) best = { orig: k.orig, score: pre + suf };
  }
  return best ? best.orig : null;
}
