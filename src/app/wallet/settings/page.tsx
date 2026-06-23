"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet/wallet-store";
import { Screen } from "@/components/wallet/PhoneShell";
import { BottomNav } from "@/components/wallet/BottomNav";
import { SecurityBadge } from "@/components/wallet/SecurityBadge";
import { Sheet } from "@/components/wallet/Sheet";
import { DannyLogo } from "@/components/wallet/DannyLogo";
import { SeedPhraseGrid } from "@/components/wallet/SeedPhraseGrid";
import { copyEphemeral } from "@/lib/wallet/clipboard";
import { CHAIN } from "@/lib/wallet/mock-data";
import { AccountSwitcher } from "@/components/wallet/AccountSwitcher";
import { shortAddress } from "@/lib/wallet/format";
import {
  Shield, Lock, Fingerprint, Eye, Globe, Book, Logout, ChevronRight, Bell, Copy, Check, ArrowUp, ArrowDown, Warn,
} from "@/components/wallet/Icons";

type Contact = { address: string; short: string; direction: "sent" | "received" };

const LOCK_OPTIONS = [
  { min: 1, label: "1 นาที" },
  { min: 5, label: "5 นาที" },
  { min: 15, label: "15 นาที" },
  { min: 30, label: "30 นาที" },
  { min: 0, label: "ปิด (ไม่ล็อกอัตโนมัติ)" },
];

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 rounded-full transition ${
        on ? "bg-gradient-to-r from-[var(--dw-violet)] to-[var(--dw-cyan)]" : "bg-white/12"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
          on ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function Item({
  Icon, title, desc, right, onClick,
}: {
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  desc?: string;
  right?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
      className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition ${
        onClick ? "cursor-pointer hover:bg-white/[0.04]" : ""
      }`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-[var(--dw-purple)]">
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {desc && <p className="truncate text-xs text-[var(--dw-muted)]">{desc}</p>}
      </div>
      {right ?? <ChevronRight size={18} className="text-[var(--dw-muted)]" />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-2 px-1 text-xs font-medium text-[var(--dw-muted)]">{title}</p>
      <div className="dw-glass divide-y divide-white/[0.06] overflow-hidden rounded-2xl">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { biometric, balanceHidden, autoLockMin, setPref, lock, reset, toggleBalance, revealMnemonic, address, accounts, activeIndex, hasSeed } = useWallet();
  const MY_ADDRESS = address ?? "";
  const [sheet, setSheet] = React.useState<null | "lock" | "book" | "about" | "network" | "seed">(null);
  const [switcher, setSwitcher] = React.useState(false);
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [copied, setCopied] = React.useState<string | null>(null);
  // reveal seed (ต้องใส่ PIN)
  const [revealPin, setRevealPin] = React.useState("");
  const [revealedSeed, setRevealedSeed] = React.useState<string[] | null>(null);
  const [revealErr, setRevealErr] = React.useState(false);

  const doReveal = async () => {
    setRevealErr(false);
    const phrase = await revealMnemonic(revealPin);
    if (phrase) setRevealedSeed(phrase.split(" "));
    else setRevealErr(true);
  };
  const closeSeed = () => {
    setSheet(null);
    setRevealPin("");
    setRevealedSeed(null);
    setRevealErr(false);
  };

  React.useEffect(() => {
    if (!MY_ADDRESS) return;
    fetch(`/api/danny/contacts?address=${MY_ADDRESS}`)
      .then((r) => r.json())
      .then((j: { contacts?: Contact[] }) => setContacts(j.contacts || []))
      .catch(() => setContacts([]));
  }, [MY_ADDRESS]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1300);
    } catch {
      /* noop */
    }
  };

  const lockLabel = autoLockMin === 0 ? "ปิด" : `${autoLockMin} นาที`;

  const doLogout = () => {
    lock();
    router.replace("/wallet/unlock");
  };
  const doReset = () => {
    if (confirm("ล้างกระเป๋าเดโมและเริ่มใหม่? (ข้อมูลสมมติทั้งหมดจะถูกลบ)")) {
      reset();
      router.replace("/wallet");
    }
  };

  return (
    <>
      <div className="relative z-10 px-5 pb-1 pt-6">
        <h1 className="text-xl font-bold">ตั้งค่า</h1>
      </div>
      <Screen className="pt-3">
        {/* การ์ดบัญชี — กดเพื่อสลับ/จัดการบัญชี */}
        <button
          onClick={() => setSwitcher(true)}
          className="dw-glass-strong mb-5 flex w-full items-center gap-3 rounded-2xl p-4 text-left transition hover:bg-white/[0.04]"
        >
          <DannyLogo size={48} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{accounts[activeIndex]?.name || "บัญชี"}</p>
            <p className="truncate font-mono text-xs text-[var(--dw-muted)]">{shortAddress(MY_ADDRESS, 10, 6)}</p>
          </div>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-[var(--dw-muted)]">
            {accounts.length} บัญชี
          </span>
          <ChevronRight size={18} className="text-[var(--dw-muted)]" />
        </button>

        <Section title="ความปลอดภัย">
          <Item Icon={Fingerprint} title="ปลดล็อกด้วยชีวมิติ" desc="ลายนิ้วมือ / ใบหน้า"
            right={<Toggle on={biometric} onChange={(v) => setPref({ biometric: v })} />} />
          <Item Icon={Lock} title="ออโต้ล็อก" desc={`ล็อกอัตโนมัติหลัง ${lockLabel}`}
            onClick={() => setSheet("lock")} />
          <Item Icon={Eye} title="ซ่อนยอดเงิน" desc="ปิดบังจำนวนเงินบนหน้าจอ"
            right={<Toggle on={balanceHidden} onChange={() => toggleBalance()} />} />
          {hasSeed && (
            <Item Icon={Shield} title="วลีกู้คืน" desc="เผยวลี 12 คำ (ต้องใส่ PIN)"
              onClick={() => setSheet("seed")} />
          )}
        </Section>

        <Section title="เครือข่าย & รายชื่อ">
          <Item Icon={Globe} title="เครือข่าย" desc={`${CHAIN.name} · Chain ID ${CHAIN.chainId}`}
            onClick={() => setSheet("network")} />
          <Item Icon={Book} title="สมุดที่อยู่" desc={`${contacts.length} รายชื่อจากประวัติจริง`}
            onClick={() => setSheet("book")} />
          <Item Icon={Bell} title="การแจ้งเตือน" desc="ธุรกรรมเข้า/ออก และราคา"
            right={<Toggle on onChange={() => {}} />} />
        </Section>

        <Section title="ทั่วไป">
          <Item Icon={Shield} title="จัดการคำขอลงลิสต์ (แอดมิน)" desc="อนุมัติโทเคน + ใส่โลโก้ (ต้องมีกุญแจ)"
            onClick={() => router.push("/wallet/admin/listings")} />
          <Item Icon={Book} title="เกี่ยวกับ Danny Wallet" desc="เวอร์ชัน 1.0.0 (เดโม)"
            onClick={() => setSheet("about")} />
          <Item Icon={Logout} title="ล็อกกระเป๋า" desc="ออกและล็อกหน้าจอ" onClick={doLogout} />
        </Section>

        <button
          onClick={doReset}
          className="mt-2 w-full rounded-2xl border border-[var(--dw-rose)]/30 bg-[var(--dw-rose)]/[0.06] py-3.5 text-sm font-medium text-[var(--dw-rose)]"
        >
          ล้างกระเป๋าเดโม & เริ่มใหม่
        </button>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-[var(--dw-muted)]">
          Danny Wallet เชื่อมข้อมูลจริงจาก Danny Chain (5069)<br />
          การ swap จริงต้องลงนามด้วยกระเป๋าของคุณเอง
        </p>
      </Screen>

      {/* Sheet: ออโต้ล็อก */}
      <Sheet open={sheet === "lock"} onClose={() => setSheet(null)} title="ออโต้ล็อก">
        <p className="mb-3 text-sm text-[var(--dw-muted)]">ล็อกกระเป๋าอัตโนมัติเมื่อไม่มีการใช้งานครบเวลาที่กำหนด</p>
        <div className="space-y-1.5">
          {LOCK_OPTIONS.map((o) => (
            <button
              key={o.min}
              onClick={() => {
                setPref({ autoLockMin: o.min });
                setSheet(null);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm transition ${
                autoLockMin === o.min ? "dw-btn-primary" : "dw-glass hover:bg-white/[0.06]"
              }`}
            >
              <span className="font-medium">{o.label}</span>
              {autoLockMin === o.min && <Check size={16} />}
            </button>
          ))}
        </div>
      </Sheet>

      {/* Sheet: สมุดที่อยู่ */}
      <Sheet open={sheet === "book"} onClose={() => setSheet(null)} title="สมุดที่อยู่">
        <p className="mb-3 text-sm text-[var(--dw-muted)]">ที่อยู่ที่เคยทำธุรกรรมจริงบน Danny Chain</p>
        {contacts.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--dw-muted)]">ยังไม่มีประวัติธุรกรรม</p>
        ) : (
          <div className="space-y-1.5">
            {contacts.map((c) => (
              <button
                key={c.address}
                onClick={() => copy(c.address)}
                className="dw-glass flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left hover:bg-white/[0.06]"
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                    c.direction === "sent"
                      ? "bg-[var(--dw-rose)]/12 text-[var(--dw-rose)]"
                      : "bg-[var(--dw-green)]/12 text-[var(--dw-green)]"
                  }`}
                >
                  {c.direction === "sent" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                </span>
                <span className="flex-1 font-mono text-sm">{c.short}</span>
                {copied === c.address ? (
                  <Check size={14} className="text-[var(--dw-green)]" />
                ) : (
                  <Copy size={14} className="text-[var(--dw-muted)]" />
                )}
              </button>
            ))}
          </div>
        )}
      </Sheet>

      {/* Sheet: เครือข่าย */}
      <Sheet open={sheet === "network"} onClose={() => setSheet(null)} title="เครือข่าย">
        <div className="dw-glass space-y-3 rounded-2xl p-4 text-sm">
          <Row label="ชื่อเครือข่าย" value={CHAIN.name} />
          <Row label="Chain ID" value={String(CHAIN.chainId)} />
          <Row label="เหรียญหลัก" value={CHAIN.symbol} />
          <RowCopy label="RPC" value="https://rpc.dannyscan.com" onCopy={copy} copied={copied} />
          <RowCopy label="Explorer" value="https://dannyscan.com" onCopy={copy} copied={copied} />
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--dw-green)]">
          <span className="h-2 w-2 rounded-full bg-[var(--dw-green)]" /> เชื่อมต่ออยู่
        </div>
      </Sheet>

      {/* Sheet: เผยวลีกู้คืน (ต้องใส่ PIN) */}
      <Sheet open={sheet === "seed"} onClose={closeSeed} title="วลีกู้คืน">
        {!revealedSeed ? (
          <div>
            <div className="dw-glass mb-4 flex items-start gap-2.5 rounded-2xl border-[var(--dw-rose)]/30 bg-[var(--dw-rose)]/[0.06] p-3.5 text-xs text-[var(--dw-muted)]">
              <Shield size={16} className="mt-0.5 shrink-0 text-[var(--dw-rose)]" />
              อย่าให้ใครเห็นวลีนี้ ใครมีวลีนี้ควบคุมเงินคุณได้ทั้งหมด — ยืนยันตัวตนด้วย PIN ก่อน
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={revealPin}
              onChange={(e) => setRevealPin(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && doReveal()}
              placeholder="ใส่ PIN 6 หลัก"
              className="dw-glass w-full rounded-2xl px-4 py-3 text-center text-lg tracking-[0.4em] outline-none focus:border-[var(--dw-cyan)]/50"
              style={{ color: "var(--dw-text)" }}
            />
            {revealErr && (
              <p className="mt-2 flex items-center justify-center gap-1 text-xs text-[var(--dw-rose)]">
                <Warn size={13} /> PIN ไม่ถูกต้อง
              </p>
            )}
            <button
              onClick={doReveal}
              disabled={revealPin.length < 6}
              className="dw-btn-primary mt-4 w-full rounded-2xl py-3.5 font-semibold"
            >
              เผยวลี
            </button>
          </div>
        ) : (
          <div>
            <SeedPhraseGrid words={revealedSeed} />
            <button
              onClick={() => copyEphemeral(revealedSeed.join(" "), 30_000)}
              className="dw-btn-ghost mt-3 w-full rounded-xl py-2.5 text-sm"
            >
              คัดลอก (ล้างอัตโนมัติใน 30 วิ)
            </button>
            <p className="mt-3 text-center text-[11px] text-[var(--dw-muted)]">
              จดลงกระดาษเก็บออฟไลน์ · ห้ามถ่ายรูป/แชร์
            </p>
          </div>
        )}
      </Sheet>

      {/* Sheet: เกี่ยวกับ */}
      <Sheet open={sheet === "about"} onClose={() => setSheet(null)} title="เกี่ยวกับ Danny Wallet">
        <div className="flex flex-col items-center pb-2 text-center">
          <DannyLogo size={64} />
          <p className="mt-3 font-semibold">Danny Wallet</p>
          <p className="text-xs text-[var(--dw-muted)]">เวอร์ชัน 1.0.0 (เดโม)</p>
        </div>
        <div className="dw-glass mt-3 space-y-3 rounded-2xl p-4 text-sm">
          <Row label="เครือข่าย" value={`${CHAIN.name} (${CHAIN.chainId})`} />
          <Row label="รายชื่อ/ยอด" value="dannyscan" />
          <Row label="ราคา" value="dandex (on-chain)" />
          <Row label="กราฟ/วอลุ่ม" value="dancharts" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            ["Dannyscan", "https://dannyscan.com"],
            ["Dancharts", "https://dancharts.com"],
            ["dandex", "https://dandex.io"],
          ].map(([name, url]) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="dw-glass flex items-center justify-center gap-1 rounded-xl py-2.5 text-xs text-[var(--dw-muted)] hover:text-white"
            >
              <Globe size={13} /> {name}
            </a>
          ))}
        </div>
        <p className="mt-4 text-center text-[11px] leading-relaxed text-[var(--dw-muted)]">
          ต้นแบบ UI ที่เชื่อมข้อมูลจริงจาก Danny Chain — การลงนามธุรกรรมทำผ่านกระเป๋าของผู้ใช้เอง
        </p>
      </Sheet>

      <AccountSwitcher open={switcher} onClose={() => setSwitcher(false)} />
      <BottomNav />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[var(--dw-muted)]">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}

function RowCopy({
  label, value, onCopy, copied,
}: {
  label: string;
  value: string;
  onCopy: (v: string) => void;
  copied: string | null;
}) {
  return (
    <button onClick={() => onCopy(value)} className="flex w-full items-center justify-between gap-3 text-left">
      <span className="text-[var(--dw-muted)]">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 font-medium">
        <span className="truncate text-xs">{value}</span>
        {copied === value ? <Check size={13} className="shrink-0 text-[var(--dw-green)]" /> : <Copy size={13} className="shrink-0 text-[var(--dw-muted)]" />}
      </span>
    </button>
  );
}
