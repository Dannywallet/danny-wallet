"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet/wallet-store";
import { Screen } from "@/components/wallet/PhoneShell";
import { SecurityBadge } from "@/components/wallet/SecurityBadge";
import { DannyLogo } from "@/components/wallet/DannyLogo";
import { Shield, Lock, Fingerprint, Plus, ChevronRight } from "@/components/wallet/Icons";

const FEATURES = [
  { Icon: Shield, title: "ไม่เก็บตัวกลาง", desc: "คุณคือเจ้าของกุญแจเพียงผู้เดียว" },
  { Icon: Lock, title: "เข้ารหัสในเครื่อง", desc: "ล็อกด้วย PIN และตั้งเวลาออโต้ล็อก" },
  { Icon: Fingerprint, title: "ยืนยันชีวมิติ", desc: "ปลดล็อกเร็วด้วยลายนิ้วมือ/ใบหน้า" },
];

export default function WalletWelcome() {
  const router = useRouter();
  const { hydrated, created, locked } = useWallet();

  React.useEffect(() => {
    if (!hydrated) return;
    if (created) router.replace(locked ? "/wallet/unlock" : "/wallet/home");
  }, [hydrated, created, locked, router]);

  return (
    <Screen className="flex flex-col">
      {/* โลโก้ + แบรนด์ */}
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {/* โลโก้+แบรนด์ — ซ่อนบนเดสก์ท็อป (แผงแบรนด์ด้านซ้ายแสดงให้แล้ว) */}
        <div className="flex flex-col items-center lg:hidden">
          <div className="dw-float relative mb-6">
            <DannyLogo size={104} />
            <span className="absolute -right-1 -top-1 grid h-8 w-8 place-items-center rounded-full bg-[var(--dw-green)] text-black dw-pulse-ring">
              <Shield size={16} />
            </span>
          </div>

          <h1 className="text-3xl font-bold">
            <span className="dw-text-grad">Danny</span> Wallet
          </h1>
          <p className="mt-2 max-w-[260px] text-sm text-[var(--dw-muted)]">
            กระเป๋าคริปโตที่สวย ปลอดภัย และเร็ว สำหรับเครือข่าย Danny Chain
          </p>
          <div className="mt-4">
            <SecurityBadge label="ออกแบบเพื่อความปลอดภัย" />
          </div>
        </div>

        {/* จุดเด่น */}
        <div className="mt-8 w-full space-y-2.5 lg:mt-0">
          {FEATURES.map(({ Icon, title, desc }) => (
            <div key={title} className="dw-glass flex items-center gap-3 rounded-2xl px-4 py-3 text-left">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--dw-violet)]/15 text-[var(--dw-purple)]">
                <Icon size={20} />
              </span>
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs text-[var(--dw-muted)]">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ปุ่ม */}
      <div className="space-y-3 pt-6">
        <Link
          href="/wallet/create"
          className="dw-btn-primary flex items-center justify-center gap-2 rounded-2xl py-4 text-base font-semibold"
        >
          <Plus size={20} /> สร้างกระเป๋าใหม่
        </Link>
        <Link
          href="/wallet/import"
          className="dw-btn-ghost flex items-center justify-center gap-2 rounded-2xl py-4 text-base font-semibold"
        >
          นำเข้ากระเป๋าเดิม <ChevronRight size={18} />
        </Link>
        <p className="pt-1 text-center text-[11px] leading-relaxed text-[var(--dw-muted)]">
          เดโม UI — ไม่ใช่เงินจริง ไม่มีการสร้างกุญแจจริงหรือเชื่อมต่อเครือข่าย
        </p>
      </div>
    </Screen>
  );
}
