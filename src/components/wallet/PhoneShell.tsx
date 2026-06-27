"use client";

// มือถือ/แท็บเล็ต = กรอบโทรศัพท์กลางจอ · เดสก์ท็อป (lg+) = เลย์เอาต์ 2 คอลัมน์ (แผงแบรนด์ + การ์ด)
import React from "react";
import { DannyLogo } from "./DannyLogo";
import { Shield, Lock, Fingerprint } from "./Icons";
import { useI18n } from "@/lib/wallet/i18n";

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
  { Icon: Shield, key: "brand.feat1" },
  { Icon: Lock, key: "brand.feat2" },
  { Icon: Fingerprint, key: "brand.feat3" },
];

function BrandingPanel() {
  const { t } = useI18n();
  return (
    <div className="hidden w-[360px] shrink-0 flex-col justify-center lg:flex">
      <div className="dw-float mb-7 flex items-center gap-3">
        <DannyLogo size={56} />
        <span className="text-3xl font-bold tracking-tight">
          <span className="dw-text-grad">Danny</span> Wallet
        </span>
      </div>
      <p className="max-w-[320px] text-lg leading-relaxed text-[var(--dw-muted)]">
        {t("welcome.subtitle")}
      </p>
      <ul className="mt-8 space-y-3.5">
        {BRAND_FEATURES.map(({ Icon, key }) => (
          <li key={key} className="flex items-center gap-3 text-sm text-[var(--dw-muted)]">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--dw-violet)]/15 text-[var(--dw-cyan)]">
              <Icon size={17} />
            </span>
            {t(key)}
          </li>
        ))}
      </ul>

      {/* ปุ่มดาวน์โหลด 4 ช่องทาง (2×2) */}
      <StoreBadges />
    </div>
  );
}

// โลโก้ Apple (สีขาว) — SVG เดี่ยว ไม่มี dependency
function AppleMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
    </svg>
  );
}

// โลโก้ Google Play (สี่สี) — สามเหลี่ยม Play 4 ด้าน
function PlayMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M3.5 2.1c-.3.16-.5.47-.5.86v18.08c0 .39.2.7.5.86l10.2-10.9z" fill="#00C3FF" />
      <path d="M17.6 8.45L13.7 11.9l3.9 3.45 3.36-1.9c.69-.4.69-1.32 0-1.72z" fill="#FFC107" />
      <path d="M3.5 21.9c.27.14.6.13.94-.07l12.18-6.93-3.92-3.5z" fill="#00E676" />
      <path d="M16.62 8.07L4.44 1.14c-.34-.2-.67-.21-.94-.07l9.2 9.83z" fill="#FF3D47" />
    </svg>
  );
}

// ไอคอนคอมพิวเตอร์ (Desktop wallet) — สไตล์เส้นเดียวกับชุด Icons
function DesktopMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

// ไอคอนเบราว์เซอร์ (Browser wallet) — หน้าต่างเบราว์เซอร์ + แถบบน
function BrowserMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 8.5h18M6 6.25h.01M8.5 6.25h.01M11 6.25h.01" />
    </svg>
  );
}

const STORES: {
  Mark: React.ComponentType<{ size?: number }>;
  top: string;
  main: string;
  href: string;
}[] = [
  { Mark: AppleMark, top: "Download on the", main: "App Store", href: "#" },
  { Mark: PlayMark, top: "GET IT ON", main: "Google Play", href: "#" },
  { Mark: DesktopMark, top: "Download on the", main: "Desktop wallet", href: "https://dannywallet.com/webwallet/" },
  { Mark: BrowserMark, top: "Get it on", main: "Browser Wallet", href: "https://app.dannywallet.com/wallet/" },
];

function StoreBadges() {
  return (
    <div className="mt-8 grid w-full max-w-[320px] grid-cols-2 gap-3">
      {STORES.map(({ Mark, top, main, href }, i) => (
        <a
          key={i}
          href={href}
          {...(href !== "#" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="dw-glass flex items-center gap-2.5 rounded-xl border border-[var(--dw-border)] px-3 py-2 text-[var(--dw-text)] transition hover:border-[var(--dw-purple)]/40"
        >
          <Mark size={22} />
          <span className="flex flex-col leading-tight">
            <span className="text-[9px] uppercase tracking-wide text-[var(--dw-muted)]">{top}</span>
            <span className="text-sm font-semibold">{main}</span>
          </span>
        </a>
      ))}
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
