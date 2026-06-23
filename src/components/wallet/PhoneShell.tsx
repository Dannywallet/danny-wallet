"use client";

// มือถือ/แท็บเล็ต = กรอบโทรศัพท์กลางจอ · เดสก์ท็อป (lg+) = เลย์เอาต์ 2 คอลัมน์ (แผงแบรนด์ + การ์ด)
import React from "react";
import { DannyLogo } from "./DannyLogo";
import { Shield, Lock, Fingerprint } from "./Icons";

export function PhoneShell({
  children,
}: {
  children: React.ReactNode;
  /** bare = ไม่มี bottom nav (เช่นหน้า onboarding/unlock) */
  bare?: boolean;
}) {
  return (
    <div className="dw-root fixed inset-0 z-[2000] overflow-hidden">
      <div className="dw-bg" />
      <div className="relative flex h-full w-full items-center justify-center sm:p-6 lg:gap-12 lg:px-12">
        {/* แผงแบรนด์ (เฉพาะเดสก์ท็อป) */}
        <BrandingPanel />

        {/* การ์ดเนื้อหา — มือถือเต็มจอ, แท็บเล็ตกรอบโทรศัพท์, เดสก์ท็อปการ์ดสะอาด */}
        <div
          className="dw-glass relative flex h-full w-full max-w-[430px] flex-col overflow-hidden border-white/10 sm:h-[860px] sm:max-h-[94vh] sm:rounded-[40px] sm:shadow-2xl lg:h-auto lg:min-h-[600px] lg:max-h-[88vh] lg:rounded-[28px]"
          style={{ background: "var(--dw-card)" }}
        >
          {/* notch — แท็บเล็ตเท่านั้น (ไม่เอาบนเดสก์ท็อป) */}
          <div className="pointer-events-none absolute left-1/2 top-2 z-30 hidden h-6 w-32 -translate-x-1/2 rounded-full bg-black/60 sm:block lg:hidden" />
          {children}
        </div>
      </div>
    </div>
  );
}

const BRAND_FEATURES = [
  { Icon: Shield, text: "ไม่เก็บตัวกลาง — กุญแจอยู่ในเครื่องคุณเท่านั้น" },
  { Icon: Lock, text: "เข้ารหัสในเครื่องด้วย PIN และออโต้ล็อก" },
  { Icon: Fingerprint, text: "ปลอดภัยระดับ AES-256 บน Danny Chain" },
];

function BrandingPanel() {
  return (
    <div className="hidden w-[360px] shrink-0 flex-col justify-center lg:flex">
      <div className="dw-float mb-7 flex items-center gap-3">
        <DannyLogo size={56} />
        <span className="text-3xl font-bold tracking-tight">
          <span className="dw-text-grad">Danny</span> Wallet
        </span>
      </div>
      <p className="max-w-[320px] text-lg leading-relaxed text-[var(--dw-muted)]">
        กระเป๋าคริปโตที่สวย ปลอดภัย และเร็ว สำหรับเครือข่าย Danny Chain
      </p>
      <ul className="mt-8 space-y-3.5">
        {BRAND_FEATURES.map(({ Icon, text }) => (
          <li key={text} className="flex items-center gap-3 text-sm text-[var(--dw-muted)]">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--dw-violet)]/15 text-[var(--dw-cyan)]">
              <Icon size={17} />
            </span>
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** พื้นที่ scroll ของเนื้อหา */
export function Screen({
  children,
  className = "",
  pad = true,
}: {
  children: React.ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <div className={`dw-scroll flex-1 overflow-y-auto ${pad ? "px-5 pb-6 pt-3" : ""} ${className}`}>
      {children}
    </div>
  );
}
