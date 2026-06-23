"use client";

import React from "react";
import Link from "next/link";
import { Screen } from "@/components/wallet/PhoneShell";
import { TopBar } from "@/components/wallet/TopBar";
import { BottomNav } from "@/components/wallet/BottomNav";
import { Shield, Check, Warn, ChevronRight } from "@/components/wallet/Icons";

const isAddr = (s: string) => /^0x[a-fA-F0-9]{40}$/.test(s.trim());

export default function ListingPage() {
  const [f, setF] = React.useState({
    contract: "", symbol: "", name: "", logoUrl: "",
    website: "", twitter: "", telegram: "", description: "", contact: "", pairInfo: "",
  });
  const [logoData, setLogoData] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [doneId, setDoneId] = React.useState<string | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const onLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 300_000) { setErr("ไฟล์โลโก้ใหญ่เกิน 300KB — ย่อรูปก่อน"); return; }
    const reader = new FileReader();
    reader.onload = () => setLogoData(String(reader.result));
    reader.readAsDataURL(file);
  };

  const valid = isAddr(f.contract) && f.symbol.trim() && f.name.trim() && f.contact.trim();

  const submit = async () => {
    setErr(null);
    if (!valid) { setErr("กรุณากรอก contract, ชื่อ, สัญลักษณ์ และช่องทางติดต่อให้ครบ"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/danny/listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, logoData }),
      });
      const j = await res.json();
      if (!res.ok) { setErr(j.error || "ส่งคำขอไม่สำเร็จ"); setBusy(false); return; }
      setDoneId(j.id);
    } catch {
      setErr("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    }
    setBusy(false);
  };

  if (doneId) {
    return (
      <>
        <TopBar title="ขอลงลิสต์โทเคน" />
        <Screen className="flex flex-col items-center justify-center py-20 text-center">
          <span className="grid h-24 w-24 place-items-center rounded-full bg-[var(--dw-green)]/15 text-[var(--dw-green)] dw-pulse-ring">
            <Check size={44} />
          </span>
          <h1 className="mt-6 text-xl font-semibold">ส่งคำขอเรียบร้อย</h1>
          <p className="mt-2 text-sm text-[var(--dw-muted)]">
            ทีมงานจะตรวจสอบและติดต่อกลับทางช่องทางที่ให้ไว้
          </p>
          <div className="dw-glass mt-5 rounded-xl px-4 py-2 font-mono text-sm">{doneId}</div>
          <Link href="/wallet/home" className="dw-btn-primary mt-6 rounded-xl px-6 py-3 text-sm font-semibold">
            กลับหน้าหลัก
          </Link>
        </Screen>
        <BottomNav />
      </>
    );
  }

  const logoPreview = logoData || (f.logoUrl.trim() ? f.logoUrl.trim() : null);

  return (
    <>
      <TopBar
        title="ขอลงลิสต์โทเคน"
        right={
          <Link href="/wallet/how-to-list" className="text-xs text-[var(--dw-cyan)]">
            วิธีลงลิสต์
          </Link>
        }
      />
      <Screen className="pb-8">
        <div className="dw-glass mb-4 flex items-start gap-2.5 rounded-2xl p-3.5 text-xs leading-relaxed text-[var(--dw-muted)]">
          <Shield size={18} className="mt-0.5 shrink-0 text-[var(--dw-green)]" />
          กรอกข้อมูลโทเคนของคุณบน Danny Chain (5069) เพื่อขอให้แสดงในกระเป๋าพร้อมโลโก้ · คำขอจะถูกเก็บไว้รอทีมงานตรวจสอบ
        </div>

        <div className="space-y-3.5">
          <Field label="Contract address *" hint={f.contract && !isAddr(f.contract) ? "รูปแบบไม่ถูกต้อง" : undefined}>
            <input value={f.contract} onChange={set("contract")} placeholder="0x…" className={inputCls} spellCheck={false} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="ชื่อโทเคน *">
              <input value={f.name} onChange={set("name")} placeholder="เช่น Danny Coin" className={inputCls} />
            </Field>
            <Field label="สัญลักษณ์ *">
              <input value={f.symbol} onChange={set("symbol")} placeholder="เช่น DAN" className={inputCls} maxLength={16} />
            </Field>
          </div>

          {/* โลโก้ */}
          <Field label="โลโก้ (URL หรืออัปโหลดไฟล์)">
            <div className="flex items-center gap-3">
              <div className="dw-glass grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="โลโก้" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-[var(--dw-muted)]">ยังไม่มี</span>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <input value={f.logoUrl} onChange={set("logoUrl")} placeholder="วาง URL โลโก้ (https://…)" className={inputCls} spellCheck={false} />
                <label className="dw-btn-ghost block cursor-pointer rounded-xl py-2 text-center text-xs font-medium">
                  หรือเลือกไฟล์ (≤300KB)
                  <input type="file" accept="image/*" onChange={onLogoFile} className="hidden" />
                </label>
              </div>
            </div>
          </Field>

          <Field label="คู่สภาพคล่อง (ถ้ามี)" hint="เช่น มี LP กับ WDAN/USDT บน dandex">
            <input value={f.pairInfo} onChange={set("pairInfo")} placeholder="pair address หรือคู่ที่จับ" className={inputCls} spellCheck={false} />
          </Field>

          <Field label="เว็บไซต์">
            <input value={f.website} onChange={set("website")} placeholder="https://…" className={inputCls} spellCheck={false} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="X / Twitter">
              <input value={f.twitter} onChange={set("twitter")} placeholder="@handle หรือลิงก์" className={inputCls} spellCheck={false} />
            </Field>
            <Field label="Telegram">
              <input value={f.telegram} onChange={set("telegram")} placeholder="@group หรือลิงก์" className={inputCls} spellCheck={false} />
            </Field>
          </div>

          <Field label="คำอธิบายสั้น">
            <textarea value={f.description} onChange={set("description")} rows={3} maxLength={500} placeholder="โทเคนนี้เกี่ยวกับอะไร" className={`${inputCls} resize-none`} />
          </Field>

          <Field label="ช่องทางติดต่อกลับ *" hint="อีเมล/Telegram ที่ทีมงานติดต่อได้">
            <input value={f.contact} onChange={set("contact")} placeholder="email หรือ @telegram" className={inputCls} spellCheck={false} />
          </Field>
        </div>

        {err && (
          <p className="mt-3 flex items-center justify-center gap-1 text-center text-xs text-[var(--dw-rose)]">
            <Warn size={14} className="shrink-0" /> {err}
          </p>
        )}

        <button
          onClick={submit}
          disabled={!valid || busy}
          className="dw-btn-primary mt-5 w-full rounded-2xl py-4 font-semibold disabled:opacity-50"
        >
          {busy ? "กำลังส่งคำขอ…" : "ส่งคำขอลงลิสต์"}
        </button>

        <Link
          href="/wallet/how-to-list"
          className="mt-3 flex items-center justify-center gap-1 text-xs text-[var(--dw-muted)]"
        >
          ดูเงื่อนไขและขั้นตอนการลงลิสต์ <ChevronRight size={13} />
        </Link>
      </Screen>
      <BottomNav />
    </>
  );
}

const inputCls =
  "dw-glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none placeholder:text-white/25 focus:border-[var(--dw-cyan)]/50";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between px-0.5">
        <label className="text-xs font-medium text-[var(--dw-muted)]">{label}</label>
        {hint && <span className="text-[10px] text-[var(--dw-amber)]">{hint}</span>}
      </div>
      <div style={{ color: "var(--dw-text)" }}>{children}</div>
    </div>
  );
}
