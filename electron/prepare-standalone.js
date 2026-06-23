// เตรียมโฟลเดอร์ .next/standalone ให้พร้อมแพ็ก: คัดลอก static + public เข้าไป
// (Next standalone ไม่ได้คัดลอกให้เอง) — รันหลัง "next build"
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error('❌ ไม่พบ .next/standalone/server.js — รัน "next build" ก่อน (ต้องตั้ง output:"standalone")');
  process.exit(1);
}

// .next/static → .next/standalone/.next/static
fs.cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });

// public → .next/standalone/public (ถ้ามี)
const pub = path.join(root, "public");
if (fs.existsSync(pub)) {
  fs.cpSync(pub, path.join(standalone, "public"), { recursive: true });
}

console.log("✅ เตรียม standalone เสร็จ (คัดลอก .next/static + public แล้ว)");
