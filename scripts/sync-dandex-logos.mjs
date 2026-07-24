// Auto-sync โลโก้ token จาก dandex.io/swap → data/dandex-logos.json (runtime override)
// วิธี: ดึงหน้า swap → รวมสคริปต์ _next → regex object ที่มี chainId 5069 + address + logoURI
// ไม่ต้องใช้เบราว์เซอร์ (fetch + regex ล้วน) — เหมาะรันเป็น cron
// เขียนลง data/ (mounted volume) → tokens/portfolio route อ่านตอน runtime ไม่ต้อง rebuild
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://dandex.io";
const PAGE = `${BASE}/swap/`;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "dandex-logos.json");
const MIN_TOKENS = 10; // ถ้าได้น้อยกว่านี้ = ดึงพลาด อย่าเขียนทับ

async function main() {
  const html = await (await fetch(PAGE)).text();
  // สคริปต์ _next ทั้งหมดในหน้า + chunk จาก buildManifest
  const srcs = new Set(
    [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => BASE + m[1]),
  );
  // ดึง buildManifest มาหา chunk เพิ่ม (เผื่อ list อยู่ chunk ที่ไม่ถูกอ้างตรง ๆ ในหน้า)
  const manifest = [...srcs].find((u) => /_buildManifest\.js$/.test(u));
  if (manifest) {
    try {
      const mtext = await (await fetch(manifest)).text();
      for (const m of mtext.matchAll(/"(static\/chunks\/[^"]+\.js)"/g)) srcs.add(`${BASE}/_next/${m[1]}`);
    } catch { /* ใช้เท่าที่มี */ }
  }

  let all = "";
  for (const u of srcs) {
    try { all += await (await fetch(u)).text(); } catch { /* ข้าม chunk ที่โหลดไม่ได้ */ }
  }

  // จับ object token (Uniswap token-list format) ที่ chainId = 5069 พร้อม address + logoURI (สลับลำดับได้)
  const re =
    /"chainId":5069[^{}]*?"address":"(0x[0-9a-fA-F]{40})"[^{}]*?"logoURI":"([^"]+)"|"address":"(0x[0-9a-fA-F]{40})"[^{}]*?"chainId":5069[^{}]*?"logoURI":"([^"]+)"|"logoURI":"([^"]+)"[^{}]*?"address":"(0x[0-9a-fA-F]{40})"[^{}]*?"chainId":5069/g;
  const map = {};
  let m;
  while ((m = re.exec(all))) {
    const addr = (m[1] || m[3] || m[6] || "").toLowerCase();
    const logo = m[2] || m[4] || m[5] || "";
    if (addr && /^https?:\/\//.test(logo)) map[addr] = logo;
  }

  const n = Object.keys(map).length;
  if (n < MIN_TOKENS) {
    console.error(`[sync-dandex-logos] got only ${n} tokens (scripts=${srcs.size}, bytes=${all.length}) — refusing to overwrite`);
    process.exit(1);
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(map, null, 2) + "\n");
  console.log(`[sync-dandex-logos] wrote ${n} tokens → ${OUT} (scripts=${srcs.size})`);
}

main().catch((e) => { console.error("[sync-dandex-logos] failed:", e?.message || e); process.exit(1); });
