import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";

// ตรวจว่าเว็บปลายทางอนุญาตให้ฝังใน iframe หรือไม่ (X-Frame-Options / CSP frame-ancestors)
// ใช้ให้ dApp browser รู้ล่วงหน้า จะได้แสดง fallback "เปิดในแท็บใหม่" แทนจอว่าง
//
// กัน SSRF: ต้องเป็น http/https, host ต้อง resolve ไปยัง "IP สาธารณะ" เท่านั้น
// (บล็อก loopback/private/link-local/metadata) และไม่ตาม redirect (กัน 3xx → ภายใน)
export const dynamic = "force-dynamic";

/** IPv4 อยู่ในช่วงส่วนตัว/สงวน/ภายในหรือไม่ */
function isPrivateV4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true; // ผิดรูป = บล็อกไว้ก่อน
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return true;              // this-host / private / loopback
  if (a === 169 && b === 254) return true;                        // link-local + cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true;               // private
  if (a === 192 && b === 168) return true;                        // private
  if (a === 100 && b >= 64 && b <= 127) return true;              // CGNAT
  if (a === 192 && b === 0 && p[2] === 0) return true;            // 192.0.0.0/24
  if (a === 198 && (b === 18 || b === 19)) return true;           // benchmarking
  if (a >= 224) return true;                                      // multicast + reserved (224.0.0.0/4, 240.0.0.0/4)
  return false;
}

/** IPv6 อยู่ในช่วงภายในหรือไม่ (loopback / ULA / link-local / IPv4-mapped) */
function isPrivateV6(ip: string): boolean {
  const s = ip.toLowerCase();
  if (s === "::1" || s === "::") return true;
  if (s.startsWith("fc") || s.startsWith("fd")) return true;      // fc00::/7 ULA
  if (s.startsWith("fe8") || s.startsWith("fe9") || s.startsWith("fea") || s.startsWith("feb")) return true; // fe80::/10
  const mapped = s.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);         // IPv4-mapped ::ffff:a.b.c.d
  if (mapped) return isPrivateV4(mapped[1]);
  return false;
}

function isPrivateIp(ip: string, family: number): boolean {
  return family === 6 ? isPrivateV6(ip) : isPrivateV4(ip);
}

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
  // บล็อก hostname พิเศษ
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    return NextResponse.json({ embeddable: false, reason: "blocked-host" }, { status: 400 });
  }

  // resolve host → ทุก IP ต้องเป็นสาธารณะ (กัน DNS ชี้ไป private + กันใส่ IP ตรง ๆ)
  try {
    const addrs = await lookup(host, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivateIp(a.address, a.family))) {
      return NextResponse.json({ embeddable: false, reason: "blocked-ip" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ embeddable: false, reason: "dns-fail" }, { status: 400 });
  }

  try {
    const res = await fetch(parsed.href, {
      method: "GET",
      redirect: "manual", // ไม่ตาม redirect — กัน 3xx เด้งไปปลายทางภายใน
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DannyWallet/1.0)", Accept: "text/html" },
      signal: AbortSignal.timeout(6000),
    });
    // ถ้าเป็น redirect → ไม่ชี้ขาด (ไม่ตามต่อ) ให้ fallback ลองฝังดู
    if (res.status >= 300 && res.status < 400) {
      return NextResponse.json({ embeddable: true, reason: "redirect" });
    }
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

    return NextResponse.json({ embeddable: !blocked, reason });
  } catch {
    // ดึง header ไม่ได้ (บล็อก bot/timeout) → ไม่ชี้ขาด ให้ลองฝังดูก่อน
    return NextResponse.json({ embeddable: true, reason: "unknown" });
  }
}
