import { NextResponse } from "next/server";

// ดึง "รายชื่อล่าสุด" จากที่อยู่ที่เคยทำธุรกรรมจริงบน Danny Chain (5069)
// เน้นผู้รับล่าสุด (ที่เราเคยส่งไป) แล้วตามด้วยคู่ธุรกรรมอื่น
export const revalidate = 60;

const BASE = "https://dannyscan.com/api/v2/addresses";

type Party = { hash: string } | null;
type RawTransfer = { from: Party; to: Party; timestamp: string; type: string };
type RawTx = { from: Party; to: Party; timestamp: string; value: string | null };

export type DannyContact = {
  address: string;
  short: string;
  direction: "sent" | "received";
  lastTs: number;
};

function short(a: string): string {
  return a && a.length >= 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

export async function GET(req: Request) {
  const address = (new URL(req.url).searchParams.get("address") || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "address ไม่ถูกต้อง", contacts: [] }, { status: 400 });
  }
  const me = address.toLowerCase();

  try {
    const opts = { headers: { Accept: "application/json" }, next: { revalidate } };
    const [trRes, txRes] = await Promise.all([
      fetch(`${BASE}/${address}/token-transfers`, opts),
      fetch(`${BASE}/${address}/transactions`, opts),
    ]);

    // รวมคู่ธุรกรรม (counterparty) จากทั้ง token transfers และ native
    type Entry = { addr: string; dir: "sent" | "received"; ts: number };
    const entries: Entry[] = [];

    if (trRes.ok) {
      const j = (await trRes.json()) as { items: RawTransfer[] };
      for (const t of j.items || []) {
        if (t.type !== "token_transfer") continue;
        const out = t.from?.hash?.toLowerCase() === me;
        const cp = (out ? t.to?.hash : t.from?.hash) || "";
        if (cp && cp.toLowerCase() !== me) {
          entries.push({ addr: cp, dir: out ? "sent" : "received", ts: Date.parse(t.timestamp) || 0 });
        }
      }
    }
    if (txRes.ok) {
      const j = (await txRes.json()) as { items: RawTx[] };
      for (const t of j.items || []) {
        const out = t.from?.hash?.toLowerCase() === me;
        const cp = (out ? t.to?.hash : t.from?.hash) || "";
        // ข้าม contract call ที่ไม่ใช่การโอนมูลค่า (value 0) เพื่อให้ได้ที่อยู่กระเป๋าจริง ๆ
        if (cp && cp.toLowerCase() !== me && t.value && t.value !== "0") {
          entries.push({ addr: cp, dir: out ? "sent" : "received", ts: Date.parse(t.timestamp) || 0 });
        }
      }
    }

    // dedupe ตามที่อยู่ — เก็บรายการล่าสุด, จัดลำดับ "เคยส่งไป" มาก่อน
    const byAddr = new Map<string, DannyContact>();
    for (const e of entries) {
      const key = e.addr.toLowerCase();
      const prev = byAddr.get(key);
      if (!prev || e.ts > prev.lastTs) {
        byAddr.set(key, { address: e.addr, short: short(e.addr), direction: e.dir, lastTs: e.ts });
      }
    }

    const contacts = [...byAddr.values()]
      .sort((a, b) => {
        if (a.direction !== b.direction) return a.direction === "sent" ? -1 : 1;
        return b.lastTs - a.lastTs;
      })
      .slice(0, 8);

    return NextResponse.json({
      chainId: 5069,
      source: "dannyscan.com (ประวัติธุรกรรมจริง)",
      address,
      count: contacts.length,
      contacts,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fetch ล้มเหลว", contacts: [] },
      { status: 500 }
    );
  }
}
