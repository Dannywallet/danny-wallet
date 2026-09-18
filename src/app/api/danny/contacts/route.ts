import { NextResponse } from "next/server";
import {
  buildSentContacts,
  unverifiedTokenTxHashes,
  type RawTransfer,
  type RawTx,
  type SentContact,
} from "@/lib/wallet/contacts";

// รายชื่อแนะนำในหน้าส่ง = ที่อยู่ที่ผู้ใช้ "เคยส่งไปเอง" บน Danny Chain (5069)
// ไม่รวมคนที่ส่งเข้ามาอย่างเดียว เพื่อกันการหลอกด้วยที่อยู่ปลอม — เหตุผลอยู่ใน lib/wallet/contacts.ts
export const revalidate = 60;

const BASE = "https://dannyscan.com/api/v2/addresses";
const TX = "https://dannyscan.com/api/v2/transactions";

export type DannyContact = SentContact;

export async function GET(req: Request) {
  const address = (new URL(req.url).searchParams.get("address") || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "address ไม่ถูกต้อง", contacts: [] }, { status: 400 });
  }

  try {
    const opts = { headers: { Accept: "application/json" }, next: { revalidate } };
    const [trRes, txRes] = await Promise.all([
      fetch(`${BASE}/${address}/token-transfers`, opts),
      fetch(`${BASE}/${address}/transactions`, opts),
    ]);
    // explorer ตอบไม่ได้ฝั่งใดฝั่งหนึ่ง = ถือว่าไม่มีข้อมูลฝั่งนั้น (ปลอดภัยไว้ก่อน: แนะนำน้อยลง ไม่ใช่มากขึ้น)
    const txs = txRes.ok ? (((await txRes.json()) as { items?: RawTx[] }).items ?? []) : [];
    const transfers = trRes.ok ? (((await trRes.json()) as { items?: RawTransfer[] }).items ?? []) : [];
    // token transfer ขาออกที่ tx หลุดหน้าแรก — ดึง tx ตาม hash มายืนยันว่าเราเซ็นเองจริง
    const missing = unverifiedTokenTxHashes(address, txs, transfers);
    const extra = (
      await Promise.all(
        missing.map((h) =>
          fetch(`${TX}/${h}`, opts)
            .then((r) => (r.ok ? (r.json() as Promise<RawTx>) : null))
            .catch(() => null)
        )
      )
    ).filter((t): t is RawTx => t !== null);
    const contacts = buildSentContacts(address, [...txs, ...extra], transfers);

    return NextResponse.json({
      chainId: 5069,
      source: "dannyscan.com (ธุรกรรมที่ผู้ใช้เป็นผู้ส่งเท่านั้น)",
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
