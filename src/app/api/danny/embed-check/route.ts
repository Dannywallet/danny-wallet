import { NextResponse } from "next/server";

// ตรวจว่าเว็บปลายทางอนุญาตให้ฝังใน iframe หรือไม่ (X-Frame-Options / CSP frame-ancestors)
// ใช้ให้ dApp browser รู้ล่วงหน้า จะได้แสดง fallback "เปิดในแท็บใหม่" แทนจอว่าง
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const target = (new URL(req.url).searchParams.get("url") || "").trim();
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ embeddable: false, reason: "bad-url" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ embeddable: false, reason: "bad-proto" }, { status: 400 });
  }

  try {
    const res = await fetch(parsed.href, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DannyWallet/1.0)", Accept: "text/html" },
      signal: AbortSignal.timeout(6000),
    });
    const xfo = (res.headers.get("x-frame-options") || "").toLowerCase();
    const csp = (res.headers.get("content-security-policy") || "").toLowerCase();

    let blocked = false;
    let reason = "";
    if (xfo.includes("deny") || xfo.includes("sameorigin")) {
      blocked = true;
      reason = "x-frame-options";
    }
    const fa = csp.match(/frame-ancestors([^;]*)/);
    if (fa && !fa[1].includes("*")) {
      blocked = true;
      reason = reason || "csp-frame-ancestors";
    }

    return NextResponse.json({ embeddable: !blocked, reason, finalUrl: res.url });
  } catch {
    // ดึง header ไม่ได้ (บล็อก bot/timeout) → ไม่ชี้ขาด ให้ลองฝังดูก่อน
    return NextResponse.json({ embeddable: true, reason: "unknown" });
  }
}
