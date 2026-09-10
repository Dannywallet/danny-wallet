"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet/wallet-store";
import { Screen } from "@/components/wallet/PhoneShell";
import { SecretInput } from "@/components/wallet/SecretInput";
import { DannyLogo } from "@/components/wallet/DannyLogo";
import { Shield, Warn } from "@/components/wallet/Icons";
import { useI18n } from "@/lib/wallet/i18n";

const MAX_ATTEMPTS = 10;

export default function Unlock() {
  const router = useRouter();
  const { t } = useI18n();
  const { hydrated, created, unlock, failedAttempts, lockedUntil } = useWallet();
  const [pin, setPin] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0); // วินาทีที่เหลือ

  React.useEffect(() => {
    if (hydrated && !created) router.replace("/wallet");
  }, [hydrated, created, router]);

  // นับถอยหลัง cooldown
  React.useEffect(() => {
    const remain = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
    setCooldown(remain);
    if (remain <= 0) return;
    const id = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(id);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const tryUnlock = async (code: string) => {
    if (busy || cooldown > 0) return;
    setBusy(true);
    let res: { ok: boolean; wiped?: boolean; cooldownMs?: number; needsSecretUpgrade?: boolean; systemError?: boolean };
    try {
      res = await unlock(code);
    } catch (e) {
      setBusy(false);
      setPin("");
      setErr(t("unlock.error"));
      setTimeout(() => setErr(null), 1500);
      return;
    }
    setBusy(false);
    if (res.ok) {
      // รหัสอ่อนเกินนโยบาย (เช่น PIN 6 หลักแบบเดิม) → บังคับตั้งใหม่ก่อนเข้าใช้งาน
      router.replace(res.needsSecretUpgrade ? "/wallet/upgrade-pin" : "/wallet/home");
      return;
    }
    // ระบบ derive key ล้มเหลว (เช่นแรมไม่พอสำหรับ scrypt) — ไม่ใช่รหัสผิด
    // ไม่ล้างช่องกรอกและไม่ถูกนับเป็นครั้งที่ผิด ให้ผู้ใช้กดลองใหม่ได้เลย
    if (res.systemError) {
      setErr(t("unlock.systemBusy"));
      setTimeout(() => setErr(null), 3000);
      return;
    }
    setPin("");
    if (res.wiped) {
      setErr(t("unlock.wiped"));
      setTimeout(() => router.replace("/wallet"), 1800);
      return;
    }
    if (res.cooldownMs && res.cooldownMs > 0) {
      setCooldown(Math.ceil(res.cooldownMs / 1000));
      setErr(t("unlock.cooldownMsg"));
    } else {
      setErr(t("tx.pinWrong"));
    }
    setTimeout(() => setErr(null), 1500);
  };

  const attemptsLeft = MAX_ATTEMPTS - failedAttempts;
  // รหัสมีได้ทั้งแบบตัวเลขและตัวอักษรผสม ความยาวไม่จำกัด — จึงส่งเมื่อผู้ใช้สั่งเท่านั้น
  // (เดิม auto-submit ตอนครบ 6 หลัก ซึ่งใช้กับรหัสยาวไม่ได้)
  const canSubmit = pin.length > 0 && !busy && cooldown === 0;

  return (
    <Screen className="flex flex-col items-center justify-center">
      <div className="dw-float relative mb-6 lg:hidden">
        <DannyLogo size={88} />
      </div>
      <h1 className="text-xl font-semibold">{t("unlock.welcomeBack")}</h1>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--dw-muted)]">
        <Shield size={14} className="text-[var(--dw-green)]" /> {t("unlock.enterPinToUnlock")}
      </p>

      <div className="my-8 w-full max-w-[280px]">
        <SecretInput
          value={pin}
          onChange={setPin}
          onSubmit={() => canSubmit && void tryUnlock(pin)}
          mode="text"
          placeholder={t("unlock.enterPinToUnlock")}
          autoFocus
          disabled={busy || cooldown > 0}
        />
        {err && (
          <p className="mt-3 max-w-[260px] text-center text-sm text-[var(--dw-rose)]">{err}</p>
        )}
        {cooldown > 0 && (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-[var(--dw-amber)]">
            <Warn size={13} /> {t("unlock.waitPre")} {cooldown} {t("unlock.waitSuf")}
          </p>
        )}
        {/* แสดงตั้งแต่ใส่ผิดครั้งแรก (เดิมซ่อนจนครั้งที่ 3 ซึ่งสายไปสำหรับเตือน)
            ไล่สีตามความเสี่ยง 3 ระดับ: เหลือ ≤2 = แดง, ≤8 = เหลือง, 9 = สีข้อความปกติ
            (พลาดครั้งแรกมักเป็นการพิมพ์ผิด จึงยังไม่เตือน — ครั้งที่สองเป็นต้นไปเริ่มเตือน) */}
        {failedAttempts > 0 && attemptsLeft > 0 && (
          <p className="mt-2 text-center text-xs text-[var(--dw-muted)]">
            {t("unlock.attemptsPre")}{" "}
            <b
              className="text-base font-bold"
              style={{
                color:
                  attemptsLeft <= 2
                    ? "var(--dw-rose)"
                    : attemptsLeft <= 8
                      ? "var(--dw-amber)"
                      : "var(--dw-text)",
              }}
            >
              {attemptsLeft}
            </b>{" "}
            {t("unlock.attemptsSuf")}
          </p>
        )}
      </div>

      <div className="w-full max-w-[280px]">
        <button
          onClick={() => void tryUnlock(pin)}
          disabled={!canSubmit}
          className="dw-btn-primary w-full rounded-2xl py-3.5 font-semibold disabled:opacity-50"
        >
          {busy ? "…" : t("unlock.welcomeBack")}
        </button>
      </div>

      <p className="mt-6 flex items-center gap-1.5 text-[11px] text-[var(--dw-muted)]">
        <Shield size={12} /> {t("unlock.seedNote")}
      </p>
    </Screen>
  );
}
