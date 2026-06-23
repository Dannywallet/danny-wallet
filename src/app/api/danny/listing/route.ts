import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// รับคำขอลงลิสต์โทเคนจากโปรเจกต์ → เก็บลงไฟล์ JSON ฝั่งเซิร์ฟเวอร์ (สถานะ pending รออนุมัติ)
// POST = ส่งคำขอ (เปิดสาธารณะ) · GET = ดูคำขอ (ต้องมี ?key= ตรงกับ env LISTING_ADMIN_KEY)
export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "token-submissions.json");
const APPROVED_FILE = path.join(DATA_DIR, "approved-logos.json");

type Submission = {
  id: string;
  contract: string;
  symbol: string;
  name: string;
  logoUrl?: string;
  logoData?: string; // dataURL กรณีอัปโหลดไฟล์
  website?: string;
  twitter?: string;
  telegram?: string;
  description?: string;
  contact: string;
  pairInfo?: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
};

async function readAll(): Promise<Submission[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as Submission[];
  } catch {
    return [];
  }
}
async function writeAll(list: Submission[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
}

// แมปโลโก้ที่อนุมัติแล้ว: contract(lowercase) → logo (URL หรือ dataURL) — tokens API จะ merge ทับ
async function readApproved(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await fs.readFile(APPROVED_FILE, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}
async function writeApproved(map: Record<string, string>) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(APPROVED_FILE, JSON.stringify(map, null, 2), "utf8");
}

const isAddr = (s: string) => /^0x[a-fA-F0-9]{40}$/.test(s);
const trim = (v: unknown) => String(v ?? "").trim();

// แจ้งเตือนเมื่อมีคำขอใหม่ — POST ไปยัง webhook (รองรับ Discord/Slack/generic) ถ้าตั้งค่า env ไว้
// Discord ใช้ field "content", Slack ใช้ "text" — ส่งทั้งคู่ให้ครอบคลุม
async function notifyNewSubmission(sub: Submission) {
  const url = process.env.LISTING_NOTIFY_WEBHOOK;
  if (!url) return;
  const msg =
    `🆕 คำขอลงลิสต์โทเคนใหม่\n` +
    `• ${sub.symbol} (${sub.name})\n` +
    `• contract: ${sub.contract}\n` +
    `• ติดต่อ: ${sub.contact}\n` +
    (sub.website ? `• เว็บ: ${sub.website}\n` : "") +
    `• รหัส: ${sub.id}`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: msg, text: msg }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    /* แจ้งเตือนล้มเหลวไม่กระทบการบันทึกคำขอ */
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const contract = trim(body.contract);
  const symbol = trim(body.symbol);
  const name = trim(body.name);
  const contact = trim(body.contact);

  if (!isAddr(contract)) return NextResponse.json({ error: "Contract address ไม่ถูกต้อง (ต้องเป็น 0x ตามด้วย 40 ตัวอักษร)" }, { status: 400 });
  if (!symbol || symbol.length > 16) return NextResponse.json({ error: "กรุณากรอกสัญลักษณ์ (ไม่เกิน 16 ตัว)" }, { status: 400 });
  if (!name || name.length > 64) return NextResponse.json({ error: "กรุณากรอกชื่อโทเคน (ไม่เกิน 64 ตัว)" }, { status: 400 });
  if (!contact) return NextResponse.json({ error: "กรุณาระบุช่องทางติดต่อกลับ" }, { status: 400 });

  // โลโก้: รับเป็น URL หรือ dataURL (จำกัดขนาดกัน payload ใหญ่)
  const logoDataRaw = trim(body.logoData);
  const logoData = logoDataRaw.startsWith("data:image/") ? logoDataRaw.slice(0, 350_000) : undefined;

  const list = await readAll();
  if (list.some((s) => s.contract.toLowerCase() === contract.toLowerCase() && s.status === "pending")) {
    return NextResponse.json({ error: "โทเคนนี้มีคำขอที่กำลังรอตรวจสอบอยู่แล้ว" }, { status: 409 });
  }

  const sub: Submission = {
    id: "REQ-" + Date.now().toString(36).toUpperCase(),
    contract,
    symbol,
    name,
    logoUrl: trim(body.logoUrl) || undefined,
    logoData,
    website: trim(body.website) || undefined,
    twitter: trim(body.twitter) || undefined,
    telegram: trim(body.telegram) || undefined,
    description: trim(body.description).slice(0, 500) || undefined,
    contact,
    pairInfo: trim(body.pairInfo) || undefined,
    status: "pending",
    submittedAt: new Date().toISOString(),
  };

  list.push(sub);
  await writeAll(list);
  void notifyNewSubmission(sub); // fire-and-forget — ไม่ดีเลย์การตอบกลับผู้ส่ง
  return NextResponse.json({ ok: true, id: sub.id });
}

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key") || "";
  const adminKey = process.env.LISTING_ADMIN_KEY;
  if (!adminKey || key !== adminKey) {
    return NextResponse.json({ error: "unauthorized — ต้องมี ?key= ที่ตรงกับ LISTING_ADMIN_KEY" }, { status: 401 });
  }
  const list = await readAll();
  return NextResponse.json({
    count: list.length,
    pending: list.filter((s) => s.status === "pending").length,
    submissions: list.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
  });
}

// แอดมินอนุมัติ/ปฏิเสธคำขอ — ต้องมี key ตรงกับ LISTING_ADMIN_KEY
// อนุมัติ = บันทึกโลโก้ลง approved-logos.json อัตโนมัติ (tokens API จะดึงไปแสดงเอง)
export async function PATCH(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const adminKey = process.env.LISTING_ADMIN_KEY;
  if (!adminKey || trim(body.key) !== adminKey) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = trim(body.id);
  const action = trim(body.action); // "approve" | "reject"
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action ต้องเป็น approve หรือ reject" }, { status: 400 });
  }

  const list = await readAll();
  const sub = list.find((s) => s.id === id);
  if (!sub) return NextResponse.json({ error: "ไม่พบคำขอนี้" }, { status: 404 });

  if (action === "approve") {
    sub.status = "approved";
    const logo = sub.logoData || sub.logoUrl || ""; // dataURL (อัปโหลด) หรือ URL
    if (logo) {
      const approved = await readApproved();
      approved[sub.contract.toLowerCase()] = logo;
      await writeApproved(approved);
    }
  } else {
    sub.status = "rejected";
    // ถ้าเคยอนุมัติไว้แล้วถอนออกจากแมป
    const approved = await readApproved();
    if (approved[sub.contract.toLowerCase()]) {
      delete approved[sub.contract.toLowerCase()];
      await writeApproved(approved);
    }
  }

  await writeAll(list);
  return NextResponse.json({ ok: true, id: sub.id, status: sub.status });
}
