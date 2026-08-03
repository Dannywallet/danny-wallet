import { NextResponse } from "next/server";

// อัตราแลกเปลี่ยน USD → สกุลเงินอื่น (สำหรับแสดงมูลค่าพอร์ตเป็นเงินท้องถิ่น)
// ดึงจาก open.er-api.com (ฟรี ไม่ต้องใช้ key) แล้ว cache ไว้ 1 ชม.
export const revalidate = 3600;

const SOURCE = "https://open.er-api.com/v6/latest/USD";

// สกุลเงินที่รองรับ (นิยมสากล + บาทไทย)
// หมายเหตุ: ไฟล์ route ของ Next ห้าม export ค่าอื่นนอกจาก handler/config → ต้องเป็น const ธรรมดา
const SUPPORTED = ["USD", "THB", "EUR", "GBP", "JPY", "CNY", "KRW", "SGD", "AUD", "INR"] as const;

export async function GET() {
  try {
    const res = await fetch(SOURCE, { headers: { Accept: "application/json" }, next: { revalidate } });
    if (!res.ok) throw new Error(`fx ${res.status}`);
    const j = (await res.json()) as { result?: string; rates?: Record<string, number>; time_last_update_unix?: number };
    if (j.result !== "success" || !j.rates) throw new Error("bad fx payload");

    // ส่งเฉพาะสกุลที่รองรับ (ลดขนาด payload)
    const rates: Record<string, number> = { USD: 1 };
    for (const c of SUPPORTED) {
      const r = j.rates[c];
      if (typeof r === "number" && r > 0) rates[c] = r;
    }

    return NextResponse.json({
      base: "USD",
      rates,
      updatedAt: j.time_last_update_unix ? j.time_last_update_unix * 1000 : Date.now(),
      source: "open.er-api.com",
    });
  } catch (e) {
    // ล้มเหลว → คืน USD อย่างเดียว (ฝั่ง client จะ fallback แสดงเป็น USD)
    return NextResponse.json(
      { base: "USD", rates: { USD: 1 }, updatedAt: Date.now(), error: e instanceof Error ? e.message : "fx failed" },
      { status: 200 },
    );
  }
}
